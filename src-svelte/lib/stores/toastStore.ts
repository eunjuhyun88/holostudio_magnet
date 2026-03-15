import { writable, derived } from 'svelte/store';

export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  duration: number;
  createdAt: number;
}

const MAX_VISIBLE = 5;
const DEFAULT_DURATION: Record<ToastType, number> = {
  info: 4000,
  success: 4000,
  warning: 5000,
  error: 6000,
};

let nextId = 1;

function createToastStore() {
  const { subscribe, update } = writable<Toast[]>([]);

  function add(type: ToastType, message: string, duration?: number) {
    const toast: Toast = {
      id: nextId++,
      type,
      message,
      duration: duration ?? DEFAULT_DURATION[type],
      createdAt: Date.now(),
    };

    update((toasts) => {
      const next = [...toasts, toast];
      // FIFO eviction if over max
      if (next.length > MAX_VISIBLE) {
        return next.slice(next.length - MAX_VISIBLE);
      }
      return next;
    });

    // Auto-remove after duration
    setTimeout(() => remove(toast.id), toast.duration);

    return toast.id;
  }

  function remove(id: number) {
    update((toasts) => toasts.filter((t) => t.id !== id));
  }

  function clear() {
    update(() => []);
  }

  return {
    subscribe,
    info: (msg: string, duration?: number) => add('info', msg, duration),
    success: (msg: string, duration?: number) => add('success', msg, duration),
    warning: (msg: string, duration?: number) => add('warning', msg, duration),
    error: (msg: string, duration?: number) => add('error', msg, duration),
    remove,
    clear,
  };
}

export const toastStore = createToastStore();
