"use client";

import { useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import styles from "./PastClasses.module.css";
import { confirmPayrollCheck, flagPayrollIssue } from "@/lib/payroll/check-actions";
import ComposeShoutOut from "../inbox/ComposeShoutOut";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatDateShort(dateStr) {
  const date = parseDate(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatPeriodRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);

  if (start.getMonth() === end.getMonth()) {
    return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${end.getDate()}`;
  }
  return `${MONTHS[start.getMonth()]} ${start.getDate()} – ${MONTHS[end.getMonth()]} ${end.getDate()}`;
}

function formatWeekdayDate(dateStr) {
  const date = parseDate(dateStr);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function formatDateFull(dateStr) {
  const date = parseDate(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function addDays(dateStr, days) {
  const date = parseDate(dateStr);
  date.setDate(date.getDate() + days);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getWeekOfLabel(dateStr) {
  const date = parseDate(dateStr);
  // Find Monday of the week
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return `Week of ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

function getMonthLabel(dateStr) {
  const date = parseDate(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function PastClassesClient({
  today,
  period,
  minPeriodStart,
  sessions,
  taughtCount,
  subbedCount,
  offCount,
  upcomingCount,
  isPeriodEnded,
  isCurrentPeriod,
  isEmpty,
  needsConfirmation,
  payrollCheck,
  periodNote,
  breakInfo,
  nextSession,
  lastPeriodWithClasses,
  deadline,
  instructorSchools,
  allSchools,
  payrollSettings,
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState("period"); // "period" or "year"
  const [loading, setLoading] = useState(false);
  const [showIssueSheet, setShowIssueSheet] = useState(false);
  const [showComposeShoutOut, setShowComposeShoutOut] = useState(false);
  const [shoutOutRecipient, setShoutOutRecipient] = useState(null);
  const [shoutOutContext, setShoutOutContext] = useState(null);

  // Navigate to previous period
  const handlePrevPeriod = () => {
    const prevStart = addDays(period.startDate, -payrollSettings.periodDays);
    if (prevStart >= minPeriodStart) {
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", prevStart);
      router.push(`/instructor/past?${params.toString()}`);
    }
  };

  // Navigate to next period
  const handleNextPeriod = () => {
    if (!isCurrentPeriod) {
      const nextStart = addDays(period.startDate, payrollSettings.periodDays);
      const params = new URLSearchParams(searchParams.toString());
      params.set("period", nextStart);
      router.push(`/instructor/past?${params.toString()}`);
    }
  };

  // Confirm classes
  const handleConfirm = async () => {
    setLoading(true);
    const result = await confirmPayrollCheck(period.startDate);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  // Open thank/shout-out sheet
  const handleThankClick = (session, recipientId, recipientName) => {
    setShoutOutRecipient({ id: recipientId, full_name: recipientName });
    setShoutOutContext({
      classId: session.classId,
      date: session.date,
      schoolName: session.schoolName,
    });
    setShowComposeShoutOut(true);
  };

  // Group sessions
  const groupedSessions = groupSessions(sessions, view);

  // Is deadline passed for showing "Did you teach something we don't have?"
  const deadlinePassed = today > deadline;

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.header}>
        <Link href="/instructor/dashboard" className={styles.backBtn}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className={styles.headerText}>
          <h1>Past classes</h1>
          <p>Your own record. Only you and the office can see it.</p>
        </div>
      </div>

      {/* View Switch */}
      <div className={styles.viewSwitch}>
        <button
          type="button"
          className={`${styles.viewTab} ${view === "period" ? styles.active : ""}`}
          onClick={() => setView("period")}
        >
          Pay period
        </button>
        <button
          type="button"
          className={`${styles.viewTab} ${view === "year" ? styles.active : ""}`}
          onClick={() => setView("year")}
        >
          School year
        </button>
      </div>

      {/* Summary Card */}
      {view === "period" ? (
        <div className={styles.summaryCard}>
          <div className={styles.summaryHeader}>
            <span className={styles.summaryLabel}>
              {isCurrentPeriod ? "THIS PAY PERIOD" : "PAY PERIOD"}
            </span>
            <div className={styles.periodNav}>
              <button
                type="button"
                className={styles.navBtn}
                onClick={handlePrevPeriod}
                disabled={period.startDate <= minPeriodStart}
                aria-label="Previous period"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <span className={styles.periodRange}>
                {formatPeriodRange(period.startDate, period.endDate)}
              </span>
              <button
                type="button"
                className={styles.navBtn}
                onClick={handleNextPeriod}
                disabled={isCurrentPeriod}
                aria-label="Next period"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.summaryTiles}>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{taughtCount}</span>
              <span className={styles.tileLabel}>Taught</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{subbedCount}</span>
              <span className={styles.tileLabel}>Subbed</span>
            </div>
            <div className={styles.tile}>
              <span className={styles.tileNum}>{offCount}</span>
              <span className={styles.tileLabel}>Days off</span>
            </div>
          </div>

          <div className={styles.summaryFooter}>
            {isPeriodEnded ? (
              <>Period ended Fri, {formatDateShort(period.endDate)} · Payday Fri, {formatDateShort(period.payday)}</>
            ) : (
              <>Payday Fri, {formatDateShort(period.payday)} · {upcomingCount} classes still coming up this period</>
            )}
          </div>
        </div>
      ) : (
        <SchoolYearSummary sessions={sessions} today={today} />
      )}

      {/* Check Card (pay period view only) */}
      {view === "period" && !isEmpty && (
        <CheckCard
          needsConfirmation={needsConfirmation}
          payrollCheck={payrollCheck}
          deadline={deadline}
          period={period}
          loading={loading}
          onConfirm={handleConfirm}
          onFlagClick={() => setShowIssueSheet(true)}
          periodNote={periodNote}
        />
      )}

      {/* Empty Period Card */}
      {view === "period" && isEmpty && isPeriodEnded && (
        <EmptyPeriodCard
          breakInfo={breakInfo}
          nextSession={nextSession}
          lastPeriodWithClasses={lastPeriodWithClasses}
          periodNote={periodNote}
          deadlinePassed={deadlinePassed}
          onFlagClick={() => setShowIssueSheet(true)}
        />
      )}

      {/* Sessions List */}
      {groupedSessions.length > 0 && (
        <div className={styles.sessionsList}>
          {groupedSessions.map((group) => (
            <SessionGroup
              key={group.label}
              label={group.label}
              sessions={group.sessions}
              onThankClick={handleThankClick}
            />
          ))}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        Something look wrong? Text the office and we&apos;ll fix it.
      </div>

      {/* Issue Sheet */}
      {showIssueSheet && (
        <IssueSheet
          period={period}
          sessions={sessions}
          instructorSchools={instructorSchools}
          allSchools={allSchools}
          onClose={() => setShowIssueSheet(false)}
        />
      )}

      {/* Shout-out Compose Sheet */}
      <ComposeShoutOut
        isOpen={showComposeShoutOut}
        onClose={() => {
          setShowComposeShoutOut(false);
          setShoutOutRecipient(null);
          setShoutOutContext(null);
        }}
        preselectedRecipient={shoutOutRecipient}
        contextData={shoutOutContext}
      />
    </div>
  );
}

// School Year Summary Component
function SchoolYearSummary({ sessions, today }) {
  // School year is Aug 1 - Jul 31
  const todayDate = parseDate(today);
  const year = todayDate.getMonth() >= 7 ? todayDate.getFullYear() : todayDate.getFullYear() - 1;
  const yearStart = `${year}-08-01`;

  // Filter sessions to school year and past
  const yearSessions = sessions.filter((s) => s.date >= yearStart && s.date <= today);
  const taughtCount = yearSessions.filter((s) => s.type === "taught").length;
  const subbedCount = yearSessions.filter((s) => s.type === "subbed").length;
  const offCount = yearSessions.filter((s) => s.type === "off").length;

  // First session date
  const firstSession = yearSessions.length > 0 ? yearSessions[0] : null;

  return (
    <div className={styles.summaryCard}>
      <div className={styles.summaryHeader}>
        {firstSession && (
          <span className={styles.summaryLabel}>
            SINCE {formatDateShort(firstSession.date).toUpperCase()}
          </span>
        )}
        <span className={styles.yearLabel}>{year}–{String(year + 1).slice(-2)} school year</span>
      </div>

      <div className={styles.summaryTiles}>
        <div className={styles.tile}>
          <span className={styles.tileNum}>{taughtCount}</span>
          <span className={styles.tileLabel}>Taught</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileNum}>{subbedCount}</span>
          <span className={styles.tileLabel}>Subbed</span>
        </div>
        <div className={styles.tile}>
          <span className={styles.tileNum}>{offCount}</span>
          <span className={styles.tileLabel}>Days off</span>
        </div>
      </div>
    </div>
  );
}

// Check Card Component
function CheckCard({
  needsConfirmation,
  payrollCheck,
  deadline,
  period,
  loading,
  onConfirm,
  onFlagClick,
  periodNote,
}) {
  if (needsConfirmation) {
    return (
      <div className={styles.checkCard}>
        <div className={styles.checkIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div className={styles.checkContent}>
          <h3>Check your classes by {formatWeekdayDate(deadline)}</h3>
          <p>Make sure every class you taught or subbed is listed below. If we don&apos;t hear from you, we&apos;ll go with what&apos;s here.</p>
          {periodNote && <p className={styles.periodNote}>{periodNote}</p>}
        </div>
        <div className={styles.checkActions}>
          <button
            type="button"
            className={styles.confirmBtn}
            onClick={onConfirm}
            disabled={loading}
          >
            {loading ? "..." : "Looks right"}
          </button>
          <button
            type="button"
            className={styles.flagBtn}
            onClick={onFlagClick}
          >
            Something&apos;s off
          </button>
        </div>
      </div>
    );
  }

  if (payrollCheck?.status === "confirmed") {
    return (
      <div className={`${styles.checkCard} ${styles.confirmed}`}>
        <div className={styles.checkIconGreen}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <circle cx="12" cy="12" r="10" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
        <div className={styles.checkContent}>
          <h3>You confirmed these classes</h3>
          <p>{formatDateFull(payrollCheck.confirmed_at?.split("T")[0] || payrollCheck.created_at?.split("T")[0])} · Payday is Fri, {formatDateShort(period.payday)}</p>
        </div>
      </div>
    );
  }

  if (payrollCheck?.status === "flagged") {
    const issues = payrollCheck.issues || [];
    const openIssues = issues.filter((i) => i.status === "open");
    const resolvedIssues = issues.filter((i) => i.status === "resolved");

    return (
      <div className={`${styles.checkCard} ${styles.flagged}`}>
        <div className={styles.checkIconAmber}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="12" r="6" />
          </svg>
        </div>
        <div className={styles.checkContent}>
          {resolvedIssues.length > 0 && openIssues.length === 0 ? (
            <>
              <h3>Fixed by the office</h3>
              {resolvedIssues.map((issue) => (
                <div key={issue.id} className={styles.resolvedIssue}>
                  {issue.resolution_note && <p>&ldquo;{issue.resolution_note}&rdquo;</p>}
                  <span>{formatDateFull(issue.resolved_at?.split("T")[0])}</span>
                </div>
              ))}
            </>
          ) : (
            <>
              <h3>Sent to the office</h3>
              {issues.slice(0, 1).map((issue) => (
                <p key={issue.id} className={styles.issueQuote}>&ldquo;{issue.note}&rdquo;</p>
              ))}
              <p>We&apos;ll fix it before payroll and let you know.</p>
            </>
          )}
        </div>
        {openIssues.length > 0 && (
          <button
            type="button"
            className={styles.addIssueBtn}
            onClick={onFlagClick}
          >
            + Add another
          </button>
        )}
      </div>
    );
  }

  return null;
}

// Empty Period Card Component
function EmptyPeriodCard({
  breakInfo,
  nextSession,
  lastPeriodWithClasses,
  periodNote,
  deadlinePassed,
  onFlagClick,
}) {
  return (
    <div className={styles.emptyPeriod}>
      <div className={styles.emptyHero}>
        <div className={styles.emptyIcon}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="5" />
            <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
          </svg>
        </div>
        {breakInfo?.breakName && (
          <span className={styles.breakPill}>{breakInfo.breakName}</span>
        )}
        <h2>No classes this pay period</h2>
        <p>Nothing to check this time.</p>
        {periodNote && <p className={styles.periodNoteInline}>{periodNote}</p>}
        {nextSession && (
          <span className={styles.nextClassPill}>
            Classes start again {formatWeekdayDate(nextSession.date)}
          </span>
        )}
      </div>

      {lastPeriodWithClasses && (
        <div className={styles.lastPeriodCard}>
          <span className={styles.lastPeriodLabel}>LAST PAY PERIOD WITH CLASSES</span>
          <div className={styles.lastPeriodRow}>
            <span className={styles.lastPeriodRange}>
              {formatPeriodRange(lastPeriodWithClasses.startDate, lastPeriodWithClasses.endDate)}
            </span>
            <span className={styles.lastPeriodMeta}>
              {lastPeriodWithClasses.taughtCount + lastPeriodWithClasses.subbedCount} taught · paid Fri, {formatDateShort(lastPeriodWithClasses.payday)}
            </span>
          </div>
        </div>
      )}

      {!deadlinePassed && (
        <button
          type="button"
          className={styles.exceptionLink}
          onClick={onFlagClick}
        >
          Did you teach something we don&apos;t have? Let us know
        </button>
      )}
    </div>
  );
}

// Session Group Component
function SessionGroup({ label, sessions, onThankClick }) {
  return (
    <div className={styles.sessionGroup}>
      <div className={styles.groupLabel}>{label}</div>
      <div className={styles.groupCard}>
        {sessions.map((session) => (
          <SessionRow
            key={session.id}
            session={session}
            onThankClick={onThankClick}
          />
        ))}
      </div>
    </div>
  );
}

// Session Row Component
function SessionRow({ session, onThankClick }) {
  const date = parseDate(session.date);
  const dayShort = DAYS[date.getDay()];
  const dayNum = date.getDate();

  const isOff = session.type === "off" || session.type === "holiday";
  const isSubbed = session.type === "subbed";

  // Determine who to thank
  let canThank = false;
  let thankRecipientId = null;
  let thankRecipientName = null;

  if (session.type === "taught" && session.coTeacher) {
    canThank = true;
    thankRecipientId = session.coTeacher.id;
    thankRecipientName = session.coTeacher.full_name;
  } else if (session.type === "off" && session.subId) {
    canThank = true;
    thankRecipientId = session.subId;
    thankRecipientName = session.subName;
  } else if (session.type === "subbed" && session.coveredForId) {
    // Could thank the person they covered for? Usually no, skip this
  }

  // Get status pill
  const statusPill = getStatusPill(session);

  return (
    <div className={`${styles.sessionRow} ${isSubbed ? styles.subbedRow : ""}`}>
      <div className={`${styles.dateTile} ${isOff ? styles.dateTileMuted : ""} ${isSubbed ? styles.dateTileTeal : ""}`}>
        <span className={styles.dateTileDay}>{dayShort}</span>
        <span className={styles.dateTileNum}>{dayNum}</span>
      </div>

      <div className={styles.sessionMain}>
        <div className={styles.sessionTitle}>
          {session.type === "holiday" ? session.holidayName : session.schoolName}
        </div>
        <div className={styles.sessionMeta}>
          {session.type === "taught" && (
            <>
              {session.program === "soccer" ? "Soccer" : "Youth Wellness"} · {session.time}
              {session.coTeacher ? ` · with ${session.coTeacher.full_name?.split(" ")[0]}` : " · taught alone"}
            </>
          )}
          {session.type === "subbed" && (
            <>covered for {session.coveredFor}</>
          )}
          {session.type === "off" && (
            <>
              {session.reason}
              {session.subName ? ` · ${session.subName} covered` : ""}
            </>
          )}
          {session.type === "holiday" && (
            <>{session.schoolName} would have met</>
          )}
          {session.type === "upcoming" && (
            <>
              {session.program === "soccer" ? "Soccer" : "Youth Wellness"} · {session.time}
              {session.coTeacher && ` · with ${session.coTeacher.full_name?.split(" ")[0]}`}
            </>
          )}
        </div>
        {statusPill && (
          <span className={`${styles.statusPill} ${styles[statusPill.style]}`}>
            {statusPill.text}
          </span>
        )}
      </div>

      {canThank && (
        <button
          type="button"
          className={styles.thankBtn}
          onClick={() => onThankClick(session, thankRecipientId, thankRecipientName)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
          Thank
        </button>
      )}
    </div>
  );
}

function getStatusPill(session) {
  switch (session.type) {
    case "taught":
      return { text: "Taught", style: "green" };
    case "subbed":
      return { text: `You subbed for ${session.coveredFor}`, style: "teal" };
    case "off":
      return { text: `Day off · ${session.reason}`, style: "gray" };
    case "holiday":
      return { text: "No class", style: "paleGray" };
    case "upcoming":
      return { text: "Coming up", style: "navy" };
    default:
      return null;
  }
}

function groupSessions(sessions, view) {
  if (sessions.length === 0) return [];

  const groups = new Map();

  // Sort by date descending (newest first)
  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date));

  for (const session of sorted) {
    const label = view === "period" ? getWeekOfLabel(session.date) : getMonthLabel(session.date);
    if (!groups.has(label)) {
      groups.set(label, []);
    }
    groups.get(label).push(session);
  }

  return Array.from(groups.entries()).map(([label, sessions]) => ({
    label,
    sessions,
  }));
}

// Issue Sheet Component
function IssueSheet({ period, sessions, instructorSchools, allSchools, onClose }) {
  const router = useRouter();
  const [kind, setKind] = useState(null);
  const [issueDate, setIssueDate] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [selectedSession, setSelectedSession] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (!kind) {
      setError("Please select what's off");
      return;
    }
    if (!note.trim()) {
      setError("Please describe what happened");
      return;
    }

    setLoading(true);
    setError("");

    const issueData = {
      kind,
      note: note.trim(),
    };

    if (kind === "missing") {
      issueData.issueDate = issueDate || null;
      issueData.schoolId = schoolId || null;
    } else if (kind === "wrong" && selectedSession) {
      const session = sessions.find((s) => s.id === selectedSession);
      if (session) {
        issueData.sessionClassId = session.classId;
        issueData.sessionDate = session.date;
        issueData.schoolId = session.schoolId;
      }
    }

    const result = await flagPayrollIssue(period.startDate, issueData);
    setLoading(false);

    if (result.error) {
      setError(result.error);
    } else {
      onClose();
      router.refresh();
    }
  };

  // Merge instructor schools with all schools, with instructor's schools first
  const schoolOptions = [
    ...instructorSchools.map((s) => ({ ...s, isInstructor: true })),
    { id: "divider", name: "---", disabled: true },
    ...allSchools.filter((s) => !instructorSchools.find((is) => is.id === s.id)),
    { id: "other", name: "Other" },
  ];

  // Filter sessions for "wrong" option
  const selectableSessions = sessions.filter((s) => s.type === "taught" || s.type === "subbed");

  return (
    <div className={styles.sheetOverlay} onClick={onClose}>
      <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
        <div className={styles.sheetHandle} />

        <div className={styles.sheetHeader}>
          <h2>What&apos;s off?</h2>
          <p>Pay period {formatPeriodRange(period.startDate, period.endDate)}</p>
          <button type="button" className={styles.closeBtn} onClick={onClose} aria-label="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className={styles.sheetBody}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Kind selection */}
          <div className={styles.kindOptions}>
            <button
              type="button"
              className={`${styles.kindCard} ${kind === "missing" ? styles.selected : ""}`}
              onClick={() => setKind("missing")}
            >
              <div className={styles.kindRadio} />
              <div className={styles.kindContent}>
                <strong>A class is missing</strong>
                <span>I taught or subbed one that isn&apos;t listed</span>
              </div>
            </button>
            <button
              type="button"
              className={`${styles.kindCard} ${kind === "wrong" ? styles.selected : ""}`}
              onClick={() => setKind("wrong")}
            >
              <div className={styles.kindRadio} />
              <div className={styles.kindContent}>
                <strong>Something listed is wrong</strong>
                <span>Wrong date, school, or I didn&apos;t teach it</span>
              </div>
            </button>
            <button
              type="button"
              className={`${styles.kindCard} ${kind === "other" ? styles.selected : ""}`}
              onClick={() => setKind("other")}
            >
              <div className={styles.kindRadio} />
              <div className={styles.kindContent}>
                <strong>Something else</strong>
                <span>Hours, a question about pay</span>
              </div>
            </button>
          </div>

          {/* Kind-specific fields */}
          {kind === "missing" && (
            <div className={styles.fieldGroup}>
              <div className={styles.field}>
                <label>Date</label>
                <input
                  type="date"
                  value={issueDate}
                  onChange={(e) => setIssueDate(e.target.value)}
                  min={period.startDate}
                  max={period.endDate}
                />
              </div>
              <div className={styles.field}>
                <label>School</label>
                <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
                  <option value="">Select school...</option>
                  {schoolOptions.map((s) =>
                    s.disabled ? (
                      <option key={s.id} disabled>─────────────</option>
                    ) : (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    )
                  )}
                </select>
              </div>
            </div>
          )}

          {kind === "wrong" && selectableSessions.length > 0 && (
            <div className={styles.field}>
              <label>Which class?</label>
              <select value={selectedSession} onChange={(e) => setSelectedSession(e.target.value)}>
                <option value="">Select class...</option>
                {selectableSessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {formatWeekdayDate(s.date)} - {s.schoolName} - {s.time}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Note field */}
          <div className={styles.field}>
            <label>Tell us what happened</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What should we know?"
              maxLength={500}
              required
            />
            <span className={styles.charCount}>{note.length}/500</span>
          </div>
        </div>

        <div className={styles.sheetFooter}>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={loading || !kind || !note.trim()}
          >
            {loading ? "Sending..." : "Send to the office"}
          </button>
        </div>
      </div>
    </div>
  );
}
