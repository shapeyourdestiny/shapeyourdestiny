"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./Modal.module.css";

export default function Modal({ open, onClose, children }) {
  // Track if component is mounted (client-side only)
  const [mounted, setMounted] = useState(false);

  // Set mounted state after initial render
  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
  }, []);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  if (!open || !mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>,
    document.body
  );
}
