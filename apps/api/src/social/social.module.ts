import { Module } from "@nestjs/common";
import { NotificationModule } from "../notifications/notification.module";
import { FollowService } from "./follow.service";
import { PrivacyController } from "./privacy.controller";
import { PrivacyService } from "./privacy.service";
import { ProfileService } from "./profile.service";
import { SocialController } from "./social.controller";
import { VisibilityService } from "./visibility.service";

// P4 social graph, profiles, search and privacy. Every route is gated behind
// SOCIAL_ENABLED via SocialFeatureGuard on the controllers.
@Module({
  imports: [NotificationModule],
  controllers: [SocialController, PrivacyController],
  providers: [VisibilityService, FollowService, ProfileService, PrivacyService],
  exports: [VisibilityService],
})
export class SocialModule {}
