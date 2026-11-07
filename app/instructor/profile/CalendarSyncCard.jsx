"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import styles from "./CalendarSync.module.css";
import {
  enableCalendarSync,
  disableCalendarSync,
  resetCalendarToken,
  updateCalendarApp,
} from "@/lib/calendar/actions";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";

const CALENDAR_APPS = {
  apple: "Apple Calendar",
  google: "Google Calendar",
  outlook: "Outlook",
  other: "your calendar",
};

export default function CalendarSyncCard({ feed: initialFeed }) {
  const [feed, setFeed] = useState(initialFeed);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [confirmDisable, setConfirmDisable] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);

  const isEnabled = feed?.enabled;
  const calendarAppLabel = CALENDAR_APPS[feed?.calendar_app] || "your calendar";

  const handleToggle = async () => {
    if (isEnabled) {
      setConfirmDisable(true);
      return;
    }

    setLoading(true);
    const result = await enableCalendarSync();
    setLoading(false);

    if (result.success) {
      setFeed({ ...feed, enabled: true, token: result.token });
      setSheetOpen(true);
    }
  };

  const handleConfirmDisable = async () => {
    setLoading(true);
    await disableCalendarSync();
    setFeed({ ...feed, enabled: false });
    setConfirmDisable(false);
    setLoading(false);
  };

  const handleResetLink = () => {
    setConfirmReset(true);
  };

  const handleConfirmReset = async () => {
    setLoading(true);
    const result = await resetCalendarToken();
    setLoading(false);

    if (result.success) {
      setFeed({ ...feed, token: result.token });
      setConfirmReset(false);
      setSheetOpen(true);
    }
  };

  const handleAddToAnother = () => {
    setSheetOpen(true);
  };

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <div className={styles.iconTile}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
              <path d="M9 16l2 2 4-4" />
            </svg>
          </div>
          <div className={styles.cardText}>
            <h3 className={styles.cardTitle}>Add classes to my calendar</h3>
            {!isEnabled ? (
              <p className={styles.cardDesc}>
                Turn on to put every class in Google, Apple or Outlook. Subs and changes update on their own.
              </p>
            ) : (
              <p className={styles.cardDesc}>
                Your classes show up in your calendar and stay up to date.
              </p>
            )}
          </div>
          <button
            role="switch"
            aria-checked={isEnabled}
            className={`${styles.toggle} ${isEnabled ? styles.toggleOn : ""}`}
            onClick={handleToggle}
            disabled={loading}
          >
            <span className={styles.toggleKnob} />
          </button>
        </div>

        {isEnabled && (
          <div className={styles.cardBody}>
            <div className={styles.statusLine}>
              <span className={styles.statusDot} />
              Added to {calendarAppLabel}
            </div>

            <div className={styles.checkList}>
              <div className={styles.checkItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Classes you teach and sub
              </div>
              <div className={styles.checkItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Address, time and who you&apos;re with
              </div>
              <div className={styles.checkItem}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M5 12l5 5L20 7" />
                </svg>
                Days off and holidays drop off on their own
              </div>
            </div>

            <div className={styles.buttonRow}>
              <button
                className={styles.secondaryBtn}
                onClick={handleAddToAnother}
              >
                Add to another calendar
              </button>
              <button
                className={styles.ghostBtn}
                onClick={handleResetLink}
              >
                Reset link
              </button>
            </div>

            <p className={styles.note}>
              Google can take up to a day to show changes. Last-minute changes always show in the app first.
            </p>
          </div>
        )}
      </div>

      {/* Confirm disable dialog */}
      {confirmDisable && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmDisable(false)}>
          <div className={styles.confirmSheet} onClick={(e) => e.stopPropagation()}>
            <h3>Turn off calendar sync?</h3>
            <p>Classes will stop updating in your calendar. You can remove the calendar there too.</p>
            <div className={styles.confirmButtons}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmDisable(false)}
              >
                Cancel
              </button>
              <button
                className={styles.destructiveBtn}
                onClick={handleConfirmDisable}
                disabled={loading}
              >
                Turn off
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm reset dialog */}
      {confirmReset && (
        <div className={styles.confirmOverlay} onClick={() => setConfirmReset(false)}>
          <div className={styles.confirmSheet} onClick={(e) => e.stopPropagation()}>
            <h3>Reset calendar link?</h3>
            <p>Your old calendar link stops working. You&apos;ll need to add it again.</p>
            <div className={styles.confirmButtons}>
              <button
                className={styles.cancelBtn}
                onClick={() => setConfirmReset(false)}
              >
                Cancel
              </button>
              <button
                className={styles.destructiveBtn}
                onClick={handleConfirmReset}
                disabled={loading}
              >
                Reset link
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Calendar picker sheet */}
      {sheetOpen && feed?.token && (
        <CalendarPickerSheet
          token={feed.token}
          onClose={() => setSheetOpen(false)}
          onSelectApp={async (app) => {
            await updateCalendarApp(app);
            setFeed({ ...feed, calendar_app: app });
          }}
        />
      )}
    </>
  );
}

function CalendarPickerSheet({ token, onClose, onSelectApp }) {
  const sheetRef = useRef(null);
  const [copied, setCopied] = useState(false);

  const feedUrl = `${SITE_URL}/api/calendar/${token}.ics`;
  const webcalUrl = `webcal://${SITE_URL.replace(/^https?:\/\//, "")}/api/calendar/${token}.ics`;

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") handleClose();
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [handleClose]);

  const handleApple = () => {
    onSelectApp("apple");
    window.location.href = webcalUrl;
    setTimeout(handleClose, 500);
  };

  const handleGoogle = () => {
    onSelectApp("google");
    const googleUrl = `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`;
    window.open(googleUrl, "_blank");
    handleClose();
  };

  const handleOutlook = () => {
    onSelectApp("outlook");
    const outlookUrl = `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent("Shape Your Destiny classes")}`;
    window.open(outlookUrl, "_blank");
    handleClose();
  };

  const handleOther = async () => {
    onSelectApp("other");
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => {
        setCopied(false);
        handleClose();
      }, 3000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Drag to dismiss
  const [dragStart, setDragStart] = useState(null);

  const handleTouchStart = (e) => {
    setDragStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    if (dragStart === null) return;
    const dragEnd = e.changedTouches[0].clientY;
    if (dragEnd - dragStart > 80) handleClose();
    setDragStart(null);
  };

  return (
    <div className={styles.sheetOverlay} onClick={handleClose}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div
          className={styles.handle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handleBar} />
        </div>

        <h2 className={styles.sheetTitle}>Which calendar do you use?</h2>
        <p className={styles.sheetDesc}>
          Pick one. Your classes stay up to date on their own.
        </p>

        <div className={styles.optionList}>
          <button className={styles.option} onClick={handleApple}>
            <span className={styles.optionIcon} data-app="apple">A</span>
            <div className={styles.optionText}>
              <span className={styles.optionName}>Apple Calendar</span>
              <span className={styles.optionSub}>iPhone, iPad and Mac</span>
            </div>
            <svg className={styles.optionChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <button className={styles.option} onClick={handleGoogle}>
            <span className={styles.optionIcon} data-app="google">G</span>
            <div className={styles.optionText}>
              <span className={styles.optionName}>Google Calendar</span>
              <span className={styles.optionSub}>Opens Google in your browser</span>
              <span className={styles.optionNote}>
                If it doesn&apos;t open, copy the link and add it in Google under Other calendars → From URL.
              </span>
            </div>
            <svg className={styles.optionChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <button className={styles.option} onClick={handleOutlook}>
            <span className={styles.optionIcon} data-app="outlook">O</span>
            <div className={styles.optionText}>
              <span className={styles.optionName}>Outlook</span>
              <span className={styles.optionSub}>Outlook.com or Microsoft 365</span>
            </div>
            <svg className={styles.optionChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>

          <button className={styles.option} onClick={handleOther}>
            <span className={styles.optionIcon} data-app="other">+</span>
            <div className={styles.optionText}>
              <span className={styles.optionName}>Something else</span>
              <span className={styles.optionSub}>
                {copied ? "Copied. Paste it into your calendar app as a subscription." : "Copy your private calendar link"}
              </span>
            </div>
            <svg className={styles.optionChevron} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M9 18l6-6-6-6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
