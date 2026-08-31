"use client";

import { useState } from "react";
import Modal from "../components/Modal";
import styles from "./page.module.css";

export default function InviteActions({ inviteId, email }) {
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // 'cancel' | 'resend' | null

  const handleResend = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invite-codes/${inviteId}/resend`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || "Failed to resend");
      }
    } catch (err) {
      console.error("Failed to resend invite:", err);
    }
    setLoading(false);
    setModal(null);
    setTimeout(() => window.location.reload(), 300);
  };

  const handleCancel = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/invite-codes/${inviteId}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to cancel invite");
        setLoading(false);
        setModal(null);
        return;
      }
    } catch (err) {
      console.error("Failed to cancel invite:", err);
      alert("Failed to cancel invite");
      setLoading(false);
      setModal(null);
      return;
    }
    setLoading(false);
    setModal(null);
    setTimeout(() => window.location.reload(), 300);
  };

  return (
    <>
      <div className={styles.actionBtns}>
        <button
          onClick={() => setModal("resend")}
          className={styles.resendBtn}
          title="Resend invite"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 2L11 13" />
            <path d="M22 2L15 22L11 13L2 9L22 2Z" />
          </svg>
        </button>
        <button
          onClick={() => setModal("cancel")}
          className={styles.cancelBtn}
          title="Cancel invite"
          type="button"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18" />
            <path d="M6 6L18 18" />
          </svg>
        </button>
      </div>

      <Modal open={modal === "resend"} onClose={() => setModal(null)}>
        <div className={styles.modalContent}>
          <h3>Resend Invite?</h3>
          <p>Send another invite email{email ? ` to ${email}` : ""}.</p>
          <div className={styles.modalActions}>
            <button
              className={styles.modalSecondary}
              onClick={() => setModal(null)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              className="btn btnPrimary"
              onClick={handleResend}
              disabled={loading}
            >
              {loading ? "Sending..." : "Resend"}
            </button>
          </div>
        </div>
      </Modal>

      <Modal open={modal === "cancel"} onClose={() => setModal(null)}>
        <div className={styles.modalContent}>
          <h3>Cancel Invite?</h3>
          <p>This code will no longer work{email ? ` for ${email}` : ""}.</p>
          <div className={styles.modalActions}>
            <button
              className={styles.modalSecondary}
              onClick={() => setModal(null)}
              disabled={loading}
            >
              Keep It
            </button>
            <button
              className={styles.modalDanger}
              onClick={handleCancel}
              disabled={loading}
            >
              {loading ? "Canceling..." : "Cancel Invite"}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
