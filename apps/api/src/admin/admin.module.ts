import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { CatalogModule } from "../catalog/catalog.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { SecurityModule } from "../security/security.module";
import { UsersModule } from "../users/users.module";
import { AdminEmailsController } from "./admin-emails.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminPushController } from "./admin-push.controller";
import { AdminSecurityController } from "./admin-security.controller";
import { AdminSystemController } from "./admin-system.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";
import { AdminStatsService } from "./admin-stats.service";
import { BackupService } from "./backup.service";

@Module({
  imports: [
    MailModule,
    NotificationModule,
    AuthModule,
    CatalogModule,
    JobsModule,
    SecurityModule,
    UsersModule,
  ],
  controllers: [
    AdminSystemController,
    AdminSecurityController,
    AdminJobsController,
    AdminUsersController,
    AdminEmailsController,
    AdminPushController,
  ],
  providers: [AdminService, AdminGuard, AdminStatsService, BackupService],
})
export class AdminModule {}
