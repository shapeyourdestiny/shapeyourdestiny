"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import styles from "./PastClasses.module.css";
import { saveClassNote, sendShoutOut } from "@/lib/instructor/actions";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/**
 * Group sessions by week (client-side version).
 * Returns array of { label: "Week of Mon D", sessions: [...] }
 */
function groupSessionsByWeek(sessions) {
  function parseDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const groups = new Map();

  for (const session of sessions) {
    const date = parseDate(session.date);
    // Find Monday of the week
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(date);
    monday.setDate(diff);

    const label = `Week of ${MONTHS[monday.getMonth()]} ${monday.getDate()}`;
    const key = formatDate(monday);

    if (!groups.has(key)) {
      groups.set(key, { label, sessions: [] });
    }
    groups.get(key).sessions.push(session);
  }

  // Convert to array, sorted by date descending
  return Array.from(groups.values()).sort((a, b) => {
    const aDate = a.sessions[0]?.date || "";
    const bDate = b.sessions[0]?.date || "";
    return bDate.localeCompare(aDate);
  });
}

// Quick message chips for thank form
const THANK_CHIPS = {
  normal: [
    "Great energy with the kids",
    "You kept them engaged",
    "Great teamwork",
  ],
  sub: [
    "Thanks for covering",
    "The kids were in good hands",
    "You saved the day",
  ],
};

function parseDate(dateStr) {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatWeekdayDate(dateStr) {
  const date = parseDate(dateStr);
  return `${DAYS[date.getDay()]}, ${MONTHS[date.getMonth()]} ${date.getDate()}`;
}

export default function PastClassesClient({
  profile,
  sessions,
  lastClass,
}) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState(null); // "note-{id}" or "thank-{id}"
  const [localSessions, setLocalSessions] = useState(sessions);

  // Group sessions by week
  const groupedSessions = groupSessionsByWeek(localSessions);

  // Check if last class actions are done
  const lastClassNoteDone = lastClass?.note !== null;
  const lastClassThankDone = !lastClass?.canThank || lastClass?.thanked;
  const showLastClassCard = lastClass && (!lastClassNoteDone || !lastClassThankDone);

  const handleExpand = (type, sessionId) => {
    const newId = `${type}-${sessionId}`;
    setExpandedId((prev) => (prev === newId ? null : newId));
  };

  const handleNoteSaved = (sessionId, note) => {
    // Update local state
    setLocalSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, note } : s))
    );
    setExpandedId(null);
    router.refresh();
  };

  const handleThankSent = (sessionId) => {
    // Update local state
    setLocalSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, thanked: true } : s))
    );
    setExpandedId(null);
    router.refresh();
  };

  return (
    <div className={styles.page}>
      {/* Header - Navy band */}
      <div className={styles.header}>
        <div className={styles.headerTop}>
          <Image
            src="/Images/footer_logo_gold.webp"
            alt="Shape Your Destiny"
            width={120}
            height={22}
            className={styles.headerLogo}
          />
          <Link href="/instructor/profile" className={styles.headerAvatar}>
            {profile?.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt="Profile"
                width={36}
                height={36}
                className={styles.headerAvatarImg}
              />
            ) : (
              <span className={styles.headerAvatarInitial}>
                {profile?.full_name?.charAt(0)?.toUpperCase() || "I"}
              </span>
            )}
          </Link>
        </div>

        <Link href="/instructor/dashboard" className={styles.backLink}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M15 18l-6-6 6-6" />
          </svg>
          Schedule
        </Link>

        <div className={styles.headerTitle}>
          <h1>Past classes</h1>
          <p className={styles.headerSub}>
            Thank your team and tell us how class went.
          </p>
        </div>
      </div>

      <div className={styles.content}>
        {/* Last Class Card */}
        {showLastClassCard && (
          <LastClassCard
            session={lastClass}
            expandedId={expandedId}
            onExpand={handleExpand}
            onNoteSaved={handleNoteSaved}
            onThankSent={handleThankSent}
          />
        )}

        {/* Session Groups */}
        {groupedSessions.map((group) => (
          <div key={group.label} className={styles.group}>
            <div className={styles.groupHeader}>
              <span className={styles.groupLabel}>{group.label}</span>
              <div className={styles.groupLine} />
            </div>
            {group.sessions.map((session) => (
              <SessionCard
                key={session.id}
                session={session}
                expandedId={expandedId}
                onExpand={handleExpand}
                onNoteSaved={handleNoteSaved}
                onThankSent={handleThankSent}
              />
            ))}
          </div>
        ))}

        {/* Empty State */}
        {localSessions.length === 0 && (
          <div className={styles.emptyCard}>
            <div className={styles.emptyIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <rect x="3" y="4" width="18" height="18" rx="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </div>
            <h2 className={styles.emptyTitle}>No past classes yet</h2>
            <p className={styles.emptySub}>
              Your teaching history will show up here.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Last Class Card - Highlighted at the top
function LastClassCard({ session, expandedId, onExpand, onNoteSaved, onThankSent }) {
  const noteExpanded = expandedId === `note-${session.id}`;
  const thankExpanded = expandedId === `thank-${session.id}`;
  const isExpanded = noteExpanded || thankExpanded;

  const noteDone = session.note !== null;
  const thankDone = !session.canThank || session.thanked;

  // Don't show if both done
  if (noteDone && thankDone) return null;

  const coTeacherFirstName = session.coTeacher?.full_name?.split(" ")[0];

  return (
    <div className={`${styles.lastClassCard} ${isExpanded ? styles.expanded : ""}`}>
      <div className={styles.lastClassHeader}>
        <div className={styles.lastClassIcon}>
          <svg viewBox="0 0 24 24" fill="currentColor">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </div>
        <div className={styles.lastClassMeta}>
          <span className={styles.lastClassLabel}>YOUR LAST CLASS</span>
          <span className={styles.lastClassInfo}>
            {session.schoolName} - {formatWeekdayDate(session.date)}
            {coTeacherFirstName && ` with ${coTeacherFirstName}`}
          </span>
        </div>
      </div>

      {!isExpanded && (
        <div className={styles.lastClassActions}>
          {!noteDone && (
            <button
              type="button"
              className={styles.lastClassBtn}
              onClick={() => onExpand("note", session.id)}
            >
              How did it go?
            </button>
          )}
          {!thankDone && session.canThank && (
            <button
              type="button"
              className={styles.lastClassBtnTeal}
              onClick={() => onExpand("thank", session.id)}
            >
              Thank {session.thankRecipient?.full_name?.split(" ")[0]}
            </button>
          )}
        </div>
      )}

      {noteExpanded && (
        <NoteForm
          session={session}
          onSave={onNoteSaved}
          onCancel={() => onExpand("note", session.id)}
        />
      )}

      {thankExpanded && (
        <ThankForm
          session={session}
          isSub={false}
          onSend={onThankSent}
          onCancel={() => onExpand("thank", session.id)}
        />
      )}
    </div>
  );
}

// Session Card
function SessionCard({ session, expandedId, onExpand, onNoteSaved, onThankSent }) {
  const noteExpanded = expandedId === `note-${session.id}`;
  const thankExpanded = expandedId === `thank-${session.id}`;
  const isExpanded = noteExpanded || thankExpanded;

  const date = parseDate(session.date);
  const dayShort = DAYS[date.getDay()];
  const dayNum = date.getDate();

  const isOff = session.type === "off";
  const isSubbed = session.type === "subbed";

  // Get status label
  let statusLabel = null;
  let statusStyle = "";

  if (isSubbed && session.coveredFor) {
    statusLabel = `You subbed for ${session.coveredFor.full_name?.split(" ")[0]}`;
    statusStyle = styles.statusTeal;
  } else if (isOff && session.sub) {
    statusLabel = `You were out - ${session.sub.full_name?.split(" ")[0]} subbed in`;
    statusStyle = styles.statusGray;
  } else if (isOff && !session.sub) {
    statusLabel = "You were out";
    statusStyle = styles.statusGray;
  }

  const coTeacherName = session.coTeacher?.full_name?.split(" ")[0];
  const programLabel = session.program === "soccer" ? "Soccer" : "Youth Wellness";

  return (
    <div className={`${styles.sessionCard} ${isOff ? styles.sessionCardOff : ""} ${isExpanded ? styles.sessionCardExpanded : ""}`}>
      <div className={styles.sessionHeader}>
        <div className={`${styles.dateTile} ${isOff ? styles.dateTileOff : ""} ${isSubbed ? styles.dateTileTeal : ""}`}>
          <span className={styles.dateTileDay}>{dayShort}</span>
          <span className={styles.dateTileNum}>{dayNum}</span>
        </div>

        <div className={styles.sessionMain}>
          <div className={styles.sessionTitle}>{session.schoolName}</div>
          <div className={styles.sessionMeta}>
            {programLabel} - {session.time}
            {coTeacherName && !isOff && ` with ${coTeacherName}`}
          </div>
          {statusLabel && (
            <span className={`${styles.statusLabel} ${statusStyle}`}>
              {statusLabel}
            </span>
          )}
        </div>

        {/* Co-teacher avatars */}
        {session.coTeacher && !isOff && (
          <div className={styles.coTeacherStack}>
            {session.coTeacher.avatar_url ? (
              <Image
                src={session.coTeacher.avatar_url}
                alt=""
                width={28}
                height={28}
                className={styles.coTeacherAvatar}
              />
            ) : (
              <div className={styles.coTeacherPlaceholder}>
                {session.coTeacher.full_name?.charAt(0)?.toUpperCase()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Action buttons */}
      {!isExpanded && !isOff && (
        <div className={styles.sessionActions}>
          {session.note ? (
            <CompactNote note={session.note} onEdit={() => onExpand("note", session.id)} />
          ) : session.canAddNote ? (
            <button
              type="button"
              className={styles.actionBtn}
              onClick={() => onExpand("note", session.id)}
            >
              How did it go?
            </button>
          ) : null}
          {session.canThank && !session.thanked && (
            <button
              type="button"
              className={styles.thankBtn}
              onClick={() => onExpand("thank", session.id)}
            >
              <svg viewBox="0 0 24 24" fill="currentColor">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
              Thank
            </button>
          )}
          {session.thanked && (
            <span className={styles.thankedLabel}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Thanked
            </span>
          )}
        </div>
      )}

      {/* Thank button for when out with sub */}
      {!isExpanded && isOff && session.canThank && !session.thanked && (
        <div className={styles.sessionActions}>
          <button
            type="button"
            className={styles.thankBtn}
            onClick={() => onExpand("thank", session.id)}
          >
            <svg viewBox="0 0 24 24" fill="currentColor">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
            Thank {session.thankRecipient?.full_name?.split(" ")[0]}
          </button>
        </div>
      )}

      {isOff && session.thanked && (
        <div className={styles.sessionActions}>
          <span className={styles.thankedLabel}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Thanked
          </span>
        </div>
      )}

      {/* Expanded forms */}
      {noteExpanded && (
        <NoteForm
          session={session}
          onSave={onNoteSaved}
          onCancel={() => onExpand("note", session.id)}
        />
      )}

      {thankExpanded && (
        <ThankForm
          session={session}
          isSub={isOff && !!session.sub}
          onSend={onThankSent}
          onCancel={() => onExpand("thank", session.id)}
        />
      )}
    </div>
  );
}

// Small star display for compact note
function SmallStars({ value, label }) {
  return (
    <div className={styles.smallStarRow}>
      <span className={styles.smallStarLabel}>{label}</span>
      <span className={styles.smallStars}>
        {[1, 2, 3, 4, 5].map((i) => (
          <svg
            key={i}
            viewBox="0 0 24 24"
            className={i <= value ? styles.smallStarFilled : styles.smallStarEmpty}
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        ))}
      </span>
    </div>
  );
}

// Compact note display
function CompactNote({ note, onEdit }) {
  return (
    <div className={styles.compactNote}>
      <div className={styles.compactNoteContent}>
        <span className={styles.compactNoteHeader}>Your note</span>
        <SmallStars value={note.overall} label="Overall" />
        {note.attention && <SmallStars value={note.attention} label="Attention" />}
        {note.behavior && <SmallStars value={note.behavior} label="Behavior" />}
        {note.needs_supplies && (
          <span className={styles.needsSuppliesLabel}>Needs supplies</span>
        )}
        {note.body && <span className={styles.notePreview}>{note.body}</span>}
      </div>
      <button type="button" className={styles.editLink} onClick={onEdit}>
        Edit
      </button>
    </div>
  );
}

// Star row input component
function StarRow({ label, value, onChange, required }) {
  return (
    <div className={styles.starRow} role="group" aria-label={label}>
      <span className={styles.starLabel}>
        {label}
        {required && <span className={styles.required}>*</span>}
      </span>
      <div className={styles.starButtons}>
        {[1, 2, 3, 4, 5].map((i) => (
          <button
            key={i}
            type="button"
            className={styles.starBtn}
            onClick={() => onChange(value === i ? null : i)}
            aria-label={`${label}: ${i} of 5`}
            aria-pressed={i <= (value || 0)}
          >
            <svg
              viewBox="0 0 24 24"
              className={i <= (value || 0) ? styles.starFilled : styles.starEmpty}
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </button>
        ))}
      </div>
    </div>
  );
}

// Note Form (expand in place)
function NoteForm({ session, onSave, onCancel }) {
  const [overall, setOverall] = useState(session.note?.overall || null);
  const [attention, setAttention] = useState(session.note?.attention || null);
  const [behavior, setBehavior] = useState(session.note?.behavior || null);
  const [needsSupplies, setNeedsSupplies] = useState(session.note?.needs_supplies || false);
  const [body, setBody] = useState(session.note?.body || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const formRef = useRef(null);

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleSubmit = async () => {
    if (!overall) {
      setError("Please rate how class went");
      return;
    }

    setSaving(true);
    setError("");

    const result = await saveClassNote(
      session.classId,
      session.date,
      overall,
      attention,
      behavior,
      needsSupplies,
      body
    );

    setSaving(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSave(session.id, {
        overall,
        attention,
        behavior,
        needs_supplies: needsSupplies,
        body: body.trim() || null,
      });
    }
  };

  return (
    <div className={styles.noteForm} ref={formRef}>
      {error && <div className={styles.formError}>{error}</div>}

      {/* Star ratings */}
      <div className={styles.starRatings}>
        <StarRow
          label="How did class go?"
          value={overall}
          onChange={setOverall}
          required
        />
        <StarRow
          label="Kept their attention"
          value={attention}
          onChange={setAttention}
        />
        <StarRow
          label="Behavior"
          value={behavior}
          onChange={setBehavior}
        />
      </div>

      {/* Needs supplies checkbox */}
      <label className={styles.checkboxRow}>
        <input
          type="checkbox"
          checked={needsSupplies}
          onChange={(e) => setNeedsSupplies(e.target.checked)}
        />
        <span>We need more supplies</span>
      </label>

      {/* Body textarea */}
      <div className={styles.formField}>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What worked, and what could be better?"
          maxLength={1000}
          className={styles.noteTextarea}
        />
        <div className={styles.charCount}>{body.length}/1000</div>
      </div>

      <div className={styles.formHint}>Only the admin team sees this.</div>

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onCancel}
          disabled={saving}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.saveBtn}
          onClick={handleSubmit}
          disabled={saving || !overall}
        >
          {saving ? "Saving..." : "Save note"}
        </button>
      </div>
    </div>
  );
}

// Thank Form (expand in place)
function ThankForm({ session, isSub, onSend, onCancel }) {
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  const formRef = useRef(null);
  const chips = isSub ? THANK_CHIPS.sub : THANK_CHIPS.normal;
  const recipientName = session.thankRecipient?.full_name?.split(" ")[0] || "them";

  useEffect(() => {
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, []);

  const handleChipClick = (text) => {
    setMessage(text);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError("Please write a message");
      return;
    }

    setSending(true);
    setError("");

    const contextData = {
      classId: session.classId,
      date: session.date,
      schoolName: session.schoolName,
    };

    const result = await sendShoutOut(
      session.thankRecipient.id,
      message,
      null,
      contextData
    );

    setSending(false);

    if (result.error) {
      setError(result.error);
    } else {
      onSend(session.id);
    }
  };

  return (
    <div className={styles.thankForm} ref={formRef}>
      <div className={styles.formQuestion}>
        Send {recipientName} a shout-out
      </div>

      {error && <div className={styles.formError}>{error}</div>}

      {/* Quick chips */}
      <div className={styles.quickChips}>
        {chips.map((chip) => (
          <button
            key={chip}
            type="button"
            className={`${styles.quickChip} ${message === chip ? styles.quickChipActive : ""}`}
            onClick={() => handleChipClick(chip)}
          >
            {chip}
          </button>
        ))}
      </div>

      {/* Message textarea */}
      <div className={styles.formField}>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Add a few words (optional)"
          maxLength={300}
          className={styles.thankTextarea}
        />
        <div className={styles.charCount}>{message.length}/300</div>
      </div>

      <div className={styles.formActions}>
        <button
          type="button"
          className={styles.cancelBtn}
          onClick={onCancel}
          disabled={sending}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.sendBtnTeal}
          onClick={handleSubmit}
          disabled={sending || !message.trim()}
        >
          {sending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
