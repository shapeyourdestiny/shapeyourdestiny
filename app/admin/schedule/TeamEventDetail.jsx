"use client";

import { useState } from "react";
import styles from "./TeamEventDetail.module.css";
import BottomSheet from "./BottomSheet";
import { cancelTeamEvent, duplicateTeamEvent } from "@/lib/team-events/actions";

const TYPE_LABELS = {
  meeting: "Team Meeting",
  training: "Team Training",
  social: "Team Social",
};

const TYPE_COLORS = {
  meeting: "#1F3F91",
  training: "#3E8FA0",
  social: "#F2A65E",
};

const TYPE_ICONS = {
  meeting: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  training: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  social: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 14s1.5 2 4 2 4-2 4-2" />
      <line x1="9" y1="9" x2="9.01" y2="9" />
      <line x1="15" y1="9" x2="15.01" y2="9" />
    </svg>
  ),
};

export default function TeamEventDetail({
  open,
  onClose,
  event,
  onEdit,
  onMarkAttendance,
  onRefresh,
}) {
  const [loading, setLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  if (!event) return null;

  const typeColor = TYPE_COLORS[event.type] || TYPE_COLORS.meeting;
  const typeLabel = TYPE_LABELS[event.type] || "Team Event";

  // Format date
  const formatDate = (dateStr) => {
    const d = new Date(dateStr + "T12:00:00");
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  // Format time
  const formatTime = (timeStr) => {
    if (!timeStr) return "";
    const [hours, minutes] = timeStr.split(":");
    const h = parseInt(hours);
    const ampm = h >= 12 ? "PM" : "AM";
    const displayHour = h > 12 ? h - 12 : h === 0 ? 12 : h;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Count RSVPs
  const people = event.people || [];
  const yesCount = people.filter((p) => p.rsvp === "yes").length;
  const noCount = people.filter((p) => p.rsvp === "no").length;
  const pendingCount = people.filter((p) => !p.rsvp).length;

  // Is event in the past?
  const eventDateTime = new Date(`${event.event_date}T${event.end_time || "23:59"}`);
  const isPast = eventDateTime < new Date();

  // Handle cancel
  const handleCancel = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await cancelTeamEvent(event.id);
      onRefresh?.();
      onClose();
    } catch (err) {
      console.error("Error cancelling event:", err);
    } finally {
      setLoading(false);
      setShowCancelConfirm(false);
    }
  };

  // Handle duplicate
  const handleDuplicate = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const result = await duplicateTeamEvent(event.id);
      if (result.success) {
        onRefresh?.();
        onClose();
      }
    } catch (err) {
      console.error("Error duplicating event:", err);
    } finally {
      setLoading(false);
    }
  };

  const content = (
    <div className={styles.content}>
      {/* Header */}
      <div className={styles.header} style={{ "--type-color": typeColor }}>
        <div className={styles.typeIcon}>{TYPE_ICONS[event.type]}</div>
        <div className={styles.headerInfo}>
          <span className={styles.typeLabel}>{typeLabel}</span>
          <h2 className={styles.title}>{event.title}</h2>
        </div>
        {event.status === "cancelled" && (
          <span className={styles.cancelledBadge}>Cancelled</span>
        )}
      </div>

      {/* Details */}
      <div className={styles.details}>
        <div className={styles.detailRow}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
          </svg>
          <span>{formatDate(event.event_date)}</span>
        </div>
        <div className={styles.detailRow}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span>{formatTime(event.start_time)} - {formatTime(event.end_time)}</span>
        </div>
        {event.location && (
          <div className={styles.detailRow}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
              <circle cx="12" cy="10" r="3" />
            </svg>
            <span>{event.location}</span>
          </div>
        )}
        {event.details && (
          <p className={styles.eventDetails}>{event.details}</p>
        )}
        <div className={styles.badges}>
          {event.paid && (
            <span className={styles.paidBadge}>
              Paid ({event.pay_classes} {event.pay_classes === 1 ? "class" : "classes"})
            </span>
          )}
          {!event.required && (
            <span className={styles.optionalBadge}>Optional</span>
          )}
        </div>
      </div>

      {/* RSVP Summary */}
      <div className={styles.rsvpSummary}>
        <span className={styles.rsvpItem}>
          <span className={styles.rsvpCount}>{yesCount}</span> coming
        </span>
        <span className={styles.rsvpDot} />
        <span className={styles.rsvpItem}>
          <span className={styles.rsvpCount}>{noCount}</span> can&apos;t
        </span>
        <span className={styles.rsvpDot} />
        <span className={styles.rsvpItem}>
          <span className={styles.rsvpCount}>{pendingCount}</span> no answer
        </span>
      </div>

      {/* People List */}
      <div className={styles.peopleSection}>
        <h3 className={styles.sectionTitle}>People</h3>
        <div className={styles.peopleList}>
          {people.map((person) => (
            <div key={person.profile_id} className={styles.personRow}>
              <div className={styles.personAvatar}>
                {person.profile?.avatar_url ? (
                  <img src={person.profile.avatar_url} alt="" />
                ) : (
                  <span>{person.profile?.full_name?.charAt(0) || "?"}</span>
                )}
              </div>
              <div className={styles.personInfo}>
                <span className={styles.personName}>{person.profile?.full_name}</span>
                {person.rsvp === "no" && person.rsvp_reason && (
                  <span className={styles.personReason}>{person.rsvp_reason}</span>
                )}
              </div>
              <span className={`${styles.rsvpStatus} ${styles[`rsvp_${person.rsvp || "pending"}`]}`}>
                {person.rsvp === "yes" ? "Coming" : person.rsvp === "no" ? "Can't" : "No answer"}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Cancel confirmation */}
      {showCancelConfirm && (
        <div className={styles.confirmOverlay}>
          <div className={styles.confirmBox}>
            <p>Cancel this event? All attendees will see it as cancelled.</p>
            <div className={styles.confirmButtons}>
              <button
                className={styles.confirmNo}
                onClick={() => setShowCancelConfirm(false)}
              >
                Keep event
              </button>
              <button
                className={styles.confirmYes}
                onClick={handleCancel}
                disabled={loading}
              >
                {loading ? "Cancelling..." : "Cancel event"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Actions */}
      {event.status !== "cancelled" && (
        <div className={styles.actions}>
          <button
            className={styles.actionBtn}
            onClick={() => setShowCancelConfirm(true)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            Cancel
          </button>
          <button className={styles.actionBtn} onClick={handleDuplicate}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
            Duplicate
          </button>
          <button className={styles.actionBtn} onClick={() => onEdit?.(event)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
            </svg>
            Edit
          </button>
          {isPast && event.paid && (
            <button
              className={`${styles.actionBtn} ${styles.primary}`}
              onClick={() => onMarkAttendance?.(event)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 11 12 14 22 4" />
                <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
              </svg>
              Mark who attended
            </button>
          )}
        </div>
      )}
    </div>
  );

  return (
    <BottomSheet open={open} onClose={onClose} title="">
      {content}
    </BottomSheet>
  );
}
