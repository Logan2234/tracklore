import { Module } from "@nestjs/common";
import { ReportService } from "./report.service";

// Report is a polymorphic target (COMMENT today, REVIEW/USER later) shared
// across features — no controller of its own; CommentsModule wires the filing
// endpoint, AdminModule wires the moderation queue.
@Module({
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
