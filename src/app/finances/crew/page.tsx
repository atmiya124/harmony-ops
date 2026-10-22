import Screen from '@/components/navigation/Screen';
import CrewList from '@/components/crew/CrewList';

// The crew / contractor directory, opened from the Finances "Crew" row.
export default function CrewPage() {
  return (
    <Screen title="Crew" back>
      <CrewList />
    </Screen>
  );
}
