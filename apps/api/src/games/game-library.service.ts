import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type {
  GameEntry,
  GameExternalId,
  GameItem,
  Prisma,
} from "@prisma/client";
import type {
  GameDetailDto,
  GameEntryDto,
  GameItemDto,
  GameSource,
  GameStatsDto,
  GameStatus,
} from "@tracklore/shared";
import { PrismaService } from "../prisma/prisma.service";
import { AgeGateService } from "../users/age-gate.service";
import { GameItemService } from "./game-item.service";
import { aggregateGameStats } from "./game-stats.util";
import { UpdateGameEntryDto } from "./dto/update-game-entry.dto";
import { UpsertGameEntryDto } from "./dto/upsert-game-entry.dto";

// Entries always need the game + its external IDs (canonical sourceId).
const ENTRY_INCLUDE = {
  gameItem: { include: { externalIds: true } },
} satisfies Prisma.GameEntryInclude;

type EntryWithGame = Prisma.GameEntryGetPayload<{
  include: typeof ENTRY_INCLUDE;
}>;

@Injectable()
export class GameLibraryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gameItemService: GameItemService,
    private readonly ageGate: AgeGateService,
  ) {}

  /** First touch of a game persists it (on-demand cache), then upserts the entry. */
  async upsertEntry(
    userId: string,
    dto: UpsertGameEntryDto,
  ): Promise<GameEntryDto> {
    const gameItem = await this.gameItemService.upsertFromSource(
      dto.source,
      dto.sourceId,
    );

    const changes = {
      status: dto.status,
      rating: dto.rating,
      notes: dto.notes,
      favorite: dto.favorite,
    };
    const entry = await this.prisma.gameEntry.upsert({
      where: { userId_gameItemId: { userId, gameItemId: gameItem.id } },
      update: changes,
      create: { userId, gameItemId: gameItem.id, ...changes },
      include: ENTRY_INCLUDE,
    });

    return toEntryDto(entry);
  }

  async listEntries(
    userId: string,
    filters: { status?: GameStatus },
  ): Promise<GameEntryDto[]> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId, status: filters.status },
      include: ENTRY_INCLUDE,
      orderBy: { updatedAt: "desc" },
    });
    return entries.map(toEntryDto);
  }

  async getEntry(userId: string, entryId: string): Promise<GameEntryDto> {
    await this.assertEntryOwnership(userId, entryId);
    const entry = await this.prisma.gameEntry.findUniqueOrThrow({
      where: { id: entryId },
      include: ENTRY_INCLUDE,
    });
    return toEntryDto(entry);
  }

  async updateEntry(
    userId: string,
    entryId: string,
    dto: UpdateGameEntryDto,
  ): Promise<GameEntryDto> {
    await this.assertEntryOwnership(userId, entryId);

    const entry = await this.prisma.gameEntry.update({
      where: { id: entryId },
      data: {
        status: dto.status,
        rating: dto.rating,
        notes: dto.notes,
        favorite: dto.favorite,
        playtimeMinutes: dto.playtimeMinutes,
        startedAt:
          dto.startedAt === undefined ? undefined : toDateOrNull(dto.startedAt),
        finishedAt:
          dto.finishedAt === undefined
            ? undefined
            : toDateOrNull(dto.finishedAt),
      },
      include: ENTRY_INCLUDE,
    });

    return toEntryDto(entry);
  }

  async deleteEntry(userId: string, entryId: string): Promise<void> {
    await this.assertEntryOwnership(userId, entryId);
    await this.prisma.gameEntry.delete({ where: { id: entryId } });
  }

  /** Aggregated stats for the user's game library. */
  async getStats(userId: string): Promise<GameStatsDto> {
    const entries = await this.prisma.gameEntry.findMany({
      where: { userId },
      select: {
        status: true,
        favorite: true,
        gameItem: { select: { genres: true, platforms: true } },
      },
    });

    return aggregateGameStats(
      entries.map((e) => ({
        status: e.status,
        favorite: e.favorite,
        genres: e.gameItem.genres,
        platforms: e.gameItem.platforms,
      })),
    );
  }

  /**
   * Game detail page: catalogue metadata + the user's library state in one
   * call. Served from the cache when the game is already persisted, otherwise
   * fetched live (persisting nothing — a previewed game must not enter the
   * on-demand cache).
   */
  async getGameDetail(
    userId: string,
    source: GameSource,
    sourceId: string,
  ): Promise<GameDetailDto> {
    const details = await this.gameItemService.getLiveDetails(source, sourceId);

    if (details.isAdult && !(await this.ageGate.allowsAdultContent(userId))) {
      throw new ForbiddenException(
        "This title is restricted to accounts with adult content enabled",
      );
    }

    const ref = await this.prisma.gameExternalId.findUnique({
      where: { source_externalId: { source, externalId: sourceId } },
    });
    const entryRow = ref
      ? await this.prisma.gameEntry.findUnique({
          where: {
            userId_gameItemId: { userId, gameItemId: ref.gameItemId },
          },
          include: ENTRY_INCLUDE,
        })
      : null;

    return { ...details, entry: entryRow ? toEntryDto(entryRow) : null };
  }

  private async assertEntryOwnership(
    userId: string,
    entryId: string,
  ): Promise<GameEntry> {
    const entry = await this.prisma.gameEntry.findUnique({
      where: { id: entryId },
    });

    if (!entry) {
      throw new NotFoundException("Game library entry not found");
    }

    if (entry.userId !== userId) {
      throw new ForbiddenException("This entry belongs to another user");
    }

    return entry;
  }
}

function toGameItemDto(
  game: GameItem & { externalIds: GameExternalId[] },
): GameItemDto {
  return {
    id: game.id,
    title: game.title,
    coverUrl: game.coverUrl,
    canonicalSource: game.canonicalSource,
    sourceId:
      game.externalIds.find((ext) => ext.source === game.canonicalSource)
        ?.externalId ?? "",
  };
}

function toEntryDto(entry: EntryWithGame): GameEntryDto {
  return {
    id: entry.id,
    game: toGameItemDto(entry.gameItem),
    status: entry.status,
    rating: entry.rating,
    notes: entry.notes,
    favorite: entry.favorite,
    playtimeMinutes: entry.playtimeMinutes,
    startedAt: entry.startedAt?.toISOString() ?? null,
    finishedAt: entry.finishedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
  };
}

function toDateOrNull(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
