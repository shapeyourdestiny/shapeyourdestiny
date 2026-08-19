"use client";

import { useState } from "react";
import styles from "./ActivityCard.module.css";

const ICONS = {
  yoga: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="4" r="2" />
      <path d="M12 8v4" />
      <path d="M8 14l4-2 4 2" />
      <path d="M6 20l4-6" />
      <path d="M18 20l-4-6" />
    </svg>
  ),
  movement: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <line x1="12" y1="4" x2="12" y2="20" />
      <line x1="4" y1="12" x2="20" y2="12" />
    </svg>
  ),
  team: (color) => (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" style={{ stroke: color }} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="7" r="2.5" />
      <circle cx="16" cy="7" r="2.5" />
      <circle cx="12" cy="16" r="2.5" />
      <path d="M9.5 9l2.5 5" />
      <path d="M14.5 9l-2.5 5" />
    </svg>
  ),
};

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
        <div className={styles.front}>
          <div className={styles.dotOverlay} />
          <div className={styles.iconBadge}>
            {ICONS[icon] && ICONS[icon](colorDark)}
          </div>
          {stopTag && <span className={styles.stopTag}>{stopTag}</span>}
          <h3 className={styles.title}>{title}</h3>
          <p className={styles.summary}>{summary}</p>
          <span className={styles.cta}>
            How We Help
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M2 4l3 3 3-3" />
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
