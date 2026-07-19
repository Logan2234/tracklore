import { ProfileAccess, VisibilityAudience } from "@tracklore/shared";

/**
 * The viewer's raw relationship to a target user (viewer's point of view).
 * `blockedByTarget` is internal — it collapses the relationship to "nothing"
 * and is never surfaced (a target who blocked the viewer reads as not-found).
 */
export interface ViewerRelation {
  isSelf: boolean;
  /** Accepted outgoing follow: viewer follows target. */
  following: boolean;
  /** Pending outgoing follow: viewer requested a PRIVATE target. */
  requested: boolean;
  /** Accepted incoming follow: target follows viewer. */
  followsYou: boolean;
  /** Viewer may see the target's FRIENDS-audience content. */
  isFriend: boolean;
  /** Viewer blocked target. */
  blocking: boolean;
  /** Target blocked viewer (internal). */
  blockedByTarget: boolean;
}

/** Audience assumed when a user hasn't set a VisibilitySetting for a facet. */
export const DEFAULT_FACET_AUDIENCE: VisibilityAudience =
  VisibilityAudience.FRIENDS;

/**
 * Whether the viewer counts as a "friend" of the target — the FRIENDS audience.
 * - PUBLIC target: friendship requires a *mutual* accepted follow (following
 *   a public profile is frictionless, so mere followers aren't friends).
 * - PRIVATE target: an accepted follow already means the target approved the
 *   request (Instagram-style), so the follower is friend-level on its own.
 * - GHOST: never (can't form reciprocal links).
 */
export function computeIsFriend(
  access: ProfileAccess,
  following: boolean,
  followsYou: boolean,
): boolean {
  if (access === ProfileAccess.GHOST) return false;
  if (access === ProfileAccess.PRIVATE) return following;
  return following && followsYou;
}

/** Whether the viewer may open the target's profile at all. */
export function canAccessProfile(
  access: ProfileAccess,
  relation: ViewerRelation,
): boolean {
  if (relation.isSelf) return true;
  if (relation.blocking || relation.blockedByTarget) return false;
  if (access === ProfileAccess.GHOST) return false;
  if (access === ProfileAccess.PUBLIC) return true;
  return relation.following; // PRIVATE: only an approved follower.
}

/**
 * Whether the viewer may see one passive-content facet, given its stored
 * audience. `profileAccess` acts as a cap: a PRIVATE profile can't expose a
 * facet to PUBLIC, so a PUBLIC setting is lowered to FRIENDS.
 */
export function resolveFacet(
  access: ProfileAccess,
  setting: VisibilityAudience,
  relation: ViewerRelation,
): boolean {
  if (relation.isSelf) return true;
  if (relation.blocking || relation.blockedByTarget) return false;
  if (access === ProfileAccess.GHOST) return false;

  let effective = setting;

  if (
    access === ProfileAccess.PRIVATE &&
    effective === VisibilityAudience.PUBLIC
  ) {
    effective = VisibilityAudience.FRIENDS;
  }

  switch (effective) {
    case VisibilityAudience.NONE:
      return false;
    case VisibilityAudience.FRIENDS:
      return relation.isFriend;
    case VisibilityAudience.PUBLIC:
      // Only reachable when access is PUBLIC (cap above): any logged-in,
      // non-blocked viewer qualifies (all social is behind auth + the FF).
      return true;
    default:
      return false;
  }
}
