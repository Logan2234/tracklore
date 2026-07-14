import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import type { AuthenticatedRequest } from "../auth/decorators/current-user.decorator";
import { PrismaService } from "../prisma/prisma.service";

/** Marks an account as an admin. Stored in `User.entitlements`. */
export const ADMIN_ENTITLEMENT = "admin";

/**
 * Route guard restricting access to admin accounts. Runs after the global
 * `JwtAuthGuard` (which populates `request.user`), then reads the live
 * entitlements from the DB — the JWT payload doesn't carry them, and a token
 * issued before the bootstrap promotion must still see the new grant.
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
      select: { entitlements: true },
    });
    const entitlements = Array.isArray(user?.entitlements)
      ? (user.entitlements as string[])
      : [];

    if (!entitlements.includes(ADMIN_ENTITLEMENT)) {
      throw new ForbiddenException("Admin access required");
    }
    return true;
  }
}
