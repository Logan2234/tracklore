import { Module } from "@nestjs/common";
import { MailModule } from "../mail/mail.module";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { PushService } from "./push.service";

// PrismaService comes from the global PrismaModule.
@Module({
  imports: [MailModule],
  controllers: [NotificationController],
  providers: [NotificationService, PushService],
})
export class NotificationModule {}
