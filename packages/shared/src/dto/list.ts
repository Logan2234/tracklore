import type { ListKind, ListVisibility, ReviewTargetType } from "../enums";
import type { ReviewTargetSummaryDto } from "./review";
import type { UserSummaryDto } from "./social";

/** Work-level target types a list item may reference — no SEASON/EPISODE. */
export type ListItemTargetType = Extract<
  ReviewTargetType,
  "MEDIA" | "GAME" | "BOOK" | "MUSIC"
>;

/** One work in a list, with its resolved display info. */
export interface ListItemDto {
  id: string;
  targetType: ListItemTargetType;
  targetId: string;
  position: number;
  addedAt: string;
  target: ReviewTargetSummaryDto | null;
}

/** A list's own metadata, without its items (see `ListDetailDto` for those). */
export interface ListDto {
  id: string;
  title: string;
  description: string | null;
  kind: ListKind;
  visibility: ListVisibility;
  createdAt: string;
  updatedAt: string;
  author: UserSummaryDto;
}

/** A list plus its items, ordered by `position` — the single-list view. */
export interface ListDetailDto extends ListDto {
  items: ListItemDto[];
}

/** A list plus a lightweight preview, for "Mes listes" and profile carousels. */
export interface MyListDto extends ListDto {
  itemCount: number;
  /**
   * Covers of up to the first 4 items, oldest-position first, for the
   * collage preview (1 image = full cover, 2-4 = a quadrant grid). Empty
   * when the list has no items yet.
   */
  previewImageUrls: string[];
}

export interface CreateListDto {
  title: string;
  description?: string | null;
  kind: ListKind;
  visibility?: ListVisibility;
}

export interface UpdateListDto {
  title?: string;
  description?: string | null;
  visibility?: ListVisibility;
  /** Changing kind is a display-only switch — RANKED/COLLECTION share the same storage. */
  kind?: ListKind;
}

export interface AddListItemDto {
  targetType: ListItemTargetType;
  targetId: string;
}

/** Full replacement order — the whole list's item ids, new order first. */
export interface ReorderListItemsDto {
  orderedItemIds: string[];
}

/** Which of the user's own lists already contain a target, keyed by list id (value = item id). */
export type ListMembershipDto = Record<string, string>;
