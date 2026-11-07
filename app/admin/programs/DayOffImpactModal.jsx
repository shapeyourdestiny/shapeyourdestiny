"use client";

import { useState, useEffect, useRef } from "react";
import styles from "./DayOffImpactModal.module.css";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatDateFull(dateStr) {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return `${DAY_NAMES[date.getDay()]}, ${SHORT_MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function DayOffImpactModal({
  date,
  name,
  scope,
  timePeriod,
  impact,
  loading,
  onConfirm,
  onCancel,
}) {
  const modalRef = useRef(null);

  // State for past date confirmation checkbox
  const [pastDateConfirmed, setPastDateConfirmed] = useState(false);

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onCancel();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onCancel]);

  // Group affected sessions by school
  const sessionsBySchool = {};
  if (impact?.affectedSessions) {
    for (const session of impact.affectedSessions) {
      const key = session.schoolId;
      if (!sessionsBySchool[key]) {
        sessionsBySchool[key] = {
          schoolName: session.schoolName,
          districtName: session.districtName,
          sessions: [],
        };
      }
      sessionsBySchool[key].sessions.push(session);
    }
  }

  const affectedCount = impact?.affectedSessions?.length || 0;
  const instructorCount = impact?.instructorsToNotify?.length || 0;
  const sessionChanges = impact?.sessionChanges || [];
  const hasSubsOrAbsences = sessionChanges.length > 0;

  // Payroll warnings
  const payrollWarning = impact?.payrollStatus?.isApproved;
  const isInPast = impact?.isInPast;

  // Can confirm if: not in past, OR past date is confirmed
  const canConfirm = !isInPast || pastDateConfirmed;

  // Scope label
  let scopeLabel = "all schools";
  if (scope?.startsWith("district:")) {
    scopeLabel = "this district";
  } else if (scope?.startsWith("school:")) {
    scopeLabel = "this school";
  } else if (scope === "program") {
    scopeLabel = "this program";
  }

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <>
      <div className={styles.overlay} onClick={onCancel} />
      <div className={styles.modal} ref={modalRef} role="dialog" aria-modal="true">
        <h3 className={styles.title}>
          {affectedCount === 0
            ? "No classes affected"
            : `This cancels ${affectedCount} class${affectedCount === 1 ? "" : "es"}`}
        </h3>

        <div className={styles.dateRow}>
          <span className={styles.dateBig}>{formatDateFull(date)}</span>
          {timePeriod && timePeriod !== "all_day" && (
            <span className={styles.timePeriodPill}>
              {timePeriod === "am" ? "AM only" : "PM only"}
            </span>
          )}
        </div>

        {name && <p className={styles.holidayName}>{name}</p>}

        {/* Past date warning with checkbox */}
        {isInPast && (
          <div className={styles.warningBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div className={styles.warningContent}>
              <span>
                This date has passed. {affectedCount > 0 ? `${affectedCount} classes on it were taught and will be removed from Past classes and pay.` : ""}
              </span>
              <label className={styles.checkboxLabel}>
                <input
                  type="checkbox"
                  checked={pastDateConfirmed}
                  onChange={(e) => setPastDateConfirmed(e.target.checked)}
                />
                I understand this affects past records
              </label>
            </div>
          </div>
        )}

        {/* Payroll warning */}
        {payrollWarning && (
          <div className={styles.warningBox}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span>This date falls in a payroll period that&apos;s already approved. Add an adjustment on the next pay period if pay needs fixing.</span>
          </div>
        )}

        {affectedCount === 0 ? (
          <p className={styles.emptyMessage}>
            No classes are scheduled on this day for {scopeLabel}.
          </p>
        ) : (
          <>
            {/* Affected schools */}
            <div className={styles.section}>
              <h4 className={styles.sectionTitle}>Affected classes</h4>
              <div className={styles.schoolList}>
                {Object.values(sessionsBySchool).map((school, idx) => (
                  <div key={idx} className={styles.schoolRow}>
                    <span className={styles.schoolName}>{school.schoolName}</span>
                    <span className={styles.sessionCount}>
                      {school.sessions.length} session{school.sessions.length === 1 ? "" : "s"}
                    </span>
                    <span className={styles.districtName}>{school.districtName}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Subs and absences already on that date */}
            {hasSubsOrAbsences && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>Subs already assigned</h4>
                <div className={styles.subList}>
                  {sessionChanges.slice(0, 5).map((sc, idx) => {
                    const session = impact.affectedSessions?.find(s => s.classId === sc.class_id);
                    const subName = sc.subProfile?.full_name?.split(" ")[0];
                    return (
                      <div key={idx} className={styles.subRow}>
                        <span className={styles.subName}>{subName}</span>
                        <span className={styles.subNote}>
                          was going to sub at {session?.schoolName || "a school"}. They&apos;ll be told it&apos;s cancelled.
                        </span>
                      </div>
                    );
                  })}
                  {sessionChanges.length > 5 && (
                    <span className={styles.moreLabel}>+{sessionChanges.length - 5} more</span>
                  )}
                </div>
              </div>
            )}

            {/* Instructors to notify */}
            {instructorCount > 0 && (
              <div className={styles.section}>
                <h4 className={styles.sectionTitle}>
                  {instructorCount} instructor{instructorCount === 1 ? "" : "s"} to notify
                </h4>
                <div className={styles.instructorList}>
                  {impact.instructorsToNotify.slice(0, 8).map((inst, idx) => (
                    <span key={idx} className={styles.instructorChip}>
                      {inst.name?.split(" ")[0]}
                      {inst.reason === "sub" && <span className={styles.subLabel}>(sub)</span>}
                    </span>
                  ))}
                  {instructorCount > 8 && (
                    <span className={styles.moreLabel}>+{instructorCount - 8} more</span>
                  )}
                </div>
                <p className={styles.notifyNote}>
                  They&apos;ll see this update in My Schedule and their synced calendars.
                </p>
              </div>
            )}

          </>
        )}

        <div className={styles.actions}>
          <button
            className={styles.cancelBtn}
            onClick={onCancel}
            disabled={loading}
          >
            Cancel
          </button>
          <button
            className={styles.confirmBtn}
            onClick={handleConfirm}
            disabled={loading || !canConfirm}
          >
            {loading ? "Adding..." : affectedCount === 0 ? "Add anyway" : "Add day off"}
          </button>
        </div>
      </div>
    </>
  );
}
