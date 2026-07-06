import type { MediaType } from "../enums";

/** One in-app notification. Today only "new episode out" of a tracked show. */
export interface NotificationDto {
  id: string;
  /** "NEW_EPISODE" for now; kept open for future kinds. */
  type: string;
  mediaTitle: string;
  mediaType: MediaType;
  /** Catalogue id, to link to /media/:type/:sourceId. */
  sourceId: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string | null;
  read: boolean;
  /** ISO creation date. */
  createdAt: string;
}

export interface NotificationFeedDto {
  notifications: NotificationDto[];
  /** Count of unread notifications. */
  unread: number;
}
