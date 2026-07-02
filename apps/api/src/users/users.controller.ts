import { Controller, Get, NotFoundException } from "@nestjs/common";
import type { UserDto } from "@tracklore/shared";
import { toUserDto } from "../auth/auth.service";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

@Controller("users")
export class UsersController {
  constructor(private readonly prisma: PrismaService) {}

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
}
