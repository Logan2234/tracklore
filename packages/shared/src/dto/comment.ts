import type { CommentEmote, CommentTargetType } from "../enums";
import type { UserSummaryDto } from "./social";

/** Reaction counts on a comment, one entry per emote actually used. */
export interface CommentReactionSummaryDto {
  emote: CommentEmote;
  count: number;
}

/** A comment or one of its (single-level) replies. */
export interface CommentDto {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  /** Null for a top-level comment, the parent's id for a reply. */
  parentId: string | null;
  /** Null once deleted — the client renders a tombstone instead. */
  text: string | null;
  deleted: boolean;
  edited: boolean;
  /** Raw author-set tag, for prefilling the edit form. */
  spoilerTag: boolean;
  /**
   * Whether this comment should render blurred for the viewer right now —
   * `spoilerTag` OR the auto progression-based gate. Recomputed per read,
   * never stored.
   */
  masked: boolean;
  createdAt: string;
  updatedAt: string;
  author: UserSummaryDto;
  reactions: CommentReactionSummaryDto[];
  /** The viewer's own active reaction, or null. */
  myReaction: CommentEmote | null;
  /** Only populated on top-level comments. */
  replies: CommentDto[];
}

/** A page of top-level comments (with their replies attached), oldest first. */
export interface CommentPageDto {
  comments: CommentDto[];
  nextCursor: string | null;
}

export interface CreateCommentDto {
  targetType: CommentTargetType;
  targetId: string;
  parentId?: string;
  text: string;
  spoilerTag?: boolean;
}

export interface UpdateCommentDto {
  text: string;
  spoilerTag?: boolean;
}
