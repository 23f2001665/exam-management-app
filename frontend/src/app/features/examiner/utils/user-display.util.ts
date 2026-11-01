import { User } from '../../../core/models';

/** Best-effort display name for a user record returned by the backend. */
export function displayName(user: User | undefined | null): string {
  if (!user) return '';
  if (user.full_name) return user.full_name;
  return [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
}
