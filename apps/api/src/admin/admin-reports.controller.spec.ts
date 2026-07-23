import type { CommentService } from "../comments/comment.service";
import type { ReportService } from "../reports/report.service";
import { AdminReportsController } from "./admin-reports.controller";

function makeController(
  overrides: {
    findOne?: jest.Mock;
  } = {},
) {
  const reports = {
    findOne:
      overrides.findOne ??
      jest.fn().mockResolvedValue({ targetType: "COMMENT", targetId: "c1" }),
    resolve: jest.fn(),
  } as unknown as ReportService;

  const comments = {
    adminRemove: jest.fn(),
  } as unknown as CommentService;

  const controller = new AdminReportsController(reports, comments);
  return { controller, reports, comments };
}

const ADMIN = { sub: "admin1" } as never;

describe("AdminReportsController.takeDown", () => {
  it("removes the comment then resolves the report, for a COMMENT target", async () => {
    const { controller, reports, comments } = makeController();

    await controller.takeDown(ADMIN, "r1");

    expect(comments.adminRemove).toHaveBeenCalledWith("c1");
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("resolves without touching a comment for a non-COMMENT target", async () => {
    const { controller, reports, comments } = makeController({
      findOne: jest
        .fn()
        .mockResolvedValue({ targetType: "USER", targetId: "u1" }),
    });

    await controller.takeDown(ADMIN, "r1");

    expect(comments.adminRemove).not.toHaveBeenCalled();
    expect(reports.resolve).toHaveBeenCalledWith("admin1", "r1", "RESOLVED");
  });

  it("404s on an unknown report", async () => {
    const { controller } = makeController({
      findOne: jest.fn().mockResolvedValue(null),
    });

    await expect(controller.takeDown(ADMIN, "missing")).rejects.toThrow();
  });
});
