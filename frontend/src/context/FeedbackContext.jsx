import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { FiAlertTriangle, FiCheckCircle, FiInfo, FiX } from "react-icons/fi";
import ConfirmDialog from "../components/ConfirmDialog";

const FeedbackContext = createContext(null);

const iconForTone = (tone) => tone === "danger" || tone === "warning" ? FiAlertTriangle : tone === "success" ? FiCheckCircle : FiInfo;

export function FeedbackProvider({ children }) {
  const [items, setItems] = useState([]);
  const [confirmState, setConfirmState] = useState(null);
  const confirmResolver = useRef(null);
  const timers = useRef(new Map());
  const unsavedEntries = useRef(new Map());

  useEffect(() => () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current.clear();
    confirmResolver.current?.(false);
    confirmResolver.current = null;
    unsavedEntries.current.clear();
  }, []);

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const notify = useCallback((payload = {}) => {
    const id = payload.id || crypto.randomUUID();
    const duration = Number(payload.duration ?? (payload.actionLabel ? 7000 : 4200));
    const item = {
      id,
      tone: payload.tone || "info",
      title: payload.title || "",
      message: payload.message || "",
      actionLabel: payload.actionLabel || "",
      onAction: payload.onAction,
    };
    setItems((current) => [...current.filter((entry) => entry.id !== id), item].slice(-4));
    if (duration > 0) {
      const timer = window.setTimeout(() => dismiss(id), duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  const undo = useCallback(({ title = "Amal bajarildi", message = "", onUndo, duration = 7000 } = {}) => notify({
    tone: "success",
    title,
    message,
    actionLabel: "Bekor qilish",
    duration,
    onAction: onUndo,
  }), [notify]);

  const confirm = useCallback((options = {}) => new Promise((resolve) => {
    confirmResolver.current?.(false);
    confirmResolver.current = resolve;
    setConfirmState({
      title: options.title || "Davom etasizmi?",
      message: options.message || "Bu amal muhim o‘zgarish kiritadi.",
      confirmLabel: options.confirmLabel || "Tasdiqlash",
      cancelLabel: options.cancelLabel || "Bekor qilish",
      tone: options.tone || "danger",
      requireText: options.requireText || "",
      requireTextLabel: options.requireTextLabel || "",
    });
  }), []);

  const resolveConfirm = useCallback((answer) => {
    const resolve = confirmResolver.current;
    confirmResolver.current = null;
    setConfirmState(null);
    resolve?.(answer);
  }, []);

  const registerUnsaved = useCallback((id, entry) => {
    if (!id) return;
    if (!entry) { unsavedEntries.current.delete(id); return; }
    unsavedEntries.current.set(id, {
      message: entry.message || "Saqlanmagan o‘zgarishlar bor. Chiqsangiz, ular yo‘qoladi.",
      title: entry.title || "Saqlanmagan o‘zgarishlar",
    });
  }, []);

  const guardNavigation = useCallback(async (action, options = {}) => {
    const entries = [...unsavedEntries.current.values()];
    if (!entries.length) { action?.(); return true; }
    const primary = entries[0] || {};
    const accepted = await confirm({
      title: options.title || primary.title || "Saqlanmagan o‘zgarishlar",
      message: options.message || (entries.length > 1
        ? `${primary.message || "Saqlanmagan o‘zgarishlar bor."} Yana ${entries.length - 1} ta ochiq forma saqlanmagan.`
        : primary.message || "Saqlanmagan o‘zgarishlar bor. Chiqsangiz, ular yo‘qoladi."),
      confirmLabel: options.confirmLabel || "O‘zgarishsiz chiqish",
      cancelLabel: options.cancelLabel || "Davom etish",
      tone: "danger",
    });
    if (accepted) action?.();
    return accepted;
  }, [confirm]);

  const value = useMemo(() => ({ notify, undo, dismiss, confirm, registerUnsaved, guardNavigation }), [notify, undo, dismiss, confirm, registerUnsaved, guardNavigation]);
  return <FeedbackContext.Provider value={value}>
    {children}
    <div className="zenix-toast-viewport" aria-live="polite" aria-atomic="false">
      {items.map((item) => {
        const Icon = iconForTone(item.tone);
        return <div key={item.id} className={`zenix-toast ${item.tone}`} role={item.tone === "danger" ? "alert" : "status"}>
          <span className="zenix-toast-icon"><Icon /></span>
          <span className="zenix-toast-copy">
            {item.title && <strong>{item.title}</strong>}
            {item.message && <small>{item.message}</small>}
          </span>
          {item.actionLabel && <button type="button" className="zenix-toast-action" onClick={() => {
            dismiss(item.id);
            item.onAction?.();
          }}>{item.actionLabel}</button>}
          <button type="button" className="zenix-toast-close" aria-label="Xabarni yopish" onClick={() => dismiss(item.id)}><FiX /></button>
        </div>;
      })}
    </div>
    <ConfirmDialog
      open={Boolean(confirmState)}
      onClose={() => resolveConfirm(false)}
      onConfirm={() => resolveConfirm(true)}
      title={confirmState?.title}
      message={confirmState?.message}
      confirmLabel={confirmState?.confirmLabel}
      cancelLabel={confirmState?.cancelLabel}
      tone={confirmState?.tone}
      confirmationText={confirmState?.requireText}
      confirmationLabel={confirmState?.requireTextLabel}
    />
  </FeedbackContext.Provider>;
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error("useFeedback must be used inside FeedbackProvider");
  return context;
}
