import {
  AnimatePresence,
  motion,
  useReducedMotion,
  type PanInfo,
} from "framer-motion";
import { Check, X } from "lucide-react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FocusEvent,
  type PropsWithChildren,
} from "react";

import "./success-toast.css";

const DEFAULT_TITLE = "Success";
const DEFAULT_MESSAGE = "Your action was completed successfully!";
const DEFAULT_DISMISS_ARIA = "Dismiss success notification";
const DEFAULT_DURATION_MS = 4_500;
const PROGRESS_TICK_MS = 80;
const SWIPE_DISMISS_OFFSET_PX = 72;
const SWIPE_DISMISS_VELOCITY = 550;

interface SuccessToastOptions {
  title?: string;
  message?: string;
  durationMs?: number;
  dismissible?: boolean;
  showProgress?: boolean;
}

interface SuccessToastItem {
  id: string;
  title: string;
  message: string;
  durationMs: number;
  dismissible: boolean;
  showProgress: boolean;
}

interface SuccessToastContextValue {
  showSuccessToast: (options?: SuccessToastOptions) => string;
  dismissSuccessToast: (toastId: string) => void;
  clearSuccessToasts: () => void;
}

const SuccessToastContext = createContext<SuccessToastContextValue | null>(
  null,
);

export function SuccessToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<SuccessToastItem[]>([]);

  const dismissSuccessToast = useCallback((toastId: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== toastId));
  }, []);

  const clearSuccessToasts = useCallback(() => {
    setToasts([]);
  }, []);

  const showSuccessToast = useCallback((options?: SuccessToastOptions) => {
    const toastId = crypto.randomUUID();

    const nextToast: SuccessToastItem = {
      id: toastId,
      title: options?.title ?? DEFAULT_TITLE,
      message: options?.message ?? DEFAULT_MESSAGE,
      durationMs:
        typeof options?.durationMs === "number" && options.durationMs > 0
          ? options.durationMs
          : DEFAULT_DURATION_MS,
      dismissible: options?.dismissible ?? true,
      showProgress: options?.showProgress ?? true,
    };

    setToasts((current) => [nextToast, ...current].slice(0, 5));

    return toastId;
  }, []);

  const contextValue = useMemo<SuccessToastContextValue>(
    () => ({
      showSuccessToast,
      dismissSuccessToast,
      clearSuccessToasts,
    }),
    [clearSuccessToasts, dismissSuccessToast, showSuccessToast],
  );

  return (
    <SuccessToastContext.Provider value={contextValue}>
      {children}
      <SuccessToastViewport
        toasts={toasts}
        onDismiss={dismissSuccessToast}
        dismissAriaLabel={DEFAULT_DISMISS_ARIA}
      />
    </SuccessToastContext.Provider>
  );
}

export function useSuccessToast() {
  const context = useContext(SuccessToastContext);

  if (!context) {
    throw new Error(
      "useSuccessToast must be used inside SuccessToastProvider.",
    );
  }

  return context;
}

interface SuccessToastViewportProps {
  toasts: SuccessToastItem[];
  onDismiss: (toastId: string) => void;
  dismissAriaLabel: string;
}

function SuccessToastViewport({
  toasts,
  onDismiss,
  dismissAriaLabel,
}: SuccessToastViewportProps) {
  return (
    <div
      className="success-toast-viewport"
      aria-live="polite"
      aria-relevant="additions text"
      aria-atomic="false"
    >
      <AnimatePresence initial={false}>
        {toasts.map((toast, index) => (
          <SuccessToastCard
            key={toast.id}
            toast={toast}
            onDismiss={onDismiss}
            stackIndex={index}
            dismissAriaLabel={dismissAriaLabel}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

interface SuccessToastCardProps {
  toast: SuccessToastItem;
  onDismiss: (toastId: string) => void;
  stackIndex: number;
  dismissAriaLabel: string;
}

function SuccessToastCard({
  toast,
  onDismiss,
  stackIndex,
  dismissAriaLabel,
}: SuccessToastCardProps) {
  const prefersReducedMotion = useReducedMotion();
  const [remainingMs, setRemainingMs] = useState(toast.durationMs);
  const [isCoarsePointer, setIsCoarsePointer] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  const remainingMsRef = useRef(toast.durationMs);
  const timeoutRef = useRef<number | null>(null);
  const intervalRef = useRef<number | null>(null);
  const startAtMsRef = useRef(0);
  const frameDurationRef = useRef(toast.durationMs);

  const clearTimers = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const updateRemainingMs = useCallback((value: number) => {
    remainingMsRef.current = value;
    setRemainingMs(value);
  }, []);

  const startCountdown = useCallback(
    (nextRemainingMs: number) => {
      clearTimers();

      frameDurationRef.current = nextRemainingMs;
      startAtMsRef.current = performance.now();
      updateRemainingMs(nextRemainingMs);

      timeoutRef.current = window.setTimeout(() => {
        onDismiss(toast.id);
      }, nextRemainingMs);

      intervalRef.current = window.setInterval(() => {
        const elapsedMs = performance.now() - startAtMsRef.current;
        const nextMs = Math.max(frameDurationRef.current - elapsedMs, 0);
        updateRemainingMs(nextMs);
      }, PROGRESS_TICK_MS);
    },
    [clearTimers, onDismiss, toast.id, updateRemainingMs],
  );

  const pauseCountdown = useCallback(() => {
    if (isPaused) {
      return;
    }

    const elapsedMs = performance.now() - startAtMsRef.current;
    const nextRemainingMs = Math.max(frameDurationRef.current - elapsedMs, 0);
    updateRemainingMs(nextRemainingMs);
    clearTimers();
    setIsPaused(true);
  }, [clearTimers, isPaused, updateRemainingMs]);

  const resumeCountdown = useCallback(() => {
    if (!isPaused) {
      return;
    }

    setIsPaused(false);
    startCountdown(remainingMsRef.current);
  }, [isPaused, startCountdown]);

  const dismissToast = useCallback(() => {
    clearTimers();
    onDismiss(toast.id);
  }, [clearTimers, onDismiss, toast.id]);

  const handleBlurCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      if (event.currentTarget.contains(event.relatedTarget)) {
        return;
      }
      resumeCountdown();
    },
    [resumeCountdown],
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const shouldDismiss =
        Math.abs(info.offset.x) > SWIPE_DISMISS_OFFSET_PX ||
        Math.abs(info.velocity.x) > SWIPE_DISMISS_VELOCITY;

      if (shouldDismiss) {
        dismissToast();
      }
    },
    [dismissToast],
  );

  useEffect(() => {
    startCountdown(toast.durationMs);

    return () => {
      clearTimers();
    };
  }, [clearTimers, startCountdown, toast.durationMs]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(pointer: coarse)");

    const applyPointerMode = () => {
      setIsCoarsePointer(mediaQuery.matches);
    };

    applyPointerMode();

    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyPointerMode);
      return () => mediaQuery.removeEventListener("change", applyPointerMode);
    }

    mediaQuery.addListener(applyPointerMode);
    return () => mediaQuery.removeListener(applyPointerMode);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.hidden) {
        pauseCountdown();
      } else {
        resumeCountdown();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [pauseCountdown, resumeCountdown]);

  useEffect(() => {
    if (stackIndex !== 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        dismissToast();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [dismissToast, stackIndex]);

  const progress = Math.max(0, Math.min(1, remainingMs / toast.durationMs));
  const depthScale = Math.max(1 - stackIndex * 0.015, 0.955);
  const depthOpacity = Math.max(1 - stackIndex * 0.06, 0.8);
  const depthBlur = Math.min(stackIndex * 0.45, 1.4);

  return (
    <motion.article
      layout
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="success-toast"
      style={{
        opacity: depthOpacity,
        scale: depthScale,
        filter: `blur(${depthBlur}px)`,
      }}
      initial={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 22, scale: 0.97 }
      }
      animate={
        prefersReducedMotion ? { opacity: 1 } : { opacity: 1, x: 0, scale: 1 }
      }
      exit={
        prefersReducedMotion
          ? { opacity: 0 }
          : { opacity: 0, x: 20, scale: 0.96 }
      }
      transition={
        prefersReducedMotion
          ? { duration: 0.12 }
          : {
              opacity: { duration: 0.18 },
              layout: { duration: 0.2, ease: [0.22, 1, 0.36, 1] },
              type: "spring",
              stiffness: 440,
              damping: 31,
              mass: 0.86,
            }
      }
      drag={isCoarsePointer ? "x" : false}
      dragElastic={0.14}
      dragMomentum={false}
      onDragEnd={handleDragEnd}
      onMouseEnter={pauseCountdown}
      onMouseLeave={resumeCountdown}
      onFocusCapture={pauseCountdown}
      onBlurCapture={handleBlurCapture}
    >
      <span className="success-toast__icon" aria-hidden="true">
        <Check size={14} strokeWidth={3} />
      </span>

      <div className="success-toast__content">
        <p className="success-toast__title">{toast.title}</p>
        <p className="success-toast__message">{toast.message}</p>
      </div>

      {toast.dismissible ? (
        <button
          type="button"
          className="success-toast__close"
          onClick={dismissToast}
          aria-label={dismissAriaLabel}
        >
          <X size={14} />
        </button>
      ) : null}

      {toast.showProgress ? (
        <span className="success-toast__progress-track" aria-hidden="true">
          <motion.span
            className="success-toast__progress-fill"
            style={{ scaleX: progress }}
          />
        </span>
      ) : null}
    </motion.article>
  );
}
