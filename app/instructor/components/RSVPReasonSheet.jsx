"use client";

import { useState } from "react";
import styles from "./RSVPReasonSheet.module.css";

export default function RSVPReasonSheet({
  open,
  onClose,
  onSubmit,
  required = false,
  loading = false,
}) {
  const [reason, setReason] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();
    if (required && !reason.trim()) return;
    onSubmit(reason.trim());
    setReason("");
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.handle} />
        <h3 className={styles.title}>Why can&apos;t you make it?</h3>
        {required && (
          <p className={styles.hint}>
            This event is required, so please let us know why you can&apos;t attend.
          </p>
        )}
        <form onSubmit={handleSubmit}>
          <textarea
            className={styles.textarea}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter your reason..."
            rows={3}
            maxLength={500}
            required={required}
            autoFocus
          />
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.submitBtn}
              disabled={loading || (required && !reason.trim())}
            >
              {loading ? "Submitting..." : "Submit"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
