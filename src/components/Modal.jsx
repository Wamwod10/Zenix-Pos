import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";

// Multiple dialogs may close in the same render. Each must release one shared
// scroll lock, not restore its own stale "hidden" snapshot out of order.
let activeScrollLocks = 0;
let overflowBeforeFirstModal = "";
function lockBackgroundScroll() {
  const body = document.body;
  if (activeScrollLocks === 0) {
    overflowBeforeFirstModal = body.style.overflow;
    body.style.overflow = "hidden";
  }
  activeScrollLocks += 1;
  return () => {
    activeScrollLocks -= 1;
    if (activeScrollLocks === 0) body.style.overflow = overflowBeforeFirstModal;
  };
}

export default function Modal({ open, onClose, title, subtitle, children, size = "md", footer, closeOnBackdrop = true, className = "" }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const unlockScroll = lockBackgroundScroll();
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll('button,[href],input,select,textarea,[contenteditable="true"],[tabindex]:not([tabindex="-1"])') || [])
      .filter((el) => !el.disabled && !el.closest('[hidden],[inert],[aria-hidden="true"]') &&
        el.getClientRects().length > 0 && window.getComputedStyle(el).visibility !== "hidden");
    const preferredFocus = () => focusables().find((el) =>
      el.matches('[data-modal-autofocus],input:not([type="hidden"]),textarea,select,[contenteditable="true"]'));
    const id = window.setTimeout(() => {
      // Do not steal focus if the user has already tapped/clicked a field while
      // the modal is opening (especially noticeable on mobile keyboards).
      if (node?.contains(document.activeElement)) return;
      (preferredFocus() || focusables()[0] || node)?.focus();
    }, 10);
    const onKey = (event) => {
      // Only the topmost dialog may handle Escape or trap keyboard focus.
      // Nested dialogs otherwise close both layers on a single Escape.
      const top = [...document.querySelectorAll(".pro-modal-backdrop .pro-modal")].at(-1);
      if (top !== node) return;
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key === "Tab") {
        const list = focusables();
        if (!list.length) { event.preventDefault(); node?.focus(); return; }
        const first = list[0]; const last = list[list.length - 1];
        // The dialog must contain the focus even when a hidden responsive
        // control or programmatic focus change put it outside the modal.
        if (!list.includes(document.activeElement)) {
          event.preventDefault();
          (event.shiftKey ? last : first).focus();
        } else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      unlockScroll();
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return <div className="pro-modal-backdrop" role="presentation" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}>
    <section ref={ref} className={`pro-modal pro-modal-${size} ${className}`.trim()} role="dialog" aria-modal="true" aria-label={title} tabIndex={-1}>
      <div className="pro-modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="pro-icon-btn" onClick={onClose} aria-label="Yopish"><FiX /></button></div>
      <div className="pro-modal-body">{children}</div>
      {footer && <div className="pro-modal-footer">{footer}</div>}
    </section>
  </div>;
}
