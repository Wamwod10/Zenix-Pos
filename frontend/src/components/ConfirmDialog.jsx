import { FiAlertTriangle } from "react-icons/fi";
import Modal from "./Modal";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = "Davom etasizmi?",
  message = "Bu amal muhim o‘zgarish kiritadi.",
  confirmLabel = "Tasdiqlash",
  cancelLabel = "Bekor qilish",
  tone = "danger",
  busy = false,
}) {
  return <Modal
    open={open}
    onClose={() => !busy && onClose?.()}
    title={title}
    subtitle={message}
    size="sm"
    closeOnBackdrop={!busy}
    footer={<>
      <button type="button" className="pro-btn secondary" disabled={busy} onClick={onClose}>{cancelLabel}</button>
      <button type="button" className={`pro-btn ${tone === "danger" ? "danger" : "primary"}`} disabled={busy} onClick={onConfirm}>{busy ? "Bajarilmoqda..." : confirmLabel}</button>
    </>}
  >
    <div className={`confirm-dialog-summary ${tone}`}><FiAlertTriangle /><span>{tone === "danger" ? "Bu amalni tasdiqlashdan oldin ma’lumotlarni tekshiring." : "Amalni davom ettirish uchun tasdiqlang."}</span></div>
  </Modal>;
}
