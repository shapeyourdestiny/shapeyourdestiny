"use client";

import { useState, useSyncExternalStore, useCallback } from "react";
import Link from "next/link";
import styles from "./SessionReviewReminder.module.css";

const DISMISS_KEY = "semester_review_reminder_dismissed";
const DISMISS_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const CLASS_DURATION_MS = 60 * 60 * 1000; // 1 hour - wait this long after class starts before showing

/**
 * Check if reminder was dismissed recently
 */
function isDismissed() {
  if (typeof window === "undefined") return true;
  const dismissedAt = localStorage.getItem(DISMISS_KEY);
  if (!dismissedAt) return false;
  const elapsed = Date.now() - parseInt(dismissedAt, 10);
  return elapsed < DISMISS_DURATION_MS;
}

/**
 * Check if class is likely still in session.
 * Returns true if less than 1 hour has passed since available_at.
 */
function isClassInSession(availableAt) {
  if (!availableAt) return false;
  const availableTime = new Date(availableAt).getTime();
  const now = Date.now();
  return now - availableTime < CLASS_DURATION_MS;
}

/**
 * Modal reminder for pending semester reviews.
 * Shows once per 24 hours when instructor has pending reviews.
 * Does not show during class (waits 1 hour after class starts).
 */
export default function SessionReviewReminder({ pendingReviews = [] }) {
  const [dismissed, setDismissed] = useState(false);

  // Check localStorage on mount (client-side only)
  const initiallyDismissed = useSyncExternalStore(
    useCallback(() => () => {}, []),
    () => isDismissed(),
    () => true // Server-side: assume dismissed to prevent hydration mismatch
  );

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  // Filter out reviews where class is still in session
  const readyReviews = pendingReviews.filter((r) => !isClassInSession(r.available_at));

  const shouldShow = readyReviews.length > 0 && !initiallyDismissed && !dismissed;

  if (!shouldShow) {
    return null;
  }

  // Format due date
  const formatDueDate = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "Overdue";
    if (diffDays === 0) return "Due today";
    if (diffDays === 1) return "Due tomorrow";
    return `Due in ${diffDays} days`;
  };

  const review = readyReviews[0];
  const schoolName = review.school_name || "your school";
  const isOverdue = new Date(review.due_date + "T00:00:00") < new Date().setHours(0, 0, 0, 0);

  return (
    <div className={styles.overlay} role="dialog" aria-modal="true" aria-labelledby="review-reminder-title">
      <div className={styles.modal}>
        <div className={styles.iconWrap}>
          <svg viewBox="0 0 24 24" fill="currentColor" className={styles.icon}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>

        <h2 id="review-reminder-title" className={styles.title}>
          {isOverdue ? "Semester Review Overdue" : "Semester Review Due"}
        </h2>

        <p className={styles.message}>
          {readyReviews.length === 1 ? (
            <>
              Your semester review for <strong>{schoolName}</strong> is {formatDueDate(review.due_date).toLowerCase()}.
            </>
          ) : (
            <>
              You have <strong>{readyReviews.length} semester reviews</strong> waiting for your feedback.
            </>
          )}
        </p>

        <div className={styles.actions}>
          <button type="button" className={styles.laterBtn} onClick={handleDismiss}>
            Remind me later
          </button>
          <Link
            href={`/instructor/review/${review.id}`}
            className={styles.reviewBtn}
            onClick={handleDismiss}
          >
            Complete Review
          </Link>
        </div>
      </div>
    </div>
  );
}
