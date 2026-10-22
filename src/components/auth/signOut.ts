import { authClient } from '@/lib/auth/authClient';

// Signs out and leaves for the login page with a full navigation (not
// router.push), so no signed-in client state or cached data survives.
export async function signOutToLogin(): Promise<void> {
  await authClient.signOut().catch(() => {});
  // eslint-disable-next-line @next/next/no-location-assign-relative-destination
  window.location.assign('/login');
}
