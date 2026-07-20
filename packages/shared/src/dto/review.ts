import type { ReviewTargetType, ReviewVisibility } from "../enums";
import type { UserSummaryDto } from "./social";

/** A review: a mandatory /10 rating + optional text on a target. */
export interface ReviewDto {
  id: string;
  targetType: ReviewTargetType;
  targetId: string;
  rating: number;
  text: string | null;
  visibility: ReviewVisibility;
  createdAt: string;
  updatedAt: string;
  author: UserSummaryDto;
}

/** One historised snapshot of a review (V1, V2, …), newest first. */
export interface ReviewRevisionDto {
  rating: number;
  text: string | null;
  createdAt: string;
}

/** Create-or-update a review for a target (identified by the route). */
export interface UpsertReviewDto {
  rating: number;
  text?: string | null;
  visibility?: ReviewVisibility;
}
