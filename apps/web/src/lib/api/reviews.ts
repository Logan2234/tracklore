import type {
  MyReviewDto,
  ReviewDto,
  ReviewRevisionDto,
  ReviewTargetType,
  ReviewVisibility,
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

/** Bulk-delete the given reviews (by review id). Returns the count deleted. */
export function batchDeleteReviews(ids: string[]): Promise<{ count: number }> {
  return request("/reviews/me/batch/delete", { method: "POST", body: { ids } });
}

/** Bulk-set the audience of the given reviews. Returns the count updated. */
export function batchSetReviewVisibility(
  ids: string[],
  visibility: ReviewVisibility,
): Promise<{ count: number }> {
  return request("/reviews/me/batch/visibility", {
    method: "POST",
    body: { ids, visibility },
  });
}
