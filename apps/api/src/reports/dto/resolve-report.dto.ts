import { IsIn } from "class-validator";

export class ResolveReportBody {
  @IsIn(["RESOLVED", "DISMISSED"])
  status!: "RESOLVED" | "DISMISSED";
}
