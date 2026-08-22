import React from 'react';
import { AlertTriangle, CheckCircle2, Info, X } from 'lucide-react';
import { useToast } from '../context/toastContext';

const icons = {
  error: AlertTriangle,
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle
};

const ToastViewport = () => {
  const { toasts, dismissToast } = useToast();

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => {
        const Icon = icons[toast.type] || Info;

        return (
          <div className={`toast toast-${toast.type}`} key={toast.id}>
            <Icon size={17} />
            <div className="toast-copy">
              <strong>{toast.title}</strong>
              {toast.message && <span>{toast.message}</span>}
            </div>
            <button
              className="toast-dismiss"
              onClick={() => dismissToast(toast.id)}
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastViewport;
