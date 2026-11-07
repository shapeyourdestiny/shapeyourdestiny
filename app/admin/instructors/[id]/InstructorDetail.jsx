"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import styles from "./InstructorDetail.module.css";
import {
  archiveInstructorAction,
  deleteInstructorAction,
  sendPasswordResetAction,
  updateInstructorAction,
  updateInstructorDistrictsAction,
  sendInviteEmailAction,
  updatePayRateAction,
} from "@/lib/instructors/actions";
import NotesHistory from "./NotesHistory";
import AttendanceTab from "./AttendanceTab";
import { formatPhone } from "@/lib/format";

const AVATAR_COLORS = [
  "#3E8FA0",
  "#6FCB55",
  "#3FC0E8",
  "#2B4FA3",
  "#2C6E7D",
  "#1F3F91",
];

const PROGRAM_LABELS = {
  wellness: "Wellness",
  soccer: "Sports",
};

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

function formatDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`;
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

const CALENDAR_APPS = {
  apple: "Apple Calendar",
  google: "Google Calendar",
  outlook: "Outlook",
  other: "other app",
};

export default function InstructorDetail({ instructor, districts = [], notesData, attendanceData, calendarSyncStatus, payRate: initialPayRate }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [fullName, setFullName] = useState(instructor.full_name || "");
  const [phone, setPhone] = useState(instructor.phone || "");
  const [selectedDistrictIds, setSelectedDistrictIds] = useState(
    instructor.districts?.map((d) => d.id) || []
  );

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);

  // Pay rate state
  const [payRate, setPayRate] = useState(initialPayRate);
  const [editingPay, setEditingPay] = useState(false);
  const [payRateInput, setPayRateInput] = useState(initialPayRate?.toString() || "");
  const [savingPay, setSavingPay] = useState(false);

  // Tab state from URL
  const currentTab = searchParams.get("tab") || "details";

  const handleTabChange = (tab) => {
    const params = new URLSearchParams(searchParams);
    if (tab === "details") {
      params.delete("tab");
    } else {
      params.set("tab", tab);
    }
    const query = params.toString();
    router.push(`/admin/instructors/${instructor.id}${query ? `?${query}` : ""}`, { scroll: false });
  };

  const handleRefreshNotes = () => {
    router.refresh();
  };

  const canDelete = instructor.totalSessions === 0;
  const isArchived = instructor.status === "archived";
  const isNotInvited = instructor.status === "not_invited";
  const isInvited = instructor.status === "invited";
  const needsAccount = !instructor.hasAccount;

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

  const handleStartEdit = () => {
    setFullName(instructor.full_name || "");
    setPhone(instructor.phone || "");
    setSelectedDistrictIds(instructor.districts?.map((d) => d.id) || []);
    setEditing(true);
  };

  const handleCancelEdit = () => {
    setEditing(false);
  };

  const handleToggleDistrict = (districtId) => {
    setSelectedDistrictIds((prev) =>
      prev.includes(districtId)
        ? prev.filter((id) => id !== districtId)
        : [...prev, districtId]
    );
  };

  const handleSaveEdit = async () => {
    setLoading(true);

    // Update profile info
    const profileResult = await updateInstructorAction(instructor.id, {
      full_name: fullName.trim(),
      phone: phone.trim(),
    });

    if (profileResult.error) {
      alert(profileResult.error);
      setLoading(false);
      return;
    }

    // Update districts
    const districtsResult = await updateInstructorDistrictsAction(
      instructor.id,
      selectedDistrictIds
    );

    setLoading(false);

    if (districtsResult.error) {
      alert(districtsResult.error);
    } else {
      setEditing(false);
      router.refresh();
    }
  };

  const handleSendInvite = async () => {
    setSendingInvite(true);
    const result = await sendInviteEmailAction(instructor.id, inviteEmail);
    setSendingInvite(false);
    if (result.error) {
      alert(result.error);
    } else {
      setInviteSent(true);
      router.refresh();
    }
  };

  const handleResendInvite = async () => {
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
  };

  const handleStartEditPay = () => {
    setPayRateInput(payRate?.toString() || "");
    setEditingPay(true);
  };

  const handleCancelEditPay = () => {
    setEditingPay(false);
  };

  const handleSavePay = async () => {
    setSavingPay(true);
    const result = await updatePayRateAction(instructor.id, payRateInput);
    setSavingPay(false);
    if (result.error) {
      alert(result.error);
    } else {
      setPayRate(parseFloat(payRateInput));
      setEditingPay(false);
    }
  };

  // Status badge text
  const statusText = instructor.status === "not_invited"
    ? "Not invited"
    : instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1);

  return (
    <div className={styles.container}>
      <button type="button" className={styles.backLink} onClick={handleBack}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Instructors
      </button>

      {/* Header Card */}
      <div className={styles.headerCard}>
        <div className={styles.headerMain}>
          {instructor.headshotUrl ? (
            <img
              src={instructor.headshotUrl}
              alt=""
              className={styles.avatar}
            />
          ) : (
            <div
              className={styles.avatarPlaceholder}
              style={{ background: getAvatarColor(instructor.full_name) }}
            >
              {getInitials(instructor.full_name)}
            </div>
          )}
          <div className={styles.headerInfo}>
            <div className={styles.nameRow}>
              <h1 className={styles.name}>{instructor.full_name}</h1>
              <span className={`${styles.statusBadge} ${styles[instructor.status === "not_invited" ? "invited" : instructor.status]}`}>
                {statusText}
              </span>
              {instructor.role === "admin" && (
                <span className={styles.adminBadge}>Admin</span>
              )}
            </div>
            <div className={styles.joinedText}>
              Joined {formatDate(instructor.created_at)}
            </div>
          </div>
        </div>

        {/* Contact Tiles */}
        <div className={styles.contactTiles}>
          <a
            href={instructor.email ? `mailto:${instructor.email}` : undefined}
            className={`${styles.contactTile} ${!instructor.email ? styles.contactTileEmpty : ""}`}
            onClick={(e) => !instructor.email && e.preventDefault()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <path d="M3 7l9 6 9-6" />
            </svg>
            <span>{instructor.email || "No email"}</span>
          </a>
          <a
            href={instructor.phone ? `tel:${instructor.phone}` : undefined}
            className={`${styles.contactTile} ${!instructor.phone ? styles.contactTileEmpty : ""}`}
            onClick={(e) => !instructor.phone && e.preventDefault()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z" />
            </svg>
            <span>{formatPhone(instructor.phone)}</span>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabRow}>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === "details" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("details")}
        >
          Details
        </button>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === "schedule" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("schedule")}
        >
          Schedule
        </button>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === "attendance" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("attendance")}
        >
          Attendance &amp; time off
        </button>
        <button
          type="button"
          className={`${styles.tab} ${currentTab === "notes" ? styles.tabActive : ""}`}
          onClick={() => handleTabChange("notes")}
        >
          Notes &amp; history
        </button>
        <div className={styles.lockPill}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Admins only. {instructor.full_name.split(" ")[0]} never sees this tab.
        </div>
      </div>

      {/* Details Tab */}
      {currentTab === "details" && (
        <div className={styles.detailsTab}>
          <div className={styles.detailsGrid}>
            {/* Contact Section */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3>Contact</h3>
                {!editing && (
                  <button
                    type="button"
                    className={styles.editLink}
                    onClick={handleStartEdit}
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
                  <span>{formatPhone(instructor.phone)}</span>
                )}
              </div>
            </div>

            {/* Programs Section */}
            <div className={styles.sectionCard}>
              <h3>Programs</h3>
              {instructor.sessionsByProgram && (
                instructor.sessionsByProgram.wellness > 0 ||
                instructor.sessionsByProgram.soccer > 0
              ) ? (
                <div className={styles.chipList}>
                  {instructor.sessionsByProgram.wellness > 0 && (
                    <span className={styles.chip}>{PROGRAM_LABELS.wellness}</span>
                  )}
                  {instructor.sessionsByProgram.soccer > 0 && (
                    <span className={styles.chip}>{PROGRAM_LABELS.soccer}</span>
                  )}
                </div>
              ) : (
                <p className={styles.emptyNote}>No programs assigned</p>
              )}
            </div>

            {/* Districts Section */}
            <div className={styles.sectionCard}>
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
                    <p className={styles.emptyNote}>No districts available</p>
                  )}
                </div>
              ) : instructor.districts?.length > 0 ? (
                <div className={styles.chipList}>
                  {instructor.districts.map((d) => (
                    <span key={d.id} className={styles.chip}>{d.name}</span>
                  ))}
                </div>
              ) : (
                <p className={styles.emptyNote}>No districts assigned</p>
              )}
            </div>

            {/* Pay Section */}
            <div className={styles.sectionCard}>
              <div className={styles.sectionHeader}>
                <h3>Pay</h3>
                {!editingPay && (
                  <button
                    type="button"
                    className={styles.editLink}
                    onClick={handleStartEditPay}
                  >
                    Edit
                  </button>
                )}
              </div>
              <div className={styles.detailRow}>
                <span>Rate per class</span>
                {editingPay ? (
                  <div className={styles.payInputRow}>
                    <span className={styles.payDollar}>$</span>
                    <input
                      type="number"
                      value={payRateInput}
                      onChange={(e) => setPayRateInput(e.target.value)}
                      className={styles.payInput}
                      placeholder="0.00"
                      min="0"
                      step="0.01"
                    />
                  </div>
                ) : (
                  <span>{payRate != null ? `$${Number(payRate).toFixed(2)}` : "—"}</span>
                )}
              </div>
              {editingPay && (
                <div className={styles.payActions}>
                  <button
                    type="button"
                    className={styles.payCancelBtn}
                    onClick={handleCancelEditPay}
                    disabled={savingPay}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className={styles.paySaveBtn}
                    onClick={handleSavePay}
                    disabled={savingPay}
                  >
                    {savingPay ? "Saving..." : "Save"}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Save/Cancel Actions */}
          {editing && (
            <div className={styles.editActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={handleCancelEdit}
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
          )}

          {/* Account Section */}
          {needsAccount && (
            <div className={styles.sectionCard}>
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
                        onClick={handleSendInvite}
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
                    onClick={handleResendInvite}
                  >
                    Resend invite
                  </button>
                </div>
              ) : null}
            </div>
          )}

          {/* Account Actions */}
          <div className={styles.sectionCard}>
            <h3>Account Actions</h3>
            <div className={styles.actionRow}>
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.reset}`}
                onClick={handleResetPassword}
                disabled={loading || !instructor.hasAccount}
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
              </p>
            )}
          </div>

          {/* Calendar sync status (muted line) */}
          <p className={styles.calendarSyncNote}>
            Calendar sync: {calendarSyncStatus?.enabled
              ? `on${calendarSyncStatus.calendar_app ? ` (${CALENDAR_APPS[calendarSyncStatus.calendar_app] || calendarSyncStatus.calendar_app})` : ""}`
              : "off"}
          </p>
        </div>
      )}

      {/* Schedule Tab */}
      {currentTab === "schedule" && (
        <div className={styles.sectionCard}>
          <h3>Upcoming Sessions</h3>
          {instructor.upcomingSessions?.length > 0 ? (
            instructor.upcomingSessions.map((session, idx) => (
              <div key={idx} className={styles.sessionRow}>
                <span
                  className={styles.sessionDot}
                  style={{ background: session.program === "soccer" ? "#6FCB55" : "#3E8FA0" }}
                />
                <span className={styles.sessionText}>
                  {session.schoolName}
                  <div className={styles.sessionSub}>
                    {formatSessionDate(session.date)} &middot; {session.time}
                  </div>
                </span>
              </div>
            ))
          ) : (
            <div className={styles.emptyNote}>No upcoming sessions scheduled</div>
          )}
        </div>
      )}

      {/* Attendance & Time Off Tab */}
      {currentTab === "attendance" && attendanceData && (
        <AttendanceTab
          instructor={instructor}
          attendanceData={attendanceData}
          onRefresh={handleRefreshNotes}
        />
      )}

      {/* Notes & History Tab */}
      {currentTab === "notes" && notesData && (
        <NotesHistory
          instructor={instructor}
          notesData={notesData}
          onRefresh={handleRefreshNotes}
        />
      )}
    </div>
  );
}
