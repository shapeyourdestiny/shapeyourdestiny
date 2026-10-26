"use client";

import { useEffect, useRef } from "react";
import styles from "./ConfirmModal.module.css";

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Focus the cancel button on mount
  useEffect(() => {
    const modal = modalRef.current;
    if (!modal) return;
    const cancelBtn = modal.querySelector("[data-cancel]");
    cancelBtn?.focus();
  }, []);

  return (
    <>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.modal} ref={modalRef} role="dialog" aria-modal="true">
        <h3 className={styles.title}>{title}</h3>
        <p className={styles.message}>{message}</p>
        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            data-cancel
          >
            {cancelLabel}
          </button>
          <button
            className={styles.confirmBtn}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </>
  );
}
