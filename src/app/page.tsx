import { getCurrentPartner } from '@/lib/auth/session';
import HomeDashboard from '@/components/home/HomeDashboard';
import Screen from '@/components/navigation/Screen';

// The app's landing screen. The root layout has already verified the
// session; this only needs the partner's name for the greeting.
export default async function HomePage() {
  const partner = await getCurrentPartner();
  const firstName = partner?.name.split(' ')[0] || '';
  return (
    <Screen title="Harmony Ops" logo backdrop="ember">
      <HomeDashboard firstName={firstName} />
    </Screen>
  );
}
