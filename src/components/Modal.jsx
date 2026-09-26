import { useEffect, useRef } from "react";
import { FiX } from "react-icons/fi";

export default function Modal({ open, onClose, title, subtitle, children, size = "md", footer, closeOnBackdrop = true }) {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const node = ref.current;
    const focusables = () => Array.from(node?.querySelectorAll('button,[href],input,select,textarea,[contenteditable="true"],[tabindex]:not([tabindex="-1"])') || []).filter((el) => !el.disabled && el.getAttribute("aria-hidden") !== "true");
    const preferredFocus = () => node?.querySelector('[data-modal-autofocus], input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled]), [contenteditable="true"]');
    const id = window.setTimeout(() => {
      // Do not steal focus if the user has already tapped/clicked a field while
      // the modal is opening (especially noticeable on mobile keyboards).
      if (node?.contains(document.activeElement)) return;
      (preferredFocus() || focusables()[0])?.focus();
    }, 10);
    const onKey = (event) => {
      if (event.key === "Escape") onCloseRef.current?.();
      if (event.key === "Tab") {
        const list = focusables();
        if (!list.length) return;
        const first = list[0]; const last = list[list.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = bodyOverflow;
      previous?.focus?.();
    };
  }, [open]);
  if (!open) return null;
  return <div className="pro-modal-backdrop" role="presentation" onMouseDown={(e) => { if (closeOnBackdrop && e.target === e.currentTarget) onClose?.(); }}>
    <section ref={ref} className={`pro-modal pro-modal-${size}`} role="dialog" aria-modal="true" aria-label={title}>
      <div className="pro-modal-head"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="pro-icon-btn" onClick={onClose} aria-label="Yopish"><FiX /></button></div>
      <div className="pro-modal-body">{children}</div>
      {footer && <div className="pro-modal-footer">{footer}</div>}
    </section>
  </div>;
}
