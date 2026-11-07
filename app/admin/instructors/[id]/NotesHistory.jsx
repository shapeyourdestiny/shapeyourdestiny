"use client";

import { useState, useMemo } from "react";
import styles from "./NotesHistory.module.css";
import { archiveNote, restoreNote, deleteNote, completeFollowUp, getFileUrl, shareNote, unshareNote } from "@/lib/instructor-notes/actions";
import AddNotePopup from "./AddNotePopup";

const TYPE_COLORS = {
  review: "#2C6E7D",
  pay: "#4FA347",
  training: "#7C3AED",
  communication: "#2563EB",
  observations: "#D97706",
  disciplinary: "#E0594C",
  recognition: "#DB2777",
};

const DISCIPLINARY_STEPS = ["verbal", "written", "final", "suspension"];

const RATING_LABELS = {
  attitude: "Attitude",
  reliability: "Reliability",
  skills: "Teaching Skills",
  communication: "Communication",
};

function formatDateParts(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return {
    month: months[date.getMonth()],
    day: date.getDate(),
    year: date.getFullYear(),
  };
}

function formatFullDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatDateTime(isoStr) {
  const date = new Date(isoStr);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  const hour12 = hours % 12 || 12;
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()} at ${hour12}:${minutes}${ampm}`;
}

// Pre-compute 90 days threshold date
function getNinetyDaysFromNow() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d;
}

export default function NotesHistory({ instructor, notesData, onRefresh }) {
  const [typeFilter, setTypeFilter] = useState("all");
  const [showArchived, setShowArchived] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [loading, setLoading] = useState(false);

  const { notes, attendance, summary } = notesData;

  // Combine and filter entries
  const allEntries = useMemo(() => {
    let entries = [];

    // Add notes
    (notes || []).forEach((note) => {
      if (!showArchived && note.archived_at) return;
      entries.push({
        ...note,
        entryType: "note",
        sortDate: note.note_date,
      });
    });

    // Add attendance entries
    (attendance || []).forEach((a) => {
      entries.push({
        id: a.id,
        entryType: "attendance",
        type: "attendance",
        sortDate: a.session_date,
        title: `Out - ${a.reason || "Absent"}`,
        school: a.classes?.schools?.name,
        program: a.classes?.program,
        time: a.classes?.time,
        subName: a.subProfile?.full_name,
      });
    });

    // Sort by date descending
    entries.sort((a, b) => b.sortDate.localeCompare(a.sortDate));

    // Apply type filter
    if (typeFilter !== "all") {
      entries = entries.filter((e) => e.type === typeFilter);
    }

    return entries;
  }, [notes, attendance, showArchived, typeFilter]);

  // Count notes by type
  const typeCounts = useMemo(() => {
    const counts = { all: 0 };
    (notes || []).forEach((n) => {
      if (n.archived_at && !showArchived) return;
      counts.all++;
      counts[n.type] = (counts[n.type] || 0) + 1;
    });
    counts.attendance = (attendance || []).length;
    counts.all += counts.attendance;
    return counts;
  }, [notes, attendance, showArchived]);

  const handleAddNote = () => {
    setEditingNote(null);
    setPopupOpen(true);
  };

  const handleEditNote = (note) => {
    setEditingNote(note);
    setPopupOpen(true);
  };

  const handleClosePopup = () => {
    setPopupOpen(false);
    setEditingNote(null);
  };

  const handleNoteSaved = () => {
    setPopupOpen(false);
    setEditingNote(null);
    if (onRefresh) onRefresh();
  };

  const handleArchive = async (noteId) => {
    if (!confirm("Archive this note?")) return;
    setLoading(true);
    const result = await archiveNote(noteId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const handleRestore = async (noteId) => {
    setLoading(true);
    const result = await restoreNote(noteId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const handleDelete = async (noteId) => {
    if (!confirm("Permanently delete this note? This cannot be undone.")) return;
    setLoading(true);
    const result = await deleteNote(noteId);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const handleMarkDone = async (noteId) => {
    const noteText = prompt("Optional: Add a note about the follow-up completion");
    setLoading(true);
    const result = await completeFollowUp(noteId, noteText);
    setLoading(false);
    if (result.error) {
      alert(result.error);
    } else if (onRefresh) {
      onRefresh();
    }
  };

  const handleFileClick = async (fileId) => {
    const result = await getFileUrl(fileId);
    if (result.error) {
      alert(result.error);
    } else if (result.url) {
      window.open(result.url, "_blank");
    }
  };

  const handleShare = async (noteId, currentlyShared) => {
    if (currentlyShared) {
      const firstName = instructor.full_name?.split(" ")[0] || "the instructor";
      if (!confirm(`${firstName} won't see this anymore. Their acknowledgment and comment are kept.`)) return;
      setLoading(true);
      const result = await unshareNote(noteId);
      setLoading(false);
      if (result.error) {
        alert(result.error);
      } else if (onRefresh) {
        onRefresh();
      }
    } else {
      setLoading(true);
      const result = await shareNote(noteId);
      setLoading(false);
      if (result.error) {
        alert(result.error);
      } else if (onRefresh) {
        onRefresh();
      }
    }
  };

  const renderRatingBar = (value) => {
    return (
      <div className={styles.reviewRatingBar}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`${styles.reviewRatingSeg} ${i <= value ? styles.filled : ""}`}
          />
        ))}
      </div>
    );
  };

  const renderSummaryRatingBar = (value) => {
    const filled = Math.round(value || 0);
    return (
      <div className={styles.ratingBar}>
        {[1, 2, 3, 4, 5].map((i) => (
          <div
            key={i}
            className={`${styles.ratingSeg} ${i <= filled ? styles.filled : ""}`}
          />
        ))}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* Summary Column */}
      <div className={styles.summaryColumn}>
        {/* Pay Card */}
        <div className={styles.summaryCard}>
          <h4>Pay</h4>
          {summary.pay.currentRate ? (
            <>
              <div className={styles.summaryValue}>
                ${Number(summary.pay.currentRate).toFixed(0)}
                <span style={{ fontSize: "14px", fontWeight: "normal" }}>/class</span>
              </div>
              {summary.pay.effectiveDate && (
                <div className={styles.summaryMeta}>
                  Since {formatFullDate(summary.pay.effectiveDate.split("T")[0])}
                </div>
              )}
              {summary.pay.previousRate && (
                <div className={styles.summaryMeta}>
                  Previously ${Number(summary.pay.previousRate).toFixed(0)}
                </div>
              )}
            </>
          ) : (
            <div className={styles.summaryMeta}>No pay rate set</div>
          )}
        </div>

        {/* Attendance Card */}
        <div className={styles.summaryCard}>
          <h4>Attendance This Year</h4>
          <div className={styles.summaryValue}>{summary.attendance.total}</div>
          <div className={styles.summaryMeta}>day{summary.attendance.total !== 1 ? "s" : ""} out</div>
          {Object.entries(summary.attendance.byReason).map(([reason, count]) => (
            <div key={reason} className={styles.summaryRow}>
              <span className={styles.summaryLabel}>{reason}</span>
              <span className={styles.summaryCount}>{count}</span>
            </div>
          ))}
          <div className={styles.summaryRow}>
            <span className={styles.summaryLabel}>Left without sub</span>
            <span className={`${styles.summaryCount} ${summary.attendance.withoutSub === 0 ? styles.green : styles.red}`}>
              {summary.attendance.withoutSub}
            </span>
          </div>
        </div>

        {/* Reviews Card */}
        <div className={styles.summaryCard}>
          <h4>Reviews</h4>
          {summary.reviews.nextReviewDate ? (
            <div className={`${styles.summaryMeta} ${summary.reviews.isOverdue ? styles.overdue : ""}`}>
              Next: {formatFullDate(summary.reviews.nextReviewDate)}
              {summary.reviews.isOverdue && " (overdue)"}
            </div>
          ) : (
            <div className={styles.summaryMeta}>No review scheduled</div>
          )}
          {summary.reviews.lastReviewDate && (
            <div className={styles.summaryMeta}>
              Last: {formatFullDate(summary.reviews.lastReviewDate)}
            </div>
          )}
          {summary.reviews.averageRating && (
            <>
              <div className={`${styles.summaryValue} ${styles.summaryValueSmall}`} style={{ marginTop: 8 }}>
                {summary.reviews.averageRating.toFixed(1)}
              </div>
              {renderSummaryRatingBar(summary.reviews.averageRating)}
            </>
          )}
        </div>

        {/* Disciplinary Card (only if exists) */}
        {summary.latestDisciplinary && (
          <div className={styles.summaryCard}>
            <h4>Disciplinary</h4>
            <div className={styles.disciplinaryStep}>
              {summary.latestDisciplinary.step}
            </div>
            <div className={styles.summaryMeta} style={{ marginTop: 6 }}>
              {formatFullDate(summary.latestDisciplinary.date)}
            </div>
            {summary.latestDisciplinary.topic && (
              <div className={styles.summaryMeta}>
                Re: {summary.latestDisciplinary.topic}
              </div>
            )}
          </div>
        )}

        {/* Follow-ups Card */}
        <div className={styles.summaryCard}>
          <h4>Open Follow-ups</h4>
          {summary.openFollowUpCount > 0 ? (
            <>
              <div className={styles.summaryValue}>{summary.openFollowUpCount}</div>
              <div className={styles.followUpList}>
                {summary.openFollowUps.map((f) => (
                  <div key={f.id} className={styles.followUpItem}>
                    <span className={styles.followUpDot} />
                    <span>{f.title}</span>
                    <span style={{ marginLeft: "auto", fontSize: 11 }}>
                      {formatFullDate(f.followUpDate)}
                    </span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className={`${styles.summaryMeta} ${styles.green}`}>None</div>
          )}

          {/* Training Expiring */}
          {summary.expiringTraining.length > 0 && (
            <>
              <h4 style={{ marginTop: 16 }}>Training Expiring</h4>
              {summary.expiringTraining.map((t) => (
                <div key={t.id} className={styles.trainingExpiry}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  <span>{t.title}</span>
                  <span style={{ marginLeft: "auto" }}>{formatFullDate(t.expiresDate)}</span>
                </div>
              ))}
            </>
          )}
        </div>
      </div>

      {/* Timeline Column */}
      <div className={styles.timelineColumn}>
        <div className={styles.timelineHeader}>
          {/* Only show filters when there are entries to filter */}
          {typeCounts.all > 0 && (
            <div className={styles.filterChips}>
              {/* Only show "All" when there are multiple types */}
              {Object.keys(typeCounts).filter(k => k !== "all" && typeCounts[k] > 0).length > 1 && (
                <button
                  type="button"
                  className={`${styles.filterChip} ${typeFilter === "all" ? styles.active : ""}`}
                  onClick={() => setTypeFilter("all")}
                >
                  All
                </button>
              )}
              {["review", "pay", "attendance", "training", "communication", "observations", "disciplinary", "recognition"]
                .filter((type) => typeCounts[type] > 0)
                .map((type) => (
                  <button
                    key={type}
                    type="button"
                    className={`${styles.filterChip} ${typeFilter === type ? styles.active : ""}`}
                    onClick={() => setTypeFilter(type)}
                  >
                    <span className={styles.chipDot} style={{ background: TYPE_COLORS[type] || "#888" }} />
                    {type.charAt(0).toUpperCase() + type.slice(1)}
                    <span className={styles.chipCount}>{typeCounts[type]}</span>
                  </button>
                ))}
            </div>
          )}
          <button type="button" className={styles.addNoteBtn} onClick={handleAddNote}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" />
            </svg>
            Add note
          </button>
          <label className={styles.archivedToggle}>
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
            />
            Show archived
          </label>
        </div>

        {allEntries.length === 0 ? (
          <div className={styles.emptyState}>
            <p>No notes or attendance records yet.</p>
            <button type="button" className={styles.addNoteBtn} onClick={handleAddNote}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add the first note
            </button>
          </div>
        ) : (
          <div className={styles.timelineList}>
            {allEntries.map((entry) => {
              const dateParts = formatDateParts(entry.sortDate);

              // Attendance entry
              if (entry.entryType === "attendance") {
                return (
                  <div key={`att-${entry.id}`} className={`${styles.timelineEntry} ${styles.attendance}`}>
                    <div className={styles.dateCol}>
                      <span className={styles.dateMonth}>{dateParts.month}</span>
                      <span className={styles.dateDay}>{dateParts.day}</span>
                      <span className={styles.dateYear}>{dateParts.year}</span>
                    </div>
                    <div className={styles.entryContent}>
                      <div className={styles.entryHeader}>
                        <span className={`${styles.typeTag} ${styles.attendance}`}>Attendance</span>
                        <span className={styles.entryTitle}>{entry.title}</span>
                        <span className={styles.attendanceLabel}>From Schedule Board</span>
                      </div>
                      <div className={styles.entryBody}>
                        {entry.school} &middot; {entry.program} &middot; {entry.time}
                      </div>
                      <div className={styles.attendanceSub}>
                        {entry.subName ? `Covered by ${entry.subName}` : "No sub found."}
                      </div>
                    </div>
                  </div>
                );
              }

              // Note entry
              const isArchived = !!entry.archived_at;
              const hasVersions = entry.updated_at !== entry.created_at;

              return (
                <div
                  key={entry.id}
                  className={`${styles.timelineEntry} ${isArchived ? styles.archived : ""}`}
                >
                  <div className={styles.dateCol}>
                    <span className={styles.dateMonth}>{dateParts.month}</span>
                    <span className={styles.dateDay}>{dateParts.day}</span>
                    <span className={styles.dateYear}>{dateParts.year}</span>
                  </div>
                  <div className={styles.entryContent}>
                    <div className={styles.entryHeader}>
                      <span className={`${styles.typeTag} ${styles[entry.type]}`}>
                        {entry.type}
                      </span>
                      <span className={styles.entryTitle}>{entry.title}</span>
                      {!isArchived && (
                        <button
                          type="button"
                          className={styles.editBtn}
                          onClick={() => handleEditNote(entry)}
                        >
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
                          </svg>
                          Edit
                        </button>
                      )}
                    </div>

                    {entry.body && <div className={styles.entryBody}>{entry.body}</div>}

                    {/* Pay block */}
                    {entry.type === "pay" && entry.details && (
                      <div className={styles.payBlock}>
                        {entry.details.rate_from && (
                          <>
                            <span className={styles.oldRate}>${Number(entry.details.rate_from).toFixed(0)}</span>
                            <span className={styles.payArrow}>&rarr;</span>
                          </>
                        )}
                        <span className={styles.newRate}>${Number(entry.details.rate_to).toFixed(0)}/class</span>
                        {entry.details.pay_period && (
                          <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>
                            Starting {entry.details.pay_period}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Review ratings */}
                    {entry.type === "review" && entry.details?.ratings && (
                      <div className={styles.reviewRatings}>
                        {Object.entries(RATING_LABELS).map(([key, label]) => (
                          <div key={key} className={styles.reviewRatingRow}>
                            <span className={styles.reviewRatingLabel}>{label}</span>
                            {renderRatingBar(entry.details.ratings[key] || 0)}
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Review text fields */}
                    {entry.type === "review" && entry.details && (
                      <>
                        {entry.details.doing_well && (
                          <div style={{ fontSize: 13, marginBottom: 6 }}>
                            <strong>Doing well:</strong> {entry.details.doing_well}
                          </div>
                        )}
                        {entry.details.work_on && (
                          <div style={{ fontSize: 13, marginBottom: 6 }}>
                            <strong>Work on:</strong> {entry.details.work_on}
                          </div>
                        )}
                        {entry.details.next_review_date && (
                          <div className={styles.trainingPill}>
                            Next review: {formatFullDate(entry.details.next_review_date)}
                          </div>
                        )}
                      </>
                    )}

                    {/* Disciplinary block */}
                    {entry.type === "disciplinary" && entry.details && (
                      <div className={styles.disciplinaryBlock}>
                        <div className={styles.disciplinaryLadder}>
                          {DISCIPLINARY_STEPS.map((step) => {
                            const stepIndex = DISCIPLINARY_STEPS.indexOf(step);
                            const currentIndex = DISCIPLINARY_STEPS.indexOf(entry.details.step);
                            let className = styles.ladderStep;
                            if (stepIndex === currentIndex) className += ` ${styles.active}`;
                            else if (stepIndex < currentIndex) className += ` ${styles.past}`;
                            return (
                              <span key={step} className={className}>
                                {step}
                              </span>
                            );
                          })}
                        </div>
                        <div className={styles.disciplinaryDetails}>
                          {entry.details.about && (
                            <div className={styles.disciplinaryRow}>
                              <span className={styles.disciplinaryLabel}>About:</span>
                              <span>{entry.details.about}</span>
                            </div>
                          )}
                          {entry.details.what_happened && (
                            <div className={styles.disciplinaryRow}>
                              <span className={styles.disciplinaryLabel}>What happened:</span>
                              <span>{entry.details.what_happened}</span>
                            </div>
                          )}
                          {entry.details.talked_on && (
                            <div className={styles.disciplinaryRow}>
                              <span className={styles.disciplinaryLabel}>Talked on:</span>
                              <span>{formatFullDate(entry.details.talked_on)}</span>
                            </div>
                          )}
                          {entry.details.acknowledged && (
                            <div className={styles.disciplinaryRow}>
                              <span style={{ color: "#4FA347" }}>Acknowledged by instructor</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Training expiry */}
                    {entry.type === "training" && entry.details?.expires_date && (
                      <div className={`${styles.trainingPill} ${new Date(entry.details.expires_date + "T00:00:00") < getNinetyDaysFromNow() ? styles.expiring : ""}`}>
                        Expires: {formatFullDate(entry.details.expires_date)}
                      </div>
                    )}

                    {/* Follow-up block */}
                    {entry.follow_up_date && (
                      <div className={`${styles.followUpBlock} ${entry.follow_up_done_at ? styles.done : styles.open}`}>
                        {entry.follow_up_done_at ? (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M20 6L9 17l-5-5" />
                            </svg>
                            <span>Follow-up completed {formatFullDate(entry.follow_up_done_at.split("T")[0])}</span>
                            {entry.follow_up_note && <span>- {entry.follow_up_note}</span>}
                          </>
                        ) : (
                          <>
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 6v6l4 2" />
                            </svg>
                            <span>Follow up by {formatFullDate(entry.follow_up_date)}</span>
                            <button
                              type="button"
                              className={styles.markDoneBtn}
                              onClick={() => handleMarkDone(entry.id)}
                              disabled={loading}
                            >
                              Mark done
                            </button>
                          </>
                        )}
                      </div>
                    )}

                    {/* Files */}
                    {entry.files && entry.files.length > 0 && (
                      <div className={styles.filesRow}>
                        {entry.files.map((file) => (
                          <button
                            key={file.id}
                            type="button"
                            className={styles.fileLink}
                            onClick={() => handleFileClick(file.id, file.file_name)}
                          >
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                              <polyline points="14 2 14 8 20 8" />
                            </svg>
                            {file.file_name}
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Footer */}
                    <div className={styles.entryFooter}>
                      <span>{entry.author?.full_name}</span>
                      <span className={styles.footerDot} />
                      <span>{formatDateTime(entry.created_at)}</span>
                      {hasVersions && (
                        <>
                          <span className={styles.footerDot} />
                          <span className={styles.editedLink}>edited</span>
                        </>
                      )}
                      {isArchived && (
                        <>
                          <span className={styles.footerDot} />
                          <span className={styles.archivedBadge}>
                            Archived {formatFullDate(entry.archived_at.split("T")[0])}
                            {entry.archiver?.full_name && ` by ${entry.archiver.full_name}`}
                          </span>
                          <button
                            type="button"
                            className={styles.restoreBtn}
                            onClick={() => handleRestore(entry.id)}
                            disabled={loading}
                          >
                            Restore
                          </button>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={() => handleDelete(entry.id)}
                            disabled={loading}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>

                    {/* Sharing strip for shareable types */}
                    {["review", "recognition", "disciplinary"].includes(entry.type) && !isArchived && (
                      <div className={`${styles.sharingStrip} ${entry.shared_at && !entry.unshared_at ? styles.shared : ""}`}>
                        <label className={styles.shareSwitch}>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={!!(entry.shared_at && !entry.unshared_at)}
                            className={`${styles.switchTrack} ${entry.shared_at && !entry.unshared_at ? styles.on : ""}`}
                            onClick={() => handleShare(entry.id, entry.shared_at && !entry.unshared_at)}
                            disabled={loading}
                          >
                            <span className={styles.switchThumb} />
                          </button>
                          <span className={styles.switchLabel}>
                            {entry.shared_at && !entry.unshared_at
                              ? `Shared with ${instructor.full_name?.split(" ")[0]}`
                              : `Share with ${instructor.full_name?.split(" ")[0]}`}
                          </span>
                        </label>

                        {entry.shared_at && !entry.unshared_at ? (
                          <div className={styles.shareStatus}>
                            <span className={styles.shareDate}>
                              Shared {formatFullDate(entry.shared_at.split("T")[0])}
                            </span>
                            <span className={styles.shareDot} />
                            {entry.acknowledged_at ? (
                              <span className={styles.shareRead}>
                                {entry.type === "disciplinary"
                                  ? `${instructor.full_name?.split(" ")[0]} acknowledged ${formatFullDate(entry.acknowledged_at.split("T")[0])}`
                                  : `${instructor.full_name?.split(" ")[0]} read it ${formatFullDate(entry.first_viewed_at?.split("T")[0] || entry.acknowledged_at.split("T")[0])}`}
                              </span>
                            ) : entry.first_viewed_at ? (
                              <span className={styles.shareRead}>
                                {instructor.full_name?.split(" ")[0]} read it {formatFullDate(entry.first_viewed_at.split("T")[0])}
                              </span>
                            ) : (
                              <span className={styles.shareNotOpened}>not opened yet</span>
                            )}
                          </div>
                        ) : (
                          <div className={styles.shareHint}>
                            {entry.type === "disciplinary"
                              ? `Private. Share it so ${instructor.full_name?.split(" ")[0]} can acknowledge it in the app.`
                              : "Private. Only admins can see this."}
                          </div>
                        )}

                        {/* Instructor comment */}
                        {entry.instructor_comment && (
                          <div className={styles.instructorComment}>
                            <div className={styles.commentAvatar}>
                              {instructor.full_name?.charAt(0)?.toUpperCase() || "?"}
                            </div>
                            <div className={styles.commentBubble}>
                              <strong>{instructor.full_name?.split(" ")[0]}:</strong> {entry.instructor_comment}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Note Popup */}
      {popupOpen && (
        <AddNotePopup
          instructor={instructor}
          note={editingNote}
          onClose={handleClosePopup}
          onSave={handleNoteSaved}
          onArchive={editingNote ? () => handleArchive(editingNote.id) : null}
        />
      )}
    </div>
  );
}
