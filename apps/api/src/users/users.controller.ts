import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Patch,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import type {
  UserDataExportDto,
  UserDto,
  UsernameAvailabilityDto,
} from "@tracklore/shared";
import * as bcrypt from "bcryptjs";
import { randomInt } from "node:crypto";
import { BCRYPT_ROUNDS, hashToken, toUserDto } from "../auth/auth.service";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import { MailService } from "../mail/mail.service";
import { PrismaService } from "../prisma/prisma.service";
import { isAdult } from "./age.util";
import { ChangeEmailDto } from "./dto/change-email.dto";
import { ChangePasswordDto } from "./dto/change-password.dto";
import { ConfirmEmailChangeDto } from "./dto/confirm-email-change.dto";
import { DeleteAccountDto } from "./dto/delete-account.dto";
import { UpdateUserDto } from "./dto/update-user.dto";
import { UpdateUsernameDto } from "./dto/update-username.dto";

const EMAIL_CHANGE_TTL_MINUTES = 15;
const MAX_EMAIL_CHANGE_ATTEMPTS = 5;

@Controller("users")
export class UsersController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  @Get("me")
  async getMe(@CurrentUser() payload: JwtPayload): Promise<UserDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    return toUserDto(user);
  }

  /** Full portable dump of the account's data (GDPR "download my data"). */
  @Get("me/export")
  async exportData(
    @CurrentUser() payload: JwtPayload,
  ): Promise<UserDataExportDto> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new NotFoundException("User not found");
    }

    const entries = await this.prisma.libraryEntry.findMany({
      where: { userId: payload.sub },
      include: { mediaItem: { include: { externalIds: true } } },
      orderBy: { createdAt: "asc" },
    });

    const watches = await this.prisma.episodeWatch.findMany({
      where: { userId: payload.sub },
      include: {
        episode: {
          include: {
            season: {
              include: { mediaItem: { include: { externalIds: true } } },
            },
          },
        },
      },
      orderBy: { watchedAt: "asc" },
    });

    return {
      exportedAt: new Date().toISOString(),
      account: toUserDto(user),
      library: entries.map((entry) => ({
        media: {
          type: entry.mediaItem.type,
          title: entry.mediaItem.title,
          canonicalSource: entry.mediaItem.canonicalSource,
          sourceId:
            entry.mediaItem.externalIds.find(
              (id) => id.source === entry.mediaItem.canonicalSource,
            )?.externalId ?? "",
          externalIds: entry.mediaItem.externalIds.map((id) => ({
            source: id.source,
            externalId: id.externalId,
          })),
        },
        status: entry.status,
        rating: entry.rating,
        notes: entry.notes,
        favorite: entry.favorite,
        startedAt: entry.startedAt?.toISOString() ?? null,
        finishedAt: entry.finishedAt?.toISOString() ?? null,
        createdAt: entry.createdAt.toISOString(),
      })),
      episodeWatches: watches.map((watch) => {
        const media = watch.episode.season.mediaItem;
        return {
          media: {
            type: media.type,
            title: media.title,
            sourceId:
              media.externalIds.find(
                (id) => id.source === media.canonicalSource,
              )?.externalId ?? "",
          },
          seasonNumber: watch.episode.season.number,
          episodeNumber: watch.episode.number,
          episodeTitle: watch.episode.title,
          watchedAt: watch.watchedAt.toISOString(),
        };
      }),
    };
  }

  @Patch("me")
  async updateMe(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUserDto,
  ): Promise<UserDto> {
    if (dto.birthDate && new Date(dto.birthDate) > new Date()) {
      throw new BadRequestException("Birth date cannot be in the future");
    }

    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { birthDate: true, allowAdultContent: true },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    const nextBirthDate =
      dto.birthDate === undefined
        ? current.birthDate
        : dto.birthDate === null
          ? null
          : new Date(dto.birthDate);

    let nextAllowAdultContent =
      dto.allowAdultContent ?? current.allowAdultContent;

    if (nextAllowAdultContent && !isAdult(nextBirthDate)) {
      if (dto.allowAdultContent === true) {
        throw new BadRequestException(
          "Adult content requires a birth date confirming the account is 18+",
        );
      }

      // The birth date changed under a previously-enabled flag: turn it off quietly.
      nextAllowAdultContent = false;
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: {
        displayName: dto.displayName,
        birthDate: nextBirthDate,
        allowAdultContent: nextAllowAdultContent,
        notifyInApp: dto.notifyInApp,
        notifyEmail: dto.notifyEmail,
        notifyPush: dto.notifyPush,
        enabledDomains: dto.enabledDomains,
      },
    });
    return toUserDto(user);
  }

  /**
   * Requires the current password, since email doubles as the login
   * identifier. Doesn't change the email yet — sends a confirmation code to
   * the new address; see confirmEmailChange().
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/email")
  async changeEmail(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangeEmailDto,
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: dto.newEmail },
      select: { id: true },
    });

    if (existing && existing.id !== payload.sub) {
      throw new ConflictException("An account with this email already exists");
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    await this.prisma.$transaction([
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
      this.prisma.emailChangeRequest.create({
        data: {
          userId: payload.sub,
          newEmail: dto.newEmail,
          codeHash: hashToken(code),
          expiresAt: new Date(Date.now() + EMAIL_CHANGE_TTL_MINUTES * 60_000),
        },
      }),
    ]);
    await this.mail.sendEmailChangeCode(dto.newEmail, code);
  }

  /** Consumes the code sent by changeEmail() and applies the new address. */
  @Patch("me/email/confirm")
  async confirmEmailChange(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ConfirmEmailChangeDto,
  ): Promise<UserDto> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    const stored = await this.prisma.emailChangeRequest.findFirst({
      where: { userId: payload.sub },
    });

    const matches =
      stored && stored.codeHash === hashToken(dto.code) && stored.expiresAt >= new Date();

    if (!stored || !matches) {
      if (stored) {
        if (stored.attempts + 1 >= MAX_EMAIL_CHANGE_ATTEMPTS) {
          await this.prisma.emailChangeRequest.deleteMany({
            where: { userId: payload.sub },
          });
        } else {
          await this.prisma.emailChangeRequest.update({
            where: { id: stored.id },
            data: { attempts: { increment: 1 } },
          });
        }
      }
      throw new UnauthorizedException("Invalid or expired code");
    }

    const [user] = await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: payload.sub },
        data: { email: stored.newEmail },
      }),
      this.prisma.emailChangeRequest.deleteMany({
        where: { userId: payload.sub },
      }),
    ]);
    await this.mail.sendEmailChanged(current.email, stored.newEmail);
    return toUserDto(user);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Patch("me/password")
  async changePassword(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: ChangePasswordDto,
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    if (await bcrypt.compare(dto.newPassword, current.passwordHash)) {
      throw new BadRequestException(
        "New password must be different from the current password",
      );
    }

    await this.prisma.user.update({
      where: { id: payload.sub },
      data: { passwordHash: await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS) },
    });
    await this.mail.sendPasswordChanged(current.email);
  }

  /**
   * Permanently deletes the account. The current password is re-confirmed since
   * this is irreversible. All owned rows (library entries, watches, refresh
   * tokens, notifications) go with it via `onDelete: Cascade`; the shared
   * MediaItem cache is untouched.
   */
  @HttpCode(HttpStatus.NO_CONTENT)
  @Delete("me")
  async deleteAccount(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    const current = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!current) {
      throw new NotFoundException("User not found");
    }

    if (!(await bcrypt.compare(dto.currentPassword, current.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }

    await this.prisma.user.delete({ where: { id: payload.sub } });
  }

  /** Live check backing the debounced availability hint in the username form. */
  @Get("me/username-availability")
  async checkUsernameAvailability(
    @CurrentUser() payload: JwtPayload,
    @Query("value") value?: string,
  ): Promise<UsernameAvailabilityDto> {
    if (!value) {
      return { available: false };
    }

    const existing = await this.prisma.user.findUnique({
      where: { username: value },
      select: { id: true },
    });
    return { available: !existing || existing.id === payload.sub };
  }

  /** Re-validates uniqueness server-side — the debounced check is a hint, not the source of truth. */
  @Patch("me/username")
  async updateUsername(
    @CurrentUser() payload: JwtPayload,
    @Body() dto: UpdateUsernameDto,
  ): Promise<UserDto> {
    const existing = await this.prisma.user.findUnique({
      where: { username: dto.username },
      select: { id: true },
    });

    if (existing && existing.id !== payload.sub) {
      throw new ConflictException("This username is already taken");
    }

    const user = await this.prisma.user.update({
      where: { id: payload.sub },
      data: { username: dto.username },
    });
    return toUserDto(user);
  }
}
