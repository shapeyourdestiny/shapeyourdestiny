"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";
import {
  approveShoutOut,
  holdShoutOut,
  markReplyDone,
  resolvePayrollIssue,
} from "@/lib/admin/inbox-actions";

const TAG_LABELS = {
  saved_the_day: "Saved the day",
  great_with_kids: "Great with the kids",
  team_player: "Team player",
  made_it_fun: "Made it fun",
  super_prepared: "Super prepared",
};

function formatDate(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr.includes("T") ? dateStr : dateStr + "T00:00:00");
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatRelativeTime(dateStr) {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateStr);
}

const ISSUE_KINDS = {
  missing_class: "Missing class",
  wrong_role: "Wrong role",
  wrong_date: "Wrong date",
  other: "Other",
};


export default function InboxClient({ inboxData }) {
  const router = useRouter();
  const [loading, setLoading] = useState({});
  const [editingShoutOut, setEditingShoutOut] = useState(null);
  const [editedMessage, setEditedMessage] = useState("");
  const [resolvingIssue, setResolvingIssue] = useState(null);
  const [resolutionNote, setResolutionNote] = useState("");

  const { pendingShoutOuts, instructorReplies, payrollIssues, payrollStatus, newApplications, toughClassNotes, flaggedSessionReviews, totalPending } = inboxData;

  const handleApproveShoutOut = async (id, message = null) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await approveShoutOut(id, message);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
      setEditingShoutOut(null);
      router.refresh();
    }
  };

  const handleHoldShoutOut = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await holdShoutOut(id);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleMarkReplyDone = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await markReplyDone(id);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleResolveIssue = async (id, note = null) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await resolvePayrollIssue(id, note);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
      setResolvingIssue(null);
      setResolutionNote("");
      router.refresh();
    }
  };

  const renderAvatar = (profile, size = 36) => {
    if (profile?.avatar_url) {
      return (
        <Image
          src={profile.avatar_url}
          alt=""
          width={size}
          height={size}
          className={styles.avatar}
        />
      );
    }
    return (
      <div className={styles.avatarPlaceholder} style={{ width: size, height: size }}>
        {profile?.full_name?.charAt(0)?.toUpperCase() || "?"}
      </div>
    );
  };

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h1>Inbox</h1>
        <p>
          {totalPending > 0
            ? `${totalPending} item${totalPending !== 1 ? "s" : ""} need your attention`
            : "All caught up"}
        </p>
      </div>

      {/* Payroll Check Status Card */}
      {payrollStatus && (
        <div className={styles.statusCard}>
          <div className={styles.statusHeader}>
            <span className={styles.statusIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </span>
            <div className={styles.statusMeta}>
              <span className={styles.statusTitle}>Payroll Check</span>
              <span className={styles.statusPeriod}>{payrollStatus.periodRange}</span>
            </div>
            <span className={styles.statusDeadline}>
              Due {formatDate(payrollStatus.deadline)}
            </span>
          </div>

          <div className={styles.statusGrid}>
            <div className={styles.statusTile}>
              <span className={`${styles.statusDot} ${styles.confirmed}`} />
              <span className={styles.statusCount}>{payrollStatus.confirmed.length}</span>
              <span className={styles.statusLabel}>Confirmed</span>
            </div>
            <div className={styles.statusTile}>
              <span className={`${styles.statusDot} ${styles.flagged}`} />
              <span className={styles.statusCount}>{payrollStatus.flagged.length}</span>
              <span className={styles.statusLabel}>Flagged</span>
            </div>
            <div className={styles.statusTile}>
              <span className={`${styles.statusDot} ${styles.noReply}`} />
              <span className={styles.statusCount}>{payrollStatus.noReply.length}</span>
              <span className={styles.statusLabel}>No reply</span>
            </div>
          </div>

          {payrollStatus.noReply.length > 0 && (
            <div className={styles.statusNames}>
              <span className={styles.statusNamesLabel}>Waiting:</span>
              {payrollStatus.noReply.map((i) => i.full_name?.split(" ")[0]).join(", ")}
            </div>
          )}
        </div>
      )}

      {totalPending === 0 && (
        <div className={styles.emptyState}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Nothing pending. Check back later.</p>
        </div>
      )}

      {/* Pending Shout-outs */}
      {pendingShoutOuts.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </span>
            Shout-outs to review
            <span className={styles.sectionCount}>{pendingShoutOuts.length}</span>
          </h2>

          <div className={styles.cardList}>
            {pendingShoutOuts.map((shoutOut) => (
              <div key={shoutOut.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardAvatars}>
                    {renderAvatar(shoutOut.fromProfile, 32)}
                    <span className={styles.arrow}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                      </svg>
                    </span>
                    {renderAvatar(shoutOut.toProfile, 32)}
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNames}>
                      {shoutOut.fromProfile?.full_name?.split(" ")[0]} thanked {shoutOut.toProfile?.full_name?.split(" ")[0]}
                    </span>
                    <span className={styles.cardTime}>{formatRelativeTime(shoutOut.created_at)}</span>
                  </div>
                </div>

                {shoutOut.tag && (
                  <span className={styles.tagPill}>{TAG_LABELS[shoutOut.tag]}</span>
                )}

                <p className={styles.cardMessage}>&ldquo;{shoutOut.message}&rdquo;</p>

                {shoutOut.contextClass && (
                  <div className={styles.cardContext}>
                    {shoutOut.contextClass.schools?.name} - {shoutOut.contextClass.time}
                    {shoutOut.context_date && ` on ${formatDate(shoutOut.context_date)}`}
                  </div>
                )}

                {editingShoutOut === shoutOut.id ? (
                  <div className={styles.editBox}>
                    <label>Edit message before approving (optional):</label>
                    <textarea
                      value={editedMessage}
                      onChange={(e) => setEditedMessage(e.target.value)}
                      placeholder={shoutOut.message}
                      maxLength={300}
                    />
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => {
                          setEditingShoutOut(null);
                          setEditedMessage("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.approveBtn}
                        onClick={() => handleApproveShoutOut(shoutOut.id, editedMessage || null)}
                        disabled={loading[shoutOut.id]}
                      >
                        {loading[shoutOut.id] ? "..." : "Approve"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cardActions}>
                    <button
                      type="button"
                      className={styles.holdBtn}
                      onClick={() => handleHoldShoutOut(shoutOut.id)}
                      disabled={loading[shoutOut.id]}
                    >
                      Hold back
                    </button>
                    <button
                      type="button"
                      className={styles.editBtn}
                      onClick={() => {
                        setEditingShoutOut(shoutOut.id);
                        setEditedMessage(shoutOut.message);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      onClick={() => handleApproveShoutOut(shoutOut.id)}
                      disabled={loading[shoutOut.id]}
                    >
                      {loading[shoutOut.id] ? "..." : "Approve"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Instructor Replies */}
      {instructorReplies.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
              </svg>
            </span>
            Instructor replies
            <span className={styles.sectionCount}>{instructorReplies.length}</span>
          </h2>

          <div className={styles.cardList}>
            {instructorReplies.map((reply) => (
              <div key={reply.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  {renderAvatar(reply.profile, 36)}
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNames}>{reply.profile?.full_name}</span>
                    <span className={styles.cardTime}>
                      replied to {reply.type} - {formatRelativeTime(reply.instructor_commented_at)}
                    </span>
                  </div>
                </div>

                <p className={styles.cardMessage}>&ldquo;{reply.instructor_comment}&rdquo;</p>

                <a href={`/admin/instructors/${reply.profile?.id}?tab=notes`} className={styles.viewLink}>
                  View note
                </a>

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.doneBtn}
                    onClick={() => handleMarkReplyDone(reply.id)}
                    disabled={loading[reply.id]}
                  >
                    {loading[reply.id] ? "..." : "Mark as read"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* New Applications */}
      {newApplications?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </span>
            New applications
            <span className={styles.sectionCount}>{newApplications.length}</span>
          </h2>

          <div className={styles.cardList}>
            {newApplications.map((application) => (
              <a
                key={application.id}
                href={`/admin/applications?id=${application.id}`}
                className={`${styles.card} ${styles.linkCard}`}
              >
                <div className={styles.cardHeader}>
                  <div className={styles.avatarPlaceholder} style={{ width: 36, height: 36 }}>
                    {application.first_name?.charAt(0)?.toUpperCase() || "?"}
                  </div>
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNames}>
                      {application.first_name} {application.last_name}
                    </span>
                    <span className={styles.cardTime}>{formatRelativeTime(application.created_at)}</span>
                  </div>
                  <span className={styles.cardArrow}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 5l7 7-7 7" />
                    </svg>
                  </span>
                </div>
              </a>
            ))}
          </div>
        </section>
      )}

      {/* Class Notes (low ratings or needs supplies) */}
      {toughClassNotes?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </span>
            Class notes
            <span className={styles.sectionCount}>{toughClassNotes.length}</span>
          </h2>

          <div className={styles.cardList}>
            {toughClassNotes.map((note) => {
              // Build trigger summary
              const triggers = [];
              if (note.overall && note.overall <= 2) {
                triggers.push(`rated overall ${note.overall} of 5`);
              }
              if (note.attention && note.attention <= 2) {
                triggers.push(`rated attention ${note.attention} of 5`);
              }
              if (note.behavior && note.behavior <= 2) {
                triggers.push(`rated behavior ${note.behavior} of 5`);
              }
              if (note.needs_supplies) {
                triggers.push("needs supplies");
              }
              const triggerSummary = triggers.join(" · ");

              return (
                <a
                  key={note.id}
                  href={`/admin/programs?classId=${note.classes?.id}`}
                  className={`${styles.card} ${styles.linkCard}`}
                >
                  <div className={styles.cardHeader}>
                    {renderAvatar(note.profile, 36)}
                    <div className={styles.cardMeta}>
                      <span className={styles.cardNames}>{note.profile?.full_name?.split(" ")[0]}</span>
                      <span className={styles.cardTime}>
                        {note.classes?.schools?.name} - {formatDate(note.session_date)}
                      </span>
                    </div>
                    <span className={styles.cardArrow}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>

                  {triggerSummary && (
                    <p className={styles.triggerSummary}>{triggerSummary}</p>
                  )}

                  <div className={styles.classNoteStars}>
                    <span className={styles.starRow}>
                      <span className={styles.starLabel}>Overall</span>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} viewBox="0 0 24 24" className={i <= note.overall ? styles.starFilled : styles.starEmpty}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </span>
                    {note.attention && (
                      <span className={styles.starRow}>
                        <span className={styles.starLabel}>Attention</span>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <svg key={i} viewBox="0 0 24 24" className={i <= note.attention ? styles.starFilled : styles.starEmpty}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </span>
                    )}
                    {note.behavior && (
                      <span className={styles.starRow}>
                        <span className={styles.starLabel}>Behavior</span>
                        {[1, 2, 3, 4, 5].map((i) => (
                          <svg key={i} viewBox="0 0 24 24" className={i <= note.behavior ? styles.starFilled : styles.starEmpty}>
                            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                          </svg>
                        ))}
                      </span>
                    )}
                    {note.needs_supplies && (
                      <span className={styles.needsSuppliesBadge}>Needs supplies</span>
                    )}
                  </div>

                  {note.body && (
                    <p className={styles.cardMessage}>&ldquo;{note.body}&rdquo;</p>
                  )}
                </a>
              );
            })}
          </div>
        </section>
      )}

      {/* Payroll Issues */}
      {payrollIssues?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </span>
            Payroll issues
            <span className={styles.sectionCount}>{payrollIssues.length}</span>
          </h2>

          <div className={styles.cardList}>
            {payrollIssues.map((issue) => (
              <div key={issue.id} className={`${styles.card} ${styles.issueCard}`}>
                <div className={styles.cardHeader}>
                  {renderAvatar(issue.check?.profile, 36)}
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNames}>{issue.check?.profile?.full_name}</span>
                    <span className={styles.cardTime}>
                      {issue.periodRange} · {formatRelativeTime(issue.created_at)}
                    </span>
                  </div>
                </div>

                <div className={styles.issueDetails}>
                  <span className={styles.issuePill}>{ISSUE_KINDS[issue.kind] || issue.kind}</span>
                  {issue.school && (
                    <span className={styles.issueSchool}>{issue.school.name}</span>
                  )}
                  {issue.session_date && (
                    <span className={styles.issueDate}>{formatDate(issue.session_date)}</span>
                  )}
                </div>

                {issue.note && <p className={styles.cardMessage}>&ldquo;{issue.note}&rdquo;</p>}

                {resolvingIssue === issue.id ? (
                  <div className={styles.editBox}>
                    <label>Resolution note (optional):</label>
                    <textarea
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                      placeholder="What was fixed or why it's resolved..."
                      maxLength={500}
                    />
                    <div className={styles.editActions}>
                      <button
                        type="button"
                        className={styles.cancelBtn}
                        onClick={() => {
                          setResolvingIssue(null);
                          setResolutionNote("");
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className={styles.approveBtn}
                        onClick={() => handleResolveIssue(issue.id, resolutionNote || null)}
                        disabled={loading[issue.id]}
                      >
                        {loading[issue.id] ? "..." : "Mark resolved"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className={styles.cardActions}>
                    <a
                      href={`/admin/schedule?date=${issue.session_date || issue.issue_date}`}
                      className={styles.viewLink}
                      style={{ marginBottom: 0, marginRight: "auto" }}
                    >
                      View schedule
                    </a>
                    <button
                      type="button"
                      className={styles.approveBtn}
                      onClick={() => setResolvingIssue(issue.id)}
                    >
                      Resolve
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Flagged Session Reviews */}
      {flaggedSessionReviews?.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
              </svg>
            </span>
            Session reviews
            <span className={styles.sectionCount}>{flaggedSessionReviews.length}</span>
          </h2>

          <div className={styles.cardList}>
            {flaggedSessionReviews.map((review) => {
              // Build trigger summary for low ratings
              const triggers = [];
              if (review.overall && review.overall <= 2) {
                triggers.push(`overall ${review.overall}/5`);
              }
              if (review.kids_growth && review.kids_growth <= 2) {
                triggers.push(`kids growth ${review.kids_growth}/5`);
              }
              if (review.support && review.support <= 2) {
                triggers.push(`support ${review.support}/5`);
              }
              if (review.lowCoworkerRating) {
                triggers.push(`rated ${review.lowCoworkerRating.coworker?.full_name?.split(" ")[0]} ${review.lowCoworkerRating.rating}/5`);
              }
              const triggerSummary = triggers.join(" · ");

              const programName = review.classes?.program === "soccer" ? "Soccer" : "Wellness";

              return (
                <a
                  key={review.id}
                  href={`/admin/instructors/${review.profile?.id}?tab=reviews`}
                  className={`${styles.card} ${styles.linkCard}`}
                >
                  <div className={styles.cardHeader}>
                    {renderAvatar(review.profile, 36)}
                    <div className={styles.cardMeta}>
                      <span className={styles.cardNames}>{review.profile?.full_name}</span>
                      <span className={styles.cardTime}>
                        {programName} · {review.classes?.schools?.name}
                      </span>
                    </div>
                    <span className={styles.cardArrow}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 5l7 7-7 7" />
                      </svg>
                    </span>
                  </div>

                  <p className={styles.triggerSummary}>{triggerSummary}</p>

                  <div className={styles.classNoteStars}>
                    <span className={styles.starRow}>
                      <span className={styles.starLabel}>Overall</span>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} viewBox="0 0 24 24" className={i <= review.overall ? styles.starFilled : styles.starEmpty}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </span>
                    <span className={styles.starRow}>
                      <span className={styles.starLabel}>Kids growth</span>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} viewBox="0 0 24 24" className={i <= review.kids_growth ? styles.starFilled : styles.starEmpty}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </span>
                    <span className={styles.starRow}>
                      <span className={styles.starLabel}>Support</span>
                      {[1, 2, 3, 4, 5].map((i) => (
                        <svg key={i} viewBox="0 0 24 24" className={i <= review.support ? styles.starFilled : styles.starEmpty}>
                          <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                        </svg>
                      ))}
                    </span>
                  </div>

                  {review.lowCoworkerRating?.comment && (
                    <p className={styles.cardMessage}>&ldquo;{review.lowCoworkerRating.comment}&rdquo;</p>
                  )}
                  {!review.lowCoworkerRating && review.needs && (
                    <p className={styles.cardMessage}>&ldquo;{review.needs}&rdquo;</p>
                  )}

                  <span className={styles.cardDate}>
                    Session: {formatDate(review.session_start)} – {formatDate(review.session_end)}
                  </span>
                </a>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
