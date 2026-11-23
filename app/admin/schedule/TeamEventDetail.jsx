"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import styles from "./TeamEventDetail.module.css";
import BottomSheet from "../components/BottomSheet";
import { cancelTeamEvent, duplicateTeamEvent, deletePublicRsvp } from "@/lib/team-events/actions";

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
  const [publicRsvps, setPublicRsvps] = useState([]);
  const [loadingRsvps, setLoadingRsvps] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);

  // Fetch public RSVPs when event has public_rsvp
  useEffect(() => {
    if (!open || !event?.id || !event?.public_rsvp) return;

    let cancelled = false;

    // Schedule loading state for next tick
    const loadingTimer = setTimeout(() => {
      if (!cancelled) setLoadingRsvps(true);
    }, 0);

    fetch(`/api/admin/team-events/${event.id}/rsvps`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch RSVPs");
        return res.json();
      })
      .then((rsvps) => {
        if (!cancelled) {
          setPublicRsvps(rsvps || []);
          setLoadingRsvps(false);
        }
      })
      .catch((err) => {
        console.error("Error fetching public RSVPs:", err);
        if (!cancelled) setLoadingRsvps(false);
      });

    return () => {
      cancelled = true;
      clearTimeout(loadingTimer);
    };
  }, [open, event?.id, event?.public_rsvp]);

  if (!event) return null;

  // Public RSVP counts
  const publicComing = publicRsvps.filter((r) => r.attending);
  const publicNotComing = publicRsvps.filter((r) => !r.attending);
  const publicTotal = publicComing.reduce(
    (sum, r) => sum + 1 + (r.guest_adults || 0) + (r.guest_kids || 0),
    0
  );
  const publicAdults = publicComing.reduce((sum, r) => sum + (r.guest_adults || 0), 0);
  const publicKids = publicComing.reduce((sum, r) => sum + (r.guest_kids || 0), 0);

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

  // Copy public link
  const handleCopyLink = async () => {
    if (!event.public_slug) return;
    const url = `${window.location.origin}/party/${event.public_slug}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Copy RSVP list
  const handleCopyList = async () => {
    const comingList = publicComing.map((r) => {
      const parts = [r.name];
      if (r.guest_adults > 0) parts.push(`+${r.guest_adults} adult${r.guest_adults > 1 ? "s" : ""}`);
      if (r.guest_kids > 0) parts.push(`+${r.guest_kids} kid${r.guest_kids > 1 ? "s" : ""}`);
      return parts.join(" ");
    }).join(", ");

    const notComingList = publicNotComing.map((r) => r.name).join(", ");

    let text = `Coming (${publicComing.length}, ${publicTotal} people total): ${comingList || "none"}`;
    if (publicNotComing.length > 0) {
      text += `\n\nCan't make it: ${notComingList}`;
    }

    try {
      await navigator.clipboard.writeText(text);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // Export CSV
  const handleExportCSV = () => {
    const rows = [["Name", "Attending", "Adults", "Kids", "Total", "Note", "Replied"]];
    publicRsvps.forEach((r) => {
      const total = r.attending ? 1 + (r.guest_adults || 0) + (r.guest_kids || 0) : 0;
      const replied = new Date(r.created_at).toLocaleDateString();
      rows.push([
        r.name,
        r.attending ? "Yes" : "No",
        r.guest_adults || 0,
        r.guest_kids || 0,
        total,
        r.note || "",
        replied + (r.updated_at !== r.created_at ? " (edited)" : ""),
      ]);
    });
    const csv = rows.map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${event.title.replace(/[^a-z0-9]/gi, "-")}-rsvps.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Delete RSVP
  const handleDeleteRsvp = async (rsvpId) => {
    try {
      await deletePublicRsvp(rsvpId);
      setPublicRsvps((prev) => prev.filter((r) => r.id !== rsvpId));
      setDeleteConfirm(null);
    } catch (err) {
      console.error("Failed to delete RSVP:", err);
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

      {/* Public RSVP Section (when public_rsvp is on) */}
      {event.public_rsvp && (
        <div className={styles.publicRsvpSection}>
          <div className={styles.publicRsvpHeader}>
            <h3 className={styles.sectionTitle}>RSVPs</h3>
            <div className={styles.publicRsvpActions}>
              <button className={styles.smallBtn} onClick={handleCopyLink}>
                {linkCopied ? "Copied!" : "Copy link"}
              </button>
              <button className={styles.smallBtn} onClick={handleCopyList}>
                Copy list
              </button>
              <button className={styles.smallBtn} onClick={handleExportCSV}>
                Export CSV
              </button>
            </div>
          </div>

          {/* Summary tiles */}
          <div className={styles.rsvpTiles}>
            <div className={`${styles.rsvpTile} ${styles.tilePrimary}`}>
              <span className={styles.tileValue}>{publicTotal}</span>
              <span className={styles.tileLabel}>Total headcount</span>
            </div>
            <div className={styles.rsvpTile}>
              <span className={styles.tileValue}>{publicComing.length}</span>
              <span className={styles.tileLabel}>Coming</span>
            </div>
            <div className={styles.rsvpTile}>
              <span className={styles.tileValue}>{publicAdults}</span>
              <span className={styles.tileLabel}>Adult guests</span>
            </div>
            <div className={styles.rsvpTile}>
              <span className={styles.tileValue}>{publicKids}</span>
              <span className={styles.tileLabel}>Kids</span>
            </div>
          </div>

          {/* RSVP table */}
          {loadingRsvps ? (
            <p className={styles.loading}>Loading RSVPs...</p>
          ) : publicRsvps.length === 0 ? (
            <p className={styles.emptyRsvp}>No RSVPs yet</p>
          ) : (
            <div className={styles.rsvpTable}>
              {publicRsvps.map((rsvp) => (
                <div key={rsvp.id} className={styles.rsvpRow}>
                  <div className={styles.rsvpRowMain}>
                    <span className={styles.rsvpName}>{rsvp.name}</span>
                    <span className={`${styles.rsvpPill} ${rsvp.attending ? styles.pillYes : styles.pillNo}`}>
                      {rsvp.attending ? "Coming" : "Can't make it"}
                    </span>
                  </div>
                  {rsvp.attending && (rsvp.guest_adults > 0 || rsvp.guest_kids > 0) && (
                    <div className={styles.rsvpGuests}>
                      {rsvp.guest_adults > 0 && (
                        <span>+{rsvp.guest_adults} adult{rsvp.guest_adults > 1 ? "s" : ""}</span>
                      )}
                      {rsvp.guest_kids > 0 && (
                        <span>+{rsvp.guest_kids} kid{rsvp.guest_kids > 1 ? "s" : ""}</span>
                      )}
                      <span className={styles.rsvpGroupTotal}>
                        = {1 + rsvp.guest_adults + rsvp.guest_kids} people
                      </span>
                    </div>
                  )}
                  {rsvp.note && <div className={styles.rsvpNote}>{rsvp.note}</div>}
                  <div className={styles.rsvpMeta}>
                    <span>{new Date(rsvp.created_at).toLocaleDateString()}</span>
                    {rsvp.updated_at !== rsvp.created_at && <span> (edited)</span>}
                    <button
                      className={styles.deleteBtn}
                      onClick={() => setDeleteConfirm(rsvp.id)}
                    >
                      Delete
                    </button>
                  </div>
                  {deleteConfirm === rsvp.id && (
                    <div className={styles.deleteConfirm}>
                      <span>Delete this RSVP?</span>
                      <button onClick={() => handleDeleteRsvp(rsvp.id)}>Yes</button>
                      <button onClick={() => setDeleteConfirm(null)}>No</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Regular RSVP Summary (when NOT public_rsvp) */}
      {!event.public_rsvp && (
        <>
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
                      <Image src={person.profile.avatar_url} alt="" width={36} height={36} />
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
        </>
      )}

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
