import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../prisma/prisma.service";
import { AdminGuard } from "./admin.guard";

function contextFor(userId?: string): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { sub: userId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

function makeGuard(entitlements: unknown) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ entitlements }) },
  } as unknown as PrismaService;
  return { guard: new AdminGuard(prisma), prisma };
}

describe("AdminGuard", () => {
  it("allows an account carrying the admin entitlement", async () => {
    const { guard } = makeGuard(["admin"]);
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("rejects an account without the entitlement", async () => {
    const { guard } = makeGuard([]);
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects when the request carries no authenticated user", async () => {
    const { guard, prisma } = makeGuard(["admin"]);
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
