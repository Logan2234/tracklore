import type {
  MyReviewDto,
  ReviewDto,
  ReviewRevisionDto,
  ReviewTargetType,
  UpsertReviewDto,
} from "@tracklore/shared";
import { request } from "./core";

export function getMyReviews(): Promise<MyReviewDto[]> {
  return request("/reviews/me");
}

export function upsertReview(
  targetType: ReviewTargetType,
  targetId: string,
  body: UpsertReviewDto,
): Promise<ReviewDto> {
  return request(`/reviews/me/${targetType}/${encodeURIComponent(targetId)}`, {
    method: "PUT",
    body,
  });
}

export function deleteReview(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<void> {
  return request(`/reviews/me/${targetType}/${encodeURIComponent(targetId)}`, {
    method: "DELETE",
  });
}

export function getReviewRevisions(
  targetType: ReviewTargetType,
  targetId: string,
): Promise<ReviewRevisionDto[]> {
  return request(
    `/reviews/me/${targetType}/${encodeURIComponent(targetId)}/revisions`,
  );
}
