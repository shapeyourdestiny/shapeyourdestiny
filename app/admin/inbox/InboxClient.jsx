"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./page.module.css";
import {
  approveShoutOut,
  holdShoutOut,
  markReplyDone,
  approveTimeOff,
  declineTimeOff,
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

export default function InboxClient({ inboxData }) {
  const router = useRouter();
  const [loading, setLoading] = useState({});
  const [editingShoutOut, setEditingShoutOut] = useState(null);
  const [editedMessage, setEditedMessage] = useState("");

  const { pendingShoutOuts, pendingTimeOff, instructorReplies, totalPending } = inboxData;

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

  const handleApproveTimeOff = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await approveTimeOff(id);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleDeclineTimeOff = async (id) => {
    setLoading((prev) => ({ ...prev, [id]: true }));
    const result = await declineTimeOff(id);
    setLoading((prev) => ({ ...prev, [id]: false }));
    if (result.error) {
      alert(result.error);
    } else {
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

      {/* Time Off Requests */}
      {pendingTimeOff.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
            </span>
            Time off requests
            <span className={styles.sectionCount}>{pendingTimeOff.length}</span>
          </h2>

          <div className={styles.cardList}>
            {pendingTimeOff.map((request) => (
              <div key={request.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  {renderAvatar(request.profile, 36)}
                  <div className={styles.cardMeta}>
                    <span className={styles.cardNames}>{request.profile?.full_name}</span>
                    <span className={styles.cardTime}>{formatRelativeTime(request.created_at)}</span>
                  </div>
                </div>

                <div className={styles.timeOffDates}>
                  <span className={styles.dateRange}>
                    {formatDate(request.start_date)}
                    {request.start_date !== request.end_date && ` - ${formatDate(request.end_date)}`}
                  </span>
                  {request.reason && <span className={styles.reason}>{request.reason}</span>}
                </div>

                {request.notes && <p className={styles.notes}>{request.notes}</p>}

                <div className={styles.cardActions}>
                  <button
                    type="button"
                    className={styles.declineBtn}
                    onClick={() => handleDeclineTimeOff(request.id)}
                    disabled={loading[request.id]}
                  >
                    Decline
                  </button>
                  <button
                    type="button"
                    className={styles.approveBtn}
                    onClick={() => handleApproveTimeOff(request.id)}
                    disabled={loading[request.id]}
                  >
                    {loading[request.id] ? "..." : "Approve"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
