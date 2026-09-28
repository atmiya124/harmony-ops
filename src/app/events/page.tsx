import { redirect } from 'next/navigation';

// The app's home is now the main dashboard at "/"; there is no separate
// Events home. Old links and bookmarks to /events land there.
export default function EventsIndexPage() {
  redirect('/');
}
