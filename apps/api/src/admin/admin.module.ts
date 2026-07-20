import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BooksModule } from "../books/books.module";
import { CatalogModule } from "../catalog/catalog.module";
import { GamesModule } from "../games/games.module";
import { JobsModule } from "../jobs/jobs.module";
import { MailModule } from "../mail/mail.module";
import { MusicModule } from "../music/music.module";
import { NotificationModule } from "../notifications/notification.module";
import { ReportsModule } from "../reports/reports.module";
import { SecurityModule } from "../security/security.module";
import { UsersModule } from "../users/users.module";
import { AdminCacheController } from "./admin-cache.controller";
import { AdminEmailsController } from "./admin-emails.controller";
import { AdminImportsController } from "./admin-imports.controller";
import { AdminJobsController } from "./admin-jobs.controller";
import { AdminPushController } from "./admin-push.controller";
import { AdminReportsController } from "./admin-reports.controller";
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
    GamesModule,
    BooksModule,
    MusicModule,
    JobsModule,
    SecurityModule,
    UsersModule,
    ReportsModule,
  ],
  controllers: [
    AdminSystemController,
    AdminSecurityController,
    AdminJobsController,
    AdminUsersController,
    AdminEmailsController,
    AdminPushController,
    AdminCacheController,
    AdminImportsController,
    AdminReportsController,
  ],
  providers: [AdminService, AdminGuard, AdminStatsService, BackupService],
})
export class AdminModule {}
