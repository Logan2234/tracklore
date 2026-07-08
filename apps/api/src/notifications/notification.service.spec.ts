import type { PrismaService } from "../prisma/prisma.service";
import { NotificationService } from "./notification.service";

describe("NotificationService.scanAll", () => {
  function makeService(userIds: string[]) {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue(userIds.map((id) => ({ id }))),
      },
    } as unknown as PrismaService;
    const service = new NotificationService(prisma);
    return { service, prisma };
  }

  it("only queries users with in-app notifications enabled", async () => {
    const { service, prisma } = makeService([]);
    await service.scanAll();
    expect(prisma.user.findMany).toHaveBeenCalledWith({
      where: { notifyInApp: true },
      select: { id: true },
    });
  });

  it("scans every eligible user and sums the created count", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(1);

    const created = await service.scanAll();

    expect(created).toBe(3);
    expect(scan).toHaveBeenCalledTimes(3);
    expect(scan).toHaveBeenNthCalledWith(1, "u1");
    expect(scan).toHaveBeenNthCalledWith(2, "u2");
    expect(scan).toHaveBeenNthCalledWith(3, "u3");
  });

  it("keeps scanning the rest of the batch when one user fails", async () => {
    const { service } = makeService(["u1", "u2", "u3"]);
    jest.spyOn(service["logger"], "error").mockImplementation(() => undefined);
    const scan = jest
      .spyOn(service, "scan")
      .mockResolvedValueOnce(1)
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(4);

    const created = await service.scanAll();

    expect(created).toBe(5);
    expect(scan).toHaveBeenCalledTimes(3);
  });
});
