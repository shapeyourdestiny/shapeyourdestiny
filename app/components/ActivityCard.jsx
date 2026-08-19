"use client";

import { useState } from "react";
import styles from "./ActivityCard.module.css";

const ICONS = {
  yoga: (color) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="6" r="3" />
      <path d="M16 11v6M16 17l-6 8M16 17l6 8M8 14l8 3 8-3" />
    </svg>
  ),
  movement: (color) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="16" cy="16" r="10" />
      <line x1="16" y1="6" x2="16" y2="26" />
      <line x1="6" y1="16" x2="26" y2="16" />
      <circle cx="16" cy="16" r="3" fill={color} stroke="none" />
    </svg>
  ),
  team: (color) => (
    <svg width="32" height="32" viewBox="0 0 32 32" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="10" cy="10" r="4" />
      <circle cx="22" cy="10" r="4" />
      <circle cx="16" cy="22" r="4" />
      <line x1="13" y1="12" x2="14" y2="19" />
      <line x1="19" y1="12" x2="18" y2="19" />
      <line x1="13" y1="10" x2="19" y2="10" />
    </svg>
  ),
};

/**
 * Flip card matching the live site's interaction:
 * front = colored summary card, click flips to back = illustration + full copy + close (x).
 */
export default function ActivityCard({
  color,
  colorDark,
  title,
  summary,
  fullText,
  illustrationSrc,
  icon,
  stopTag,
  rotation = 0,
}) {
  const [flipped, setFlipped] = useState(false);

  const cardStyle = {
    '--card-color': color,
    '--card-color-dark': colorDark,
    '--card-rotation': `${rotation}deg`,
  };

  return (
    <div
      className={styles.scene}
      onClick={() => setFlipped((f) => !f)}
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={`${title}, click to ${flipped ? "close" : "read more"}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setFlipped((f) => !f);
        }
      }}
    >
      <div
        className={`${styles.card} ${flipped ? styles.isFlipped : ""}`}
        style={cardStyle}
      >
        {/* FRONT */}
        <div className={styles.face}>
          <div className={styles.dotOverlay} />
          <div className={styles.iconBadge}>
            {ICONS[icon] && ICONS[icon](colorDark)}
          </div>
          {stopTag && <span className={styles.stopTag}>{stopTag}</span>}
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.summary}>{summary}</p>
          <span className={styles.cta}>
            How We Help
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M6 3v6M3 7l3 3 3-3" />
            </svg>
          </span>
        </div>

        {/* BACK */}
        <div className={`${styles.face} ${styles.back}`}>
          <button
            className={styles.close}
            aria-label="Close"
            onClick={(e) => {
              e.stopPropagation();
              setFlipped(false);
            }}
          >
            ×
          </button>
          {illustrationSrc && (
            <img className={styles.illustration} src={illustrationSrc} alt="" />
          )}
          <h3 className={styles.titleDark}>{title}</h3>
          <p className={styles.body}>{fullText}</p>
        </div>
      </div>
    </div>
  );
}
