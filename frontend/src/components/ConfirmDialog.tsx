import { AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  confirmTone?: 'danger' | 'default';
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmTone = 'default',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null;

  const confirmClass = confirmTone === 'danger'
    ? 'bg-coral-500/20 border-coral-400/50 text-coral-100 hover:bg-coral-500/30'
    : 'bg-aqua-400/15 border-aqua-400/40 text-aqua-100 hover:bg-aqua-400/25';

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-midnight-950/70 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-cream-50/[0.10] bg-midnight-900 shadow-2xl overflow-hidden">
        <div className="px-5 py-4 border-b border-cream-50/[0.06] flex items-start gap-3">
          <div className="w-9 h-9 rounded-md bg-coral-500/15 border border-coral-400/35 grid place-items-center shrink-0">
            <AlertTriangle className="w-4 h-4 text-coral-300" />
          </div>
          <div>
            <h3 className="font-display italic text-cream-50 text-lg leading-tight">{title}</h3>
            <p className="text-sm text-dust-300 mt-1 leading-relaxed">{description}</p>
          </div>
        </div>

        <div className="px-5 py-4 flex items-center justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="h-9 px-3 rounded-md border border-cream-50/[0.12] bg-midnight-800/60 text-dust-200 hover:text-cream-50 hover:bg-midnight-800 transition mono-tick disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`h-9 px-3 rounded-md border transition mono-tick disabled:opacity-50 ${confirmClass}`}
          >
            {busy ? 'Working…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
