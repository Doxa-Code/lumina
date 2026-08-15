import { X, CheckCircle2, XCircle, Info } from 'lucide-react';
import { cn } from '../../lib/utils';
import type { Toast } from '../../hooks/useToast';

interface ToastContainerProps {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
      ))}
    </div>
  );
}

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const icons = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
  };

  const Icon = icons[toast.type];

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-4 py-3 shadow-brutalist border-2 animate-in slide-in-from-right-full',
        'bg-card text-card-foreground',
        toast.type === 'success' && 'border-primary',
        toast.type === 'error' && 'border-destructive',
        toast.type === 'info' && 'border-foreground'
      )}
    >
      <Icon
        className={cn(
          'h-4 w-4',
          toast.type === 'success' && 'text-primary',
          toast.type === 'error' && 'text-destructive',
          toast.type === 'info' && 'text-foreground'
        )}
      />
      <span className="text-sm font-mono">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="ml-2 text-muted-foreground hover:text-foreground hover:bg-accent p-1 border border-transparent hover:border-border"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
