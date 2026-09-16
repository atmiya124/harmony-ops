import { AlertTriangle } from 'lucide-react';

export default function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-[rgba(244,114,182,0.3)] bg-[rgba(244,114,182,0.06)] p-8 text-center">
      <AlertTriangle size={24} className="text-[var(--neon-pink)]" />
      <p className="text-sm font-bold text-white">Couldn&rsquo;t load data</p>
      <p className="max-w-xs text-xs text-[var(--flat-text-faint)]">{message}</p>
    </div>
  );
}
