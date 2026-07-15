import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogModule } from "../catalog/catalog.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AdminStatsService } from "./admin-stats.service";

@Module({
  imports: [
    MailModule,
    NotificationModule,
    AuthModule,
    CatalogModule,
    JobsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard, AdminStatsService],
})
export class AdminModule {}
