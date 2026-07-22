import { Module } from "@nestjs/common";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { ReportService } from "./report.service";

// Report is a polymorphic target (COMMENT today, REVIEW/USER later) shared
// across features — no controller of its own; CommentsModule wires the filing
// endpoint, AdminModule wires the moderation queue. MailModule/JobsModule are
// needed for ReportService's daily digest cron.
@Module({
  imports: [MailModule, JobsModule],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportsModule {}
