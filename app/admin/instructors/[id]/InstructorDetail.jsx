"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorDetail.module.css";
import {
  archiveInstructorAction,
  deleteInstructorAction,
  sendPasswordResetAction,
  updateInstructorAction,
} from "@/lib/instructors/actions";
import Modal from "@/app/admin/components/Modal";

const AVATAR_COLORS = [
  "#D8AE4B",
  "#6FCB55",
  "#3FC0E8",
  "#2B4FA3",
  "#3E8FA0",
  "#F2A65E",
];

function getAvatarColor(name) {
  const hash = name.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatDateShort(dateStr) {
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

function formatDateYear(dateStr) {
  const date = new Date(dateStr);
  return date.getFullYear().toString();
}

function formatSessionDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${days[date.getDay()]}, ${months[date.getMonth()]} ${date.getDate()}`;
}

function formatCertDate(dateStr) {
  const date = new Date(dateStr + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

export default function InstructorDetail({ instructor }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editPhone, setEditPhone] = useState(instructor.phone || "");
  const [editCprExpires, setEditCprExpires] = useState(instructor.cpr_expires || "");
  const [editFoodHandlerExpires, setEditFoodHandlerExpires] = useState(instructor.food_handler_expires || "");

  const canDelete = instructor.totalSessions === 0;
  const isArchived = instructor.status === "archived";

  const handleBack = () => {
    router.push("/admin/instructors");
  };

  const handleArchive = async () => {
    if (!confirm(`${isArchived ? "Restore" : "Archive"} ${instructor.full_name}?`)) {
      return;
    }

    setLoading(true);
    const result = await archiveInstructorAction(instructor.id, !isArchived);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleDelete = async () => {
    if (!canDelete) return;

    if (
      !confirm(
        `Delete ${instructor.full_name}? This will permanently remove their account and cannot be undone.`
      )
    ) {
      return;
    }

    setLoading(true);
    const result = await deleteInstructorAction(instructor.id);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.push("/admin/instructors");
    }
  };

  const handleResetPassword = async () => {
    if (!confirm(`Send password reset email to ${instructor.full_name}?`)) {
      return;
    }

    setLoading(true);
    const result = await sendPasswordResetAction(instructor.id);
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      alert(`Password reset email sent to ${result.email}`);
    }
  };

  const handleOpenEdit = () => {
    setEditPhone(instructor.phone || "");
    setEditCprExpires(instructor.cpr_expires || "");
    setEditFoodHandlerExpires(instructor.food_handler_expires || "");
    setEditModalOpen(true);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    const result = await updateInstructorAction(instructor.id, {
      phone: editPhone.trim(),
      cpr_expires: editCprExpires || null,
      food_handler_expires: editFoodHandlerExpires || null,
    });
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      setEditModalOpen(false);
      router.refresh();
    }
  };

  // Build session breakdown string
  const sessionBreakdown = [];
  if (instructor.sessionsByProgram?.wellness > 0) {
    sessionBreakdown.push(`${instructor.sessionsByProgram.wellness} Wellness`);
  }
  if (instructor.sessionsByProgram?.soccer > 0) {
    sessionBreakdown.push(`${instructor.sessionsByProgram.soccer} Soccer`);
  }

  // Next session date
  const nextSession = instructor.upcomingSessions?.[0];
  const nextSessionText = nextSession
    ? formatSessionDate(nextSession.date)
    : "None scheduled";

  return (
    <div className={styles.container}>
      <button type="button" className={styles.backLink} onClick={handleBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Back to Instructors
      </button>

      <div className={styles.header}>
        <div
          className={styles.avatar}
          style={{ background: getAvatarColor(instructor.full_name) }}
        >
          {getInitials(instructor.full_name)}
        </div>
        <div className={styles.headerInfo}>
          <h1 className={styles.name}>{instructor.full_name}</h1>
          <div className={styles.meta}>
            <span className={`${styles.statusBadge} ${styles[instructor.status]}`}>
              {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
            </span>
            <span className={styles.roleTag}>
              {instructor.role.charAt(0).toUpperCase() + instructor.role.slice(1)}
            </span>
          </div>
        </div>
        <button
          type="button"
          className={styles.editBtn}
          onClick={handleOpenEdit}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
            <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z" />
          </svg>
          Edit Info
        </button>
      </div>

      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{instructor.totalSessions}</div>
          <div className={styles.statLabel}>Sessions Taught</div>
          {sessionBreakdown.length > 0 && (
            <div className={styles.statBreakdown}>
              {sessionBreakdown.join(" \u00B7 ")}
            </div>
          )}
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{instructor.upcomingCount}</div>
          <div className={styles.statLabel}>Upcoming Sessions</div>
          <div className={styles.statBreakdown}>Next: {nextSessionText}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>
            {formatDateShort(instructor.created_at)}
          </div>
          <div className={styles.statLabel}>Joined</div>
          <div className={styles.statBreakdown}>
            {formatDateYear(instructor.created_at)}
          </div>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.infoCard}>
          <h3>Contact</h3>
          <div className={styles.infoRow}>
            <span>Email</span>
            <span>{instructor.email || "Not available"}</span>
          </div>
          <div className={styles.infoRow}>
            <span>Phone</span>
            <span>{instructor.phone || "Not on file"}</span>
          </div>
        </div>
        <div className={styles.infoCard}>
          <h3>Certifications</h3>
          <div className={styles.infoRow}>
            <span>CPR Expires</span>
            <span className={instructor.cpr_expires && new Date(instructor.cpr_expires) < new Date() ? styles.expired : ""}>
              {instructor.cpr_expires ? formatCertDate(instructor.cpr_expires) : "Not on file"}
            </span>
          </div>
          <div className={styles.infoRow}>
            <span>Food Handler Expires</span>
            <span className={instructor.food_handler_expires && new Date(instructor.food_handler_expires) < new Date() ? styles.expired : ""}>
              {instructor.food_handler_expires ? formatCertDate(instructor.food_handler_expires) : "Not on file"}
            </span>
          </div>
        </div>
      </div>

      <div className={styles.detailGrid}>
        <div className={styles.infoCard}>
          <h3>Districts</h3>
          {instructor.districts.length > 0 ? (
            instructor.districts.map((district) => (
              <div key={district.id} className={styles.infoRow}>
                <span>{district.name}</span>
                <span>{district.sessionCount} sessions</span>
              </div>
            ))
          ) : (
            <div className={styles.emptyNote}>No districts assigned</div>
          )}
        </div>
      </div>

      <div className={styles.sectionCard}>
        <h3>Reviews &amp; Audits</h3>
        <div className={styles.emptyNote}>Nothing open right now</div>
      </div>

      <div className={styles.sectionCard}>
        <h3>Upcoming Sessions</h3>
        {instructor.upcomingSessions.length > 0 ? (
          instructor.upcomingSessions.map((session, idx) => (
            <div key={idx} className={styles.miniRow}>
              <span
                className={styles.miniDot}
                style={{ background: "#3E8FA0" }}
              />
              <span className={styles.miniRowText}>
                {session.schoolName}
                <div className={styles.miniRowSub}>
                  {formatSessionDate(session.date)} &middot; {session.time}
                </div>
              </span>
            </div>
          ))
        ) : (
          <div className={styles.emptyNote}>No upcoming sessions scheduled</div>
        )}
      </div>

      <div className={styles.sectionCard}>
        <h3>Account Actions</h3>
        <div className={styles.actionRow}>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.reset}`}
            onClick={handleResetPassword}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="11" width="18" height="10" rx="2" />
              <path d="M7 11V7a5 5 0 0110 0v4" />
            </svg>
            Send Password Reset
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.archive}`}
            onClick={handleArchive}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="3" y="4" width="18" height="4" rx="1" />
              <path d="M4 8v10a2 2 0 002 2h12a2 2 0 002-2V8M10 12h4" />
            </svg>
            {isArchived ? "Restore Instructor" : "Archive Instructor"}
          </button>
          <button
            type="button"
            className={`${styles.actionBtn} ${styles.delete}`}
            onClick={handleDelete}
            disabled={loading || !canDelete}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14z" />
            </svg>
            Delete Instructor
          </button>
        </div>
        {!canDelete && (
          <p className={styles.deleteNote}>
            Delete is disabled because this instructor has {instructor.totalSessions}{" "}
            session(s) of history. Use Archive instead to preserve their records.
            Delete only becomes available for accounts with zero session history.
          </p>
        )}
      </div>

      <Modal open={editModalOpen} onClose={() => setEditModalOpen(false)}>
        <div className={styles.editModal}>
          <h2>Edit Instructor Info</h2>

          <div className={styles.editField}>
            <label htmlFor="editPhone">Phone Number</label>
            <input
              type="tel"
              id="editPhone"
              value={editPhone}
              onChange={(e) => setEditPhone(e.target.value)}
              placeholder="(555) 123-4567"
            />
          </div>

          <div className={styles.editField}>
            <label htmlFor="editCprExpires">CPR Certification Expires</label>
            <input
              type="date"
              id="editCprExpires"
              value={editCprExpires}
              onChange={(e) => setEditCprExpires(e.target.value)}
            />
          </div>

          <div className={styles.editField}>
            <label htmlFor="editFoodHandlerExpires">Food Handler Expires</label>
            <input
              type="date"
              id="editFoodHandlerExpires"
              value={editFoodHandlerExpires}
              onChange={(e) => setEditFoodHandlerExpires(e.target.value)}
            />
          </div>

          <div className={styles.editActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => setEditModalOpen(false)}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveEdit}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
