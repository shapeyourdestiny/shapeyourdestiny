"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  updateInstructorCertification,
  updateMyStaffProfile,
  uploadMyHeadshot,
  removeMyHeadshot,
} from "@/lib/instructors/self-service";
import { computeCertStatus, formatExpirationDate } from "@/lib/certifications/status";
import styles from "./page.module.css";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function formatJoinedDate(dateStr) {
  if (!dateStr) return "—";
  const date = new Date(dateStr);
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

export default function ProfileClient({ profile }) {
  const router = useRouter();
  const fileInputRef = useRef(null);

  // Certification state
  const [cprExpiration, setCprExpiration] = useState(profile.cpr_expiration || null);
  const [foodHandlerExpiration, setFoodHandlerExpiration] = useState(profile.food_handler_expiration || null);
  const [editingCert, setEditingCert] = useState(null);
  const [editDate, setEditDate] = useState("");
  const [noCert, setNoCert] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Staff page profile state
  const [staffProfile, setStaffProfile] = useState({
    display_name: profile.display_name || "",
    title: profile.title || "",
    bio: profile.bio || "",
    staff_quote: profile.staff_quote || "",
  });
  const [headshotUrl, setHeadshotUrl] = useState(profile.headshotUrl || null);
  const [editingStaffProfile, setEditingStaffProfile] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const initial = profile.full_name?.charAt(0)?.toUpperCase() || "I";
  const displayInitial = staffProfile.display_name?.charAt(0)?.toUpperCase() || initial;

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/instructor-login");
  };

  const openEditModal = (certType) => {
    setEditingCert(certType);
    setEditDate(certType === "cpr" ? cprExpiration || "" : foodHandlerExpiration || "");
    setNoCert(certType === "food_handler" && !foodHandlerExpiration);
    setError("");
  };

  const closeModal = () => {
    setEditingCert(null);
    setEditDate("");
    setNoCert(false);
    setError("");
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");

    const dateValue = noCert ? null : editDate || null;

    const result = await updateInstructorCertification(profile.id, editingCert, dateValue);

    if (result.error) {
      setError(result.error);
      setSaving(false);
      return;
    }

    // Update local state
    if (editingCert === "cpr") {
      setCprExpiration(dateValue);
    } else {
      setFoodHandlerExpiration(dateValue);
    }

    setSaving(false);
    closeModal();
    router.refresh();
  };

  const cprStatus = computeCertStatus(cprExpiration);
  const foodStatus = computeCertStatus(foodHandlerExpiration);

  // Staff profile handlers
  const handleStaffFieldChange = (field, value) => {
    setStaffProfile((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveStaffProfile = async () => {
    setSavingStaff(true);
    setStaffError("");

    const result = await updateMyStaffProfile(profile.id, staffProfile);

    if (result.error) {
      setStaffError(result.error);
      setSavingStaff(false);
      return;
    }

    setSavingStaff(false);
    setEditingStaffProfile(false);
    router.refresh();
  };

  const handleCancelStaffEdit = () => {
    setStaffProfile({
      display_name: profile.display_name || "",
      title: profile.title || "",
      bio: profile.bio || "",
      staff_quote: profile.staff_quote || "",
    });
    setStaffError("");
    setEditingStaffProfile(false);
  };

  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingPhoto(true);
    setStaffError("");

    const formData = new FormData();
    formData.append("headshot", file);

    const result = await uploadMyHeadshot(profile.id, formData);

    if (result.error) {
      setStaffError(result.error);
      setUploadingPhoto(false);
      return;
    }

    setUploadingPhoto(false);
    router.refresh();
  };

  const handleRemovePhoto = async () => {
    setUploadingPhoto(true);
    setStaffError("");

    const result = await removeMyHeadshot(profile.id);

    if (result.error) {
      setStaffError(result.error);
      setUploadingPhoto(false);
      return;
    }

    setHeadshotUrl(null);
    setUploadingPhoto(false);
    router.refresh();
  };

  const bioCharCount = staffProfile.bio?.length || 0;

  return (
    <div className={styles.page}>
      {/* Hero */}
      <div className={styles.profileHero}>
        <div className={styles.avatar}>{initial}</div>
        <h1 className={styles.profileName}>{profile.full_name}</h1>
        <span className={styles.rolePill}>Instructor</span>
      </div>

      {/* Stats */}
      <div className={styles.statRow}>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{profile.sessionCount}</div>
          <div className={styles.statLabel}>Sessions Taught</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statNum}>{profile.districtCount}</div>
          <div className={styles.statLabel}>Districts</div>
        </div>
      </div>

      {/* Info Card */}
      <div className={styles.infoCard}>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Email</span>
          <span className={styles.infoValue}>{profile.email}</span>
        </div>
        <div className={styles.infoRow}>
          <span className={styles.infoLabel}>Joined</span>
          <span className={styles.infoValue}>{formatJoinedDate(profile.created_at)}</span>
        </div>
      </div>

      {/* Certifications Card */}
      <div className={styles.certCard}>
        <h3>Certifications</h3>

        {/* CPR Row */}
        <div className={styles.certRow}>
          <div className={styles.certIcon} style={{ background: "var(--orange-dark)" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
            </svg>
          </div>
          <div className={styles.certInfo}>
            <div className={styles.certName}>CPR Certification</div>
            <div className={styles.certMeta}>{formatExpirationDate(cprExpiration)}</div>
          </div>
          <div className={styles.certRight}>
            {cprStatus ? (
              <span className={`${styles.certStatus} ${styles[cprStatus.className]}`}>
                {cprStatus.label}
              </span>
            ) : (
              <span className={`${styles.certStatus} ${styles.missing}`}>Not on file</span>
            )}
            <button className={styles.certEditBtn} onClick={() => openEditModal("cpr")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Food Handler Row */}
        <div className={styles.certRow}>
          <div className={styles.certIcon} style={{ background: "#B7C1D8" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M3 3h18v4H3zM5 7v13h14V7M9 12h6" />
            </svg>
          </div>
          <div className={styles.certInfo}>
            <div className={styles.certName}>
              Food Handler&apos;s Card <span className={styles.optional}>(optional)</span>
            </div>
            <div className={styles.certMeta}>
              {foodHandlerExpiration ? formatExpirationDate(foodHandlerExpiration) : "Not on file"}
            </div>
          </div>
          <div className={styles.certRight}>
            {foodHandlerExpiration && foodStatus ? (
              <span className={`${styles.certStatus} ${styles[foodStatus.className]}`}>
                {foodStatus.label}
              </span>
            ) : (
              <span className={`${styles.certStatus} ${styles.optionalPill}`}>Optional</span>
            )}
            <button className={styles.certEditBtn} onClick={() => openEditModal("food_handler")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
              </svg>
            </button>
          </div>
        </div>

        <div className={styles.syncNote}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
            <path d="M20 6L9 17l-5-5" />
          </svg>
          Updates here save directly, Destiny and Heather see the same info immediately.
        </div>
      </div>

      {/* Staff Page Profile Card */}
      <div className={styles.staffCard}>
        <div className={styles.staffCardHeader}>
          <h3>My Staff Page Profile</h3>
          {!editingStaffProfile && (
            <button
              className={styles.editStaffBtn}
              onClick={() => setEditingStaffProfile(true)}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7" />
                <path d="M18.5 2.5a2.1 2.1 0 013 3L12 15l-4 1 1-4z" />
              </svg>
              Edit
            </button>
          )}
        </div>

        <p className={styles.staffIntro}>
          This is how you&apos;ll appear on our public &quot;Our Team&quot; page. Fill this out so
          families can learn about you!
        </p>

        {staffError && <div className={styles.staffError}>{staffError}</div>}

        {/* Preview Card */}
        <div className={styles.staffPreview}>
          <div className={styles.previewPhoto}>
            {headshotUrl ? (
              <img src={headshotUrl} alt={staffProfile.display_name || profile.full_name} />
            ) : (
              <span>{displayInitial}</span>
            )}
          </div>
          <div className={styles.previewInfo}>
            <div className={styles.previewName}>
              {staffProfile.display_name || profile.full_name || "Your Name"}
            </div>
            <div className={styles.previewTitle}>
              {staffProfile.title || "Your Title"}
            </div>
            {staffProfile.bio && (
              <div className={styles.previewBio}>{staffProfile.bio}</div>
            )}
          </div>
        </div>

        {/* Photo Upload */}
        <div className={styles.photoSection}>
          <span className={styles.photoLabel}>Profile Photo</span>
          <div className={styles.photoActions}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              style={{ display: "none" }}
            />
            <button
              className={styles.uploadPhotoBtn}
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingPhoto}
            >
              {uploadingPhoto ? "Uploading..." : headshotUrl ? "Change Photo" : "Upload Photo"}
            </button>
            {headshotUrl && (
              <button
                className={styles.removePhotoBtn}
                onClick={handleRemovePhoto}
                disabled={uploadingPhoto}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Editable Fields */}
        {editingStaffProfile ? (
          <div className={styles.staffForm}>
            <div className={styles.staffField}>
              <label className={styles.staffLabel}>Display Name</label>
              <input
                type="text"
                className={styles.staffInput}
                value={staffProfile.display_name}
                onChange={(e) => handleStaffFieldChange("display_name", e.target.value)}
                placeholder={profile.full_name}
              />
              <span className={styles.fieldHint}>
                Leave blank to use your account name: {profile.full_name}
              </span>
            </div>

            <div className={styles.staffField}>
              <label className={styles.staffLabel}>Title</label>
              <input
                type="text"
                className={styles.staffInput}
                value={staffProfile.title}
                onChange={(e) => handleStaffFieldChange("title", e.target.value)}
                placeholder="e.g., Soccer Coach, Wellness Instructor"
              />
            </div>

            <div className={styles.staffField}>
              <label className={styles.staffLabel}>Bio</label>
              <textarea
                className={styles.staffTextarea}
                value={staffProfile.bio}
                onChange={(e) => handleStaffFieldChange("bio", e.target.value)}
                placeholder="Tell families a little about yourself..."
                rows={3}
                maxLength={280}
              />
              <span className={`${styles.fieldHint} ${bioCharCount > 250 ? styles.charWarn : ""}`}>
                {bioCharCount}/280 characters
              </span>
            </div>

            <div className={styles.staffField}>
              <label className={styles.staffLabel}>Quote (optional)</label>
              <input
                type="text"
                className={styles.staffInput}
                value={staffProfile.staff_quote}
                onChange={(e) => handleStaffFieldChange("staff_quote", e.target.value)}
                placeholder="A fun quote or motto..."
              />
            </div>

            <div className={styles.staffFormActions}>
              <button
                className={styles.cancelBtn}
                onClick={handleCancelStaffEdit}
                disabled={savingStaff}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSaveStaffProfile}
                disabled={savingStaff}
              >
                {savingStaff ? "Saving..." : "Save Profile"}
              </button>
            </div>
          </div>
        ) : (
          <div className={styles.staffReadOnly}>
            <div className={styles.readOnlyRow}>
              <span className={styles.readOnlyLabel}>Display Name</span>
              <span className={styles.readOnlyValue}>
                {staffProfile.display_name || profile.full_name}
              </span>
            </div>
            <div className={styles.readOnlyRow}>
              <span className={styles.readOnlyLabel}>Title</span>
              <span className={styles.readOnlyValue}>
                {staffProfile.title || <em className={styles.notSet}>Not set</em>}
              </span>
            </div>
            <div className={styles.readOnlyRow}>
              <span className={styles.readOnlyLabel}>Bio</span>
              <span className={styles.readOnlyValue}>
                {staffProfile.bio || <em className={styles.notSet}>Not set</em>}
              </span>
            </div>
            {staffProfile.staff_quote && (
              <div className={styles.readOnlyRow}>
                <span className={styles.readOnlyLabel}>Quote</span>
                <span className={styles.readOnlyValue}>&ldquo;{staffProfile.staff_quote}&rdquo;</span>
              </div>
            )}
          </div>
        )}

        <div className={styles.staffNote}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          Your profile will appear on the staff page once an admin enables it.
        </div>
      </div>

      {/* Logout Button */}
      <button className={styles.logoutBtn} onClick={handleLogout}>
        Log Out
      </button>

      {/* Edit Modal */}
      {editingCert && (
        <div className={styles.modalOverlay} onClick={closeModal}>
          <div className={styles.certModal} onClick={(e) => e.stopPropagation()}>
            <h3>
              {editingCert === "cpr" ? "Update CPR Certification" : "Update Food Handler's Card"}
            </h3>

            {editingCert === "food_handler" && (
              <label className={styles.noCertToggle}>
                <input
                  type="checkbox"
                  checked={noCert}
                  onChange={(e) => setNoCert(e.target.checked)}
                />
                I don&apos;t have this certification
              </label>
            )}

            {!noCert && (
              <>
                <label className={styles.fieldLabel}>Expiration Date</label>
                <input
                  type="date"
                  value={editDate}
                  onChange={(e) => setEditDate(e.target.value)}
                  className={styles.dateInput}
                />
              </>
            )}

            {error && <div className={styles.errorText}>{error}</div>}

            <div className={styles.modalActions}>
              <button
                className={styles.cancelBtn}
                onClick={closeModal}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className={styles.saveBtn}
                onClick={handleSave}
                disabled={saving}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
