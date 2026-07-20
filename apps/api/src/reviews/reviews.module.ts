import { Module } from "@nestjs/common";
import { SocialModule } from "../social/social.module";
import { ReviewController } from "./review.controller";
import { ReviewService } from "./review.service";

// P4 reviews. Owning-a-review CRUD is always available (rating works offline);
// reading others' reviews is gated by SocialFeatureGuard on the controller.
// Imports SocialModule for the shared VisibilityService.
@Module({
  imports: [SocialModule],
  controllers: [ReviewController],
  providers: [ReviewService],
  exports: [ReviewService],
})
export class ReviewsModule {}
