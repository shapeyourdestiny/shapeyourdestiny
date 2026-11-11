"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import styles from "./MapsPreferenceModal.module.css";
import { updateMapsPreference } from "@/lib/instructor/actions";
import { isApplePlatform, getDirectionsUrlForApp } from "@/lib/maps";

export default function MapsPreferenceModal({
  open,
  onClose,
  address,
  onNavigate,
}) {
  const router = useRouter();
  const [selected, setSelected] = useState(null);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [showApple, setShowApple] = useState(false);

  // Check platform on mount
  useEffect(() => {
    setShowApple(isApplePlatform());
  }, []);

  const handleContinue = async () => {
    if (!selected) return;

    // Save preference if remember is checked
    if (remember) {
      setLoading(true);
      await updateMapsPreference(selected);
      setLoading(false);
      router.refresh();
    }

    // Navigate to maps
    const url = getDirectionsUrlForApp(address, selected);
    onNavigate?.(url);
    onClose();
  };

  if (!open) return null;

  const options = [
    ...(showApple ? [{
      id: "apple",
      label: "Apple Maps",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      ),
    }] : []),
    {
      id: "google",
      label: "Google Maps",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      ),
    },
    {
      id: "waze",
      label: "Waze",
      icon: (
        <svg viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.54 6.63c-1.28-2.74-3.91-4.63-6.83-4.63-2.38 0-4.43 1.05-5.77 2.66-1.2-.23-2.49.08-3.52.83-1.39 1-2.18 2.63-2.18 4.31 0 .99.27 1.96.78 2.8-.14.48-.22.98-.22 1.5 0 3.31 3.13 6 7 6h7c3.31 0 6-2.24 6-5 0-1.51-.71-2.92-1.91-3.91.13-.5.18-1.02.18-1.55 0-1.1-.24-2.19-.68-3.13.06.04.12.08.15.12zM8.5 14c-.83 0-1.5-.67-1.5-1.5S7.67 11 8.5 11s1.5.67 1.5 1.5S9.33 14 8.5 14zm7 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/>
        </svg>
      ),
    },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Open directions in...</h2>

        <div className={styles.options}>
          {options.map((opt) => (
            <button
              key={opt.id}
              className={`${styles.option} ${selected === opt.id ? styles.selected : ""}`}
              onClick={() => setSelected(opt.id)}
            >
              <span className={styles.optionIcon}>{opt.icon}</span>
              <span className={styles.optionLabel}>{opt.label}</span>
              {selected === opt.id && (
                <svg className={styles.checkmark} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </button>
          ))}
        </div>

        <label className={styles.rememberRow}>
          <input
            type="checkbox"
            checked={remember}
            onChange={(e) => setRemember(e.target.checked)}
          />
          <span>Remember my choice</span>
        </label>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button
            className={styles.continueBtn}
            onClick={handleContinue}
            disabled={!selected || loading}
          >
            {loading ? "Saving..." : "Continue"}
          </button>
        </div>
      </div>
    </div>
  );
}
