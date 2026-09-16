import { LucideIcon } from 'lucide-react';

interface ActionLinkProps {
  icon: LucideIcon;
  label: string;
  color: string;
  href?: string;
  onClick?: () => void;
}

export default function ActionLink({ icon: Icon, label, color, href, onClick }: ActionLinkProps) {
  const disabled = !href && !onClick;
  return (
    <a
      href={href ?? undefined}
      onClick={onClick}
      className="flex flex-1 flex-col items-center gap-1 rounded-xl py-3"
      style={{ backgroundColor: disabled ? 'var(--flat-surface-input)' : color, pointerEvents: disabled ? 'none' : 'auto', cursor: onClick ? 'pointer' : undefined }}
    >
      <Icon size={17} color={disabled ? 'var(--flat-text-fainter)' : '#0a0a0a'} />
      <span className="text-[11px] font-bold" style={{ color: disabled ? 'var(--flat-text-fainter)' : '#0a0a0a' }}>
        {label}
      </span>
    </a>
  );
}
