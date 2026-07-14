import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { NotificationModule } from "../notifications/notification.module";
import { AdminController } from "./admin.controller";
import { AdminGuard } from "./admin.guard";
import { AdminService } from "./admin.service";

@Module({
  imports: [MailModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService, AdminGuard],
})
export class AdminModule {}
