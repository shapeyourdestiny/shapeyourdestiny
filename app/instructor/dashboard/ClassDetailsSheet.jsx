"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import styles from "./ClassDetailsSheet.module.css";
import { getDirectionsUrl } from "@/lib/maps";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateStr) {
  const date = parseDate(dateStr);
  return `${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatDateFull(dateStr) {
  const date = parseDate(dateStr);
  const dayName = DAY_NAMES[date.getDay()];
  return `${dayName}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatPhoneDigits(phone) {
  if (!phone) return "";
  return phone.replace(/\D/g, "");
}

export default function ClassDetailsSheet({ classData, onClose }) {
  const [copied, setCopied] = useState(false);
  const [showAllDates, setShowAllDates] = useState(false);
  const sheetRef = useRef(null);
  const previousFocusRef = useRef(null);

  const {
    program,
    school,
    daysDisplay,
    time,
    startDate,
    endDate,
    targetSessions,
    sessionsDone,
    totalSessions,
    coTeacher,
    upcoming,
  } = classData;

  const isOngoing = !targetSessions;
  const hasStarted = startDate && parseDate(startDate) <= new Date();
  const sessionsLeft = totalSessions ? totalSessions - sessionsDone : null;
  const progressPercent = totalSessions ? Math.round((sessionsDone / totalSessions) * 100) : 0;

  // School instructions
  const instructions = school.instructions || "";
  const steps = instructions
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hasInstructions = steps.length > 0;
  const hasContact = !!school.officeContact;
  const hasPhone = !!school.officePhone;
  const showInstructionsBox = hasInstructions || hasContact || hasPhone;

  // Upcoming dates
  const visibleDates = showAllDates ? upcoming : upcoming.slice(0, 5);
  const hasMoreDates = upcoming.length > 5;
  const lastDate = upcoming.length > 0 ? upcoming[upcoming.length - 1].date : null;

  // Handle close
  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  // Trap focus and handle escape
  useEffect(() => {
    previousFocusRef.current = document.activeElement;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    document.body.style.overflow = "hidden";

    // Focus the sheet
    if (sheetRef.current) {
      sheetRef.current.focus();
    }

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    };
  }, [handleClose]);

  // Copy address
  const handleCopyAddress = async () => {
    if (!school.address) return;
    try {
      await navigator.clipboard.writeText(school.address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Failed to copy:", e);
    }
  };

  // Drag to dismiss (simple threshold)
  const [dragStart, setDragStart] = useState(null);

  const handleTouchStart = (e) => {
    setDragStart(e.touches[0].clientY);
  };

  const handleTouchEnd = (e) => {
    if (dragStart === null) return;
    const dragEnd = e.changedTouches[0].clientY;
    if (dragEnd - dragStart > 80) {
      handleClose();
    }
    setDragStart(null);
  };

  return (
    <div className={styles.overlay} onClick={handleClose}>
      <div
        ref={sheetRef}
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="sheet-title"
        tabIndex={-1}
      >
        {/* Handle for mobile */}
        <div
          className={styles.handle}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handleBar} />
        </div>

        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <span className={styles.programPill} data-program={program}>
              {program === "soccer" ? "Soccer" : "Youth Wellness"}
            </span>
            <h2 id="sheet-title" className={styles.schoolName}>{school.name}</h2>
            <p className={styles.scheduleText}>{daysDisplay} · {time}</p>
          </div>
          <button className={styles.closeBtn} onClick={handleClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className={styles.content}>
          {/* Progress Card */}
          <div className={styles.progressCard}>
            {!hasStarted && startDate ? (
              <div className={styles.progressNotStarted}>
                <span className={styles.startsLabel}>Starts {formatDateFull(startDate)}</span>
              </div>
            ) : isOngoing ? (
              <div className={styles.progressOngoing}>
                <span className={styles.ongoingLabel}>Ongoing</span>
                <span className={styles.ongoingCount}>{sessionsDone} sessions so far</span>
                {startDate && (
                  <span className={styles.startedDate}>Started {formatDateFull(startDate)}</span>
                )}
              </div>
            ) : (
              <div className={styles.progressFixed}>
                <div className={styles.progressRing}>
                  <svg viewBox="0 0 84 84">
                    <circle
                      className={styles.ringTrack}
                      cx="42"
                      cy="42"
                      r="36"
                      fill="none"
                      strokeWidth="8"
                    />
                    <circle
                      className={styles.ringFill}
                      cx="42"
                      cy="42"
                      r="36"
                      fill="none"
                      strokeWidth="8"
                      strokeDasharray={`${(progressPercent / 100) * 226} 226`}
                      strokeLinecap="round"
                      transform="rotate(-90 42 42)"
                    />
                  </svg>
                  <span className={styles.ringPercent}>{progressPercent}%</span>
                </div>
                <div className={styles.progressText}>
                  <span className={styles.sessionsDone}>
                    {sessionsDone} of {totalSessions} sessions done
                  </span>
                  <span className={styles.sessionsLeft}>
                    {sessionsLeft} to go · last class {formatDateFull(endDate)}
                  </span>
                  {startDate && (
                    <span className={styles.startedDate}>Started {formatDateFull(startDate)}</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Where */}
          <div className={styles.section}>
            <h3 className={styles.sectionLabel}>WHERE</h3>
            <div className={styles.locationBox}>
              <p className={styles.locationName}>{school.name}</p>
              {school.address && (
                <p className={styles.locationAddress}>{school.address}</p>
              )}
              {school.address && (
                <div className={styles.locationActions}>
                  <a
                    href={getDirectionsUrl(school.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.directionsBtn}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <polygon points="3 11 22 2 13 21 11 13 3 11" />
                    </svg>
                    Directions
                  </a>
                  <button className={styles.copyBtn} onClick={handleCopyAddress}>
                    {copied ? "Copied" : "Copy address"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* School Instructions */}
          {showInstructionsBox && (
            <div className={styles.instructionsBox}>
              <span className={styles.instructionsHeader}>SCHOOL INSTRUCTIONS</span>
              {hasInstructions && (
                <div className={styles.instructionsSteps}>
                  {steps.map((step, i) => (
                    <div key={i} className={styles.instructionStep}>
                      <span className={styles.stepNumber}>{i + 1}</span>
                      <span className={styles.stepText}>{step}</span>
                    </div>
                  ))}
                </div>
              )}
              {(hasContact || hasPhone) && (
                <div className={styles.frontOffice}>
                  <div className={styles.frontOfficeLeft}>
                    <span className={styles.frontOfficeLabel}>Front office</span>
                    {hasContact && (
                      <span className={styles.frontOfficeContact}>Ask for {school.officeContact}</span>
                    )}
                  </div>
                  {hasPhone && (
                    <a
                      href={`tel:${formatPhoneDigits(school.officePhone)}`}
                      className={styles.frontOfficeCall}
                    >
                      Call
                    </a>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Teaching With */}
          {coTeacher && (
            <div className={styles.section}>
              <h3 className={styles.sectionLabel}>TEACHING WITH</h3>
              <div className={styles.coTeacherCard}>
                <div className={styles.coTeacherInfo}>
                  {coTeacher.avatarUrl ? (
                    <Image
                      src={coTeacher.avatarUrl}
                      alt={coTeacher.name}
                      width={44}
                      height={44}
                      className={styles.coTeacherAvatar}
                    />
                  ) : (
                    <div className={styles.coTeacherInitial}>
                      {coTeacher.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                  )}
                  <div className={styles.coTeacherText}>
                    <span className={styles.coTeacherName}>{coTeacher.name}</span>
                    <span className={styles.coTeacherRole}>Co-instructor</span>
                  </div>
                </div>
                {coTeacher.phone && (
                  <div className={styles.coTeacherActions}>
                    <a
                      href={`sms:${formatPhoneDigits(coTeacher.phone)}`}
                      className={styles.contactBtn}
                      aria-label={`Text ${coTeacher.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
                      </svg>
                      Text
                    </a>
                    <a
                      href={`tel:${formatPhoneDigits(coTeacher.phone)}`}
                      className={styles.contactBtn}
                      aria-label={`Call ${coTeacher.name}`}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6 19.79 19.79 0 01-3.07-8.67A2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" />
                      </svg>
                      Call
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Coming Up */}
          {upcoming.length > 0 && (
            <div className={styles.section}>
              <div className={styles.comingUpHeader}>
                <h3 className={styles.sectionLabel}>COMING UP</h3>
                {!isOngoing && sessionsLeft !== null && (
                  <span className={styles.classesLeft}>{sessionsLeft} classes left</span>
                )}
              </div>
              <div className={styles.upcomingList}>
                {visibleDates.map((item) => (
                  <div
                    key={item.date + item.type}
                    className={`${styles.upcomingRow} ${item.type === "off" ? styles.upcomingOff : ""} ${item.isNext ? styles.upcomingNext : ""}`}
                  >
                    <div className={styles.upcomingDate}>
                      <span className={styles.upcomingDay}>
                        {DAY_NAMES[parseDate(item.date).getDay()]}
                      </span>
                      <span className={styles.upcomingDayNum}>
                        {parseDate(item.date).getDate()}
                      </span>
                    </div>
                    <div className={styles.upcomingInfo}>
                      {item.type === "session" ? (
                        <>
                          <span className={styles.upcomingDateText}>
                            {formatDateShort(item.date)} · {item.time}
                          </span>
                          <span className={styles.upcomingSession}>
                            Session {item.sessionNumber}{item.totalSessions ? ` of ${item.totalSessions}` : ""}
                          </span>
                        </>
                      ) : (
                        <>
                          <span className={styles.upcomingNoClass}>No class</span>
                          <span className={styles.upcomingReason}>{item.reason}</span>
                        </>
                      )}
                    </div>
                    <div className={styles.upcomingPills}>
                      {item.isNext && <span className={styles.pillNext}>Next</span>}
                      {item.isLast && <span className={styles.pillLast}>Last</span>}
                      {item.type === "off" && <span className={styles.pillOff}>Day off</span>}
                    </div>
                  </div>
                ))}
              </div>
              {hasMoreDates && !showAllDates && (
                <button
                  className={styles.showAllBtn}
                  onClick={() => setShowAllDates(true)}
                >
                  {isOngoing ? "Show more" : `Show all to ${formatDateShort(lastDate)}`}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
