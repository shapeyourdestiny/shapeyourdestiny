"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorDrawer.module.css";
import {
  archiveInstructorAction,
  deleteInstructorAction,
  updateInstructorAction,
  updateInstructorDistrictsAction,
  sendInviteEmailAction,
} from "@/lib/instructors/actions";

const PROGRAM_LABELS = {
  wellness: "Wellness",
  soccer: "Sports",
};

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function formatCertDate(dateStr) {
  if (!dateStr) return "Not on file";
  const date = new Date(dateStr + "T00:00:00");
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
}

function isExpired(dateStr) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

export default function InstructorDrawer({ instructor, districts = [], onClose }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isArchived = instructor.status === "archived";
  const canDelete = instructor.sessionCount === 0;

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
        `Delete ${instructor.full_name}? This will permanently remove them and cannot be undone.`
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
      onClose();
      router.refresh();
    }
  };

  return (
    <aside className={styles.drawer} aria-label="Instructor details">
      {/* Header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={() => onClose()}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
        <div className={styles.headerInfo}>
          {instructor.headshotUrl ? (
            <img
              src={instructor.headshotUrl}
              alt=""
              className={styles.headerAvatar}
            />
          ) : (
            <div className={styles.headerAvatarPlaceholder}>
              {instructor.full_name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2)}
            </div>
          )}
          <div>
            <h2 className={styles.headerName}>{instructor.full_name}</h2>
            <div className={styles.headerMeta}>
              <span className={`${styles.statusBadge} ${styles[instructor.status === "not_invited" ? "invited" : instructor.status]}`}>
                {instructor.status === "not_invited" ? "Not invited" :
                 instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={styles.content}>
        <OverviewTab
          instructor={instructor}
          districts={districts}
          onArchive={handleArchive}
          onDelete={handleDelete}
          loading={loading}
          isArchived={isArchived}
          canDelete={canDelete}
        />
      </div>
    </aside>
  );
}

function OverviewTab({ instructor, districts, onArchive, onDelete, loading, isArchived, canDelete }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [fullName, setFullName] = useState(instructor.full_name || "");
  const [phone, setPhone] = useState(instructor.phone || "");
  const [cprExpires, setCprExpires] = useState(instructor.cpr_expiration || "");
  const [foodHandlerExpires, setFoodHandlerExpires] = useState(instructor.food_handler_expiration || "");
  const [selectedDistrictIds, setSelectedDistrictIds] = useState(
    instructor.districtList?.map((d) => d.id) || []
  );
  const [saving, setSaving] = useState(false);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  const isNotInvited = instructor.status === "not_invited";
  const isInvited = instructor.status === "invited";
  const needsAccount = !instructor.hasAccount;

  const handleToggleDistrict = (districtId) => {
    setSelectedDistrictIds((prev) =>
      prev.includes(districtId)
        ? prev.filter((id) => id !== districtId)
        : [...prev, districtId]
    );
  };

  const handleSave = async () => {
    setSaving(true);

    // Update profile info
    const profileResult = await updateInstructorAction(instructor.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
      cpr_expires: cprExpires || null,
      food_handler_expires: foodHandlerExpires || null,
    });

    if (profileResult.error) {
      alert(profileResult.error);
      setSaving(false);
      return;
    }

    // Update districts
    const districtsResult = await updateInstructorDistrictsAction(
      instructor.id,
      selectedDistrictIds
    );

    setSaving(false);

    if (districtsResult.error) {
      alert(districtsResult.error);
    } else {
      setEditing(false);
      router.refresh();
    }
  };

  const handleCancel = () => {
    setEditing(false);
    setFullName(instructor.full_name || "");
    setPhone(instructor.phone || "");
    setCprExpires(instructor.cpr_expiration || "");
    setFoodHandlerExpires(instructor.food_handler_expiration || "");
    setSelectedDistrictIds(instructor.districtList?.map((d) => d.id) || []);
  };

  return (
    <div className={styles.overviewTab}>
      {/* Contact & Details */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h3>Details</h3>
          {!editing && (
            <button
              type="button"
              className={styles.editLink}
              onClick={() => setEditing(true)}
            >
              Edit
            </button>
          )}
        </div>
        <div className={styles.detailRow}>
          <span>Name</span>
          {editing ? (
            <input
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={styles.inlineInput}
              placeholder="Full name"
            />
          ) : (
            <span>{instructor.full_name}</span>
          )}
        </div>
        <div className={styles.detailRow}>
          <span>Email</span>
          <span>{instructor.email || "—"}</span>
        </div>
        <div className={styles.detailRow}>
          <span>Phone</span>
          {editing ? (
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={styles.inlineInput}
              placeholder="(555) 123-4567"
            />
          ) : (
            <span>{instructor.phone || "—"}</span>
          )}
        </div>
        <div className={styles.detailRow}>
          <span>Joined</span>
          <span>{formatDate(instructor.created_at)}</span>
        </div>
      </div>

      {/* Districts */}
      <div className={styles.section}>
        <h3>Districts</h3>
        {editing ? (
          <div className={styles.districtGrid}>
            {districts.map((d) => (
              <label key={d.id} className={styles.districtCheckbox}>
                <input
                  type="checkbox"
                  checked={selectedDistrictIds.includes(d.id)}
                  onChange={() => handleToggleDistrict(d.id)}
                />
                <span
                  className={styles.districtDot}
                  style={{ background: d.color }}
                />
                <span>{d.name}</span>
              </label>
            ))}
            {districts.length === 0 && (
              <p className={styles.empty}>No districts available</p>
            )}
          </div>
        ) : instructor.districtList.length > 0 ? (
          <div className={styles.chipList}>
            {instructor.districtList.map((d) => (
              <span key={d.id} className={styles.chip}>{d.name}</span>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No districts assigned</p>
        )}
      </div>

      {/* Programs */}
      <div className={styles.section}>
        <h3>Programs</h3>
        {instructor.programs.length > 0 ? (
          <div className={styles.chipList}>
            {instructor.programs.map((p) => (
              <span key={p} className={styles.chip}>{PROGRAM_LABELS[p] || p}</span>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>No programs assigned</p>
        )}
      </div>

      {/* Certifications */}
      <div className={styles.section}>
        <h3>Certifications</h3>
        <div className={styles.detailRow}>
          <span>CPR Expires</span>
          {editing ? (
            <input
              type="date"
              value={cprExpires}
              onChange={(e) => setCprExpires(e.target.value)}
              className={styles.inlineInput}
            />
          ) : (
            <span className={isExpired(instructor.cpr_expiration) ? styles.expired : ""}>
              {formatCertDate(instructor.cpr_expiration)}
            </span>
          )}
        </div>
        <div className={styles.detailRow}>
          <span>Food Handler Expires</span>
          {editing ? (
            <input
              type="date"
              value={foodHandlerExpires}
              onChange={(e) => setFoodHandlerExpires(e.target.value)}
              className={styles.inlineInput}
            />
          ) : (
            <span className={isExpired(instructor.food_handler_expiration) ? styles.expired : ""}>
              {formatCertDate(instructor.food_handler_expiration)}
            </span>
          )}
        </div>
      </div>

      {/* Save/Cancel Actions */}
      {editing && (
        <div className={styles.editActions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => handleCancel()}
          >
            Cancel
          </button>
          <button
            type="button"
            className={styles.saveBtn}
            onClick={() => handleSave()}
            disabled={saving}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </div>
      )}

      {/* Invite Section - for not_invited or invited instructors */}
      {needsAccount && (
        <div className={styles.section}>
          <h3>Account</h3>
          {isNotInvited ? (
            <div className={styles.inviteBox}>
              <p className={styles.inviteText}>
                This instructor does not have an account yet. Send them an invite email to create one.
              </p>
              {inviteSent ? (
                <div className={styles.inviteSent}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                  Invite sent!
                </div>
              ) : (
                <div className={styles.inviteForm}>
                  <input
                    type="email"
                    className={styles.inviteInput}
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="instructor@email.com"
                  />
                  <button
                    type="button"
                    className={styles.inviteBtn}
                    disabled={sendingInvite || !inviteEmail.includes("@")}
                    onClick={async () => {
                      setSendingInvite(true);
                      const result = await sendInviteEmailAction(instructor.id, inviteEmail);
                      setSendingInvite(false);
                      if (result.error) {
                        alert(result.error);
                      } else {
                        setInviteSent(true);
                        router.refresh();
                      }
                    }}
                  >
                    {sendingInvite ? "Sending..." : "Send invite"}
                  </button>
                </div>
              )}
            </div>
          ) : isInvited ? (
            <div className={styles.inviteBox}>
              <div className={styles.invitedStatus}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="5" width="18" height="14" rx="2" />
                  <path d="M3 7l9 6 9-6" />
                </svg>
                <span>Invite sent, waiting for sign-up</span>
              </div>
              <button
                type="button"
                className={styles.resendBtn}
                disabled={sendingInvite}
                onClick={async () => {
                  const email = prompt("Resend invite to which email?", instructor.email || "");
                  if (!email) return;
                  setSendingInvite(true);
                  const result = await sendInviteEmailAction(instructor.id, email);
                  setSendingInvite(false);
                  if (result.error) {
                    alert(result.error);
                  } else {
                    alert("Invite resent!");
                    router.refresh();
                  }
                }}
              >
                Resend invite
              </button>
            </div>
          ) : null}
        </div>
      )}

      {/* Archive/Delete Actions */}
      <div className={styles.archiveSection}>
        <div className={styles.actionButtons}>
          <button
            type="button"
            className={`${styles.archiveBtn} ${isArchived ? styles.restore : ""}`}
            onClick={onArchive}
            disabled={loading}
          >
            {isArchived ? "Restore Instructor" : "Archive Instructor"}
          </button>
          <button
            type="button"
            className={styles.deleteBtn}
            onClick={onDelete}
            disabled={loading || !canDelete}
          >
            Delete
          </button>
        </div>
        <p className={styles.archiveNote}>
          {isArchived
            ? "Restoring will make them available for scheduling again."
            : "Archiving removes them from scheduling immediately."}
        </p>
        {!canDelete && (
          <p className={styles.deleteNote}>
            Delete is disabled because this instructor has session history. Use Archive instead.
          </p>
        )}
      </div>
    </div>
  );
}
