import { api } from "./client";
import type { UserSummary, ProjectMember, User } from "../types/api";

const userCache = new Map<number, UserSummary>();
const pending = new Map<number, Promise<UserSummary>>();

/** Seed the cache with known users */
export function seedUsersFromMembers(members: ProjectMember[]): void {
  for (const m of members) {
    if (!userCache.has(m.user_id)) {
      userCache.set(m.user_id, {
        user_id: m.user_id,
        username: m.username,
        first_name: m.first_name,
        last_name: m.last_name,
      });
    }
  }
}

export function seedUserFromCurrent(user: User | null): void {
  if (!user) return;
  if (!userCache.has(user.user_id)) {
    userCache.set(user.user_id, {
      user_id: user.user_id,
      username: user.username,
      first_name: user.first_name,
      last_name: user.last_name,
    });
  }
}

/** Get a UserSummary from a given id, using cache and de-duplicated API calls */
export async function getUserSummaryCached(
  userId: number
): Promise<UserSummary | null> {
  if (userCache.has(userId)) {
    const summary = userCache.get(userId);
    if (summary !== undefined) {
      return summary;
    }
  }
  if (pending.has(userId)) {
    const summary = pending.get(userId);
    if (summary !== undefined) {
      return summary;
    }
  }

  const promise = api
    .get_user(userId)
    .then((res) => {
      userCache.set(userId, res.user);
      pending.delete(userId);
      return res.user;
    })
    .catch((err) => {
      pending.delete(userId);
      throw err;
    });

  pending.set(userId, promise);
  return promise;
}

/**
 * Best effort synch formatter. Does NOT trigger network calls, only uses cache
 *
 * Not sure if I'll even use this right now
 */
export function formatUserSync(userId: number | null | undefined): string {
  if (userId == null) {
    return "Unassigned";
  }
  const entry = userCache.get(userId);
  if (!entry) {
    return `User #${userId}`;
  }
  return `${entry.first_name} ${entry.last_name} (${entry.username})`;
}
