import { Module } from "@nestjs/common";
import { NotificationController } from "./notification.controller";
import { NotificationService } from "./notification.service";
import { PushService } from "./push.service";

// PrismaService comes from the global PrismaModule.
@Module({
  controllers: [NotificationController],
  providers: [NotificationService, PushService],
})
export class NotificationModule {}
