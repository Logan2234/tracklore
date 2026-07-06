import { Controller, Get, HttpCode, HttpStatus, Post } from "@nestjs/common";
import type { NotificationFeedDto } from "@tracklore/shared";
import { CurrentUser } from "../auth/decorators/current-user.decorator";
import type { JwtPayload } from "../auth/decorators/current-user.decorator";
import { NotificationService } from "./notification.service";

@Controller("notifications")
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  /** Detect new episodes of tracked shows; returns the feed with fresh items. */
  @Post("scan")
  async scan(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    await this.notifications.scan(user.sub);
    return this.notifications.feed(user.sub);
  }

  @Get()
  feed(@CurrentUser() user: JwtPayload): Promise<NotificationFeedDto> {
    return this.notifications.feed(user.sub);
  }

  @HttpCode(HttpStatus.NO_CONTENT)
  @Post("read")
  async markAllRead(@CurrentUser() user: JwtPayload): Promise<void> {
    await this.notifications.markAllRead(user.sub);
  }
}
