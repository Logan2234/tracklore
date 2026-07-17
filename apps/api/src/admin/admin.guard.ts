import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Route guard restricting access to admin accounts. Runs after the global
 * `JwtAuthGuard` (which populates `request.user`), then reads the live role
 * from the DB — the JWT payload doesn't carry it, and a token issued before
 * the bootstrap promotion must still see the new grant.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const userId = request.user?.sub;

    if (!userId) {
      throw new ForbiddenException("Admin access required");
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });

    if (user?.role !== "ADMIN") {
      throw new ForbiddenException("Admin access required");
    }

    return true;
  }
}
