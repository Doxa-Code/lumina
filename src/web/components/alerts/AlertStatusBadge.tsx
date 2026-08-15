import { CheckCircle, XCircle, Bell, BellOff, Clock } from 'lucide-react';
import { cn } from '../../lib/utils';

export type AlertState = 'ok' | 'firing' | 'silenced' | 'pending';

interface AlertStatusBadgeProps {
  state: AlertState;
  className?: string;
}

const STATE_CONFIG: Record<
  AlertState,
  {
    label: string;
    icon: typeof CheckCircle;
    bgClass: string;
    textClass: string;
    iconClass: string;
  }
> = {
  ok: {
    label: 'OK',
    icon: CheckCircle,
    bgClass: 'bg-green-500/10',
    textClass: 'text-green-500',
    iconClass: 'text-green-500',
  },
  firing: {
    label: 'FIRING',
    icon: XCircle,
    bgClass: 'bg-red-500/10',
    textClass: 'text-red-500',
    iconClass: 'text-red-500',
  },
  silenced: {
    label: 'SILENCED',
    icon: BellOff,
    bgClass: 'bg-gray-500/10',
    textClass: 'text-gray-500',
    iconClass: 'text-gray-500',
  },
  pending: {
    label: 'PENDING',
    icon: Clock,
    bgClass: 'bg-yellow-500/10',
    textClass: 'text-yellow-500',
    iconClass: 'text-yellow-500',
  },
};

export function AlertStatusBadge({ state, className }: AlertStatusBadgeProps) {
  const config = STATE_CONFIG[state];
  const Icon = config.icon;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded font-medium',
        config.bgClass,
        config.textClass,
        className
      )}
    >
      <Icon className={cn('h-3 w-3', config.iconClass)} />
      {config.label}
    </span>
  );
}
