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

function makeGuard(role: unknown) {
  const prisma = {
    user: { findUnique: jest.fn().mockResolvedValue({ role }) },
  } as unknown as PrismaService;
  return { guard: new AdminGuard(prisma), prisma };
}

describe("AdminGuard", () => {
  it("allows an account with the ADMIN role", async () => {
    const { guard } = makeGuard("ADMIN");
    await expect(guard.canActivate(contextFor("user-1"))).resolves.toBe(true);
  });

  it("rejects an account with the USER role", async () => {
    const { guard } = makeGuard("USER");
    await expect(guard.canActivate(contextFor("user-1"))).rejects.toThrow(
      ForbiddenException,
    );
  });

  it("rejects when the request carries no authenticated user", async () => {
    const { guard, prisma } = makeGuard("ADMIN");
    await expect(guard.canActivate(contextFor())).rejects.toThrow(
      ForbiddenException,
    );
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });
});
