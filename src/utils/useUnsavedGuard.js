import { useCallback, useEffect, useRef } from "react";
import { useFeedback } from "../context/FeedbackContext";

export default function useUnsavedGuard(dirty, message = "Saqlanmagan o‘zgarishlar bor. Chiqsangiz, ular yo‘qoladi.") {
  const { confirm, registerUnsaved } = useFeedback();
  const guardId = useRef(`unsaved-${crypto.randomUUID()}`);

  useEffect(() => {
    if (dirty) registerUnsaved(guardId.current, { message });
    else registerUnsaved(guardId.current, null);
    return () => registerUnsaved(guardId.current, null);
  }, [dirty, message, registerUnsaved]);

  useEffect(() => {
    if (!dirty) return undefined;
    const beforeUnload = (event) => {
      event.preventDefault();
      event.returnValue = message;
      return message;
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [dirty, message]);

  return useCallback(async (action) => {
    if (!dirty) {
      action?.();
      return true;
    }
    const accepted = await confirm({
      title: "Saqlanmagan o‘zgarishlar",
      message,
      confirmLabel: "O‘zgarishsiz chiqish",
      cancelLabel: "Davom etish",
      tone: "danger",
    });
    if (accepted) action?.();
    return accepted;
  }, [dirty, message, confirm]);
}
