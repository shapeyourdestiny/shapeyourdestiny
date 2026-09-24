"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import styles from "./InstructorDetail.module.css";
import {
  updateStaffProfileAction,
  uploadHeadshotAction,
  removeHeadshotAction,
  toggleStaffVisibilityAction,
} from "@/lib/staff/actions";

export default function StaffPageSection({ instructor }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState(instructor.display_name || "");
  const [title, setTitle] = useState(instructor.title || "");
  const [bio, setBio] = useState(instructor.bio || "");
  const [staffSection, setStaffSection] = useState(instructor.staff_section || "instructor");
  const [sortOrder, setSortOrder] = useState(instructor.staff_sort_order || 0);
  const [staffQuote, setStaffQuote] = useState(instructor.staff_quote || "");
  const [showOnStaffPage, setShowOnStaffPage] = useState(instructor.show_on_staff_page ?? true);

  const bioLength = bio.length;
  const bioOver = bioLength > 280;

  const handleSave = async () => {
    if (bioOver) {
      alert("Bio must be 280 characters or less");
      return;
    }

    setLoading(true);
    const result = await updateStaffProfileAction(instructor.id, {
      display_name: displayName.trim() || null,
      title: title.trim() || null,
      bio: bio.trim() || null,
      staff_section: staffSection,
      staff_sort_order: parseInt(sortOrder, 10) || 0,
      staff_quote: staffQuote.trim() || null,
    });
    setLoading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleToggleVisibility = async () => {
    const newValue = !showOnStaffPage;
    setShowOnStaffPage(newValue);

    const result = await toggleStaffVisibilityAction(instructor.id, newValue);
    if (result.error) {
      alert(result.error);
      setShowOnStaffPage(!newValue); // Revert
    } else {
      router.refresh();
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const formData = new FormData();
    formData.append("headshot", file);

    const result = await uploadHeadshotAction(instructor.id, formData);
    setUploading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }

    // Reset input
    e.target.value = "";
  };

  const handleRemoveHeadshot = async () => {
    if (!confirm("Remove headshot?")) return;

    setUploading(true);
    const result = await removeHeadshotAction(instructor.id);
    setUploading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  // Badge class based on status
  const badgeClass =
    instructor.staffLiveStatus === "Live"
      ? styles.live
      : instructor.staffLiveStatus === "Hidden"
        ? styles.hidden
        : styles.deactivated;

  return (
    <div className={styles.staffSection}>
      <div className={styles.staffHeader}>
        <h3>Staff Page Profile</h3>
        <span className={`${styles.staffBadge} ${badgeClass}`}>
          {instructor.staffLiveStatus}
        </span>
      </div>

      <div className={styles.staffGrid}>
        {/* Headshot area */}
        <div className={styles.headshotArea}>
          <div className={styles.headshotPreview}>
            {instructor.headshotUrl ? (
              <Image
                src={instructor.headshotUrl}
                alt={instructor.full_name}
                width={120}
                height={120}
                style={{ objectFit: "cover" }}
              />
            ) : (
              <div className={styles.headshotPlaceholder}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
                </svg>
              </div>
            )}
          </div>
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFileChange}
              style={{ display: "none" }}
            />
            <button
              type="button"
              className={styles.uploadBtn}
              onClick={handleUploadClick}
              disabled={uploading}
            >
              {uploading ? "Uploading..." : instructor.headshotUrl ? "Change" : "Upload"}
            </button>
            {instructor.headshotUrl && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={handleRemoveHeadshot}
                disabled={uploading}
                style={{ marginLeft: 8 }}
              >
                Remove
              </button>
            )}
          </div>
        </div>

        {/* Fields */}
        <div className={styles.staffFields}>
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="displayName">Display Name</label>
              <input
                type="text"
                id="displayName"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={instructor.full_name}
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="title">Title</label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Lead Instructor, Sports Coach, etc."
              />
            </div>
          </div>

          <div className={styles.fieldGroup + " " + styles.full}>
            <label htmlFor="bio">Bio</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="A short bio about this team member..."
            />
            <div className={`${styles.charCount} ${bioOver ? styles.over : ""}`}>
              {bioLength}/280
            </div>
          </div>

          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="staffSection">Section</label>
              <select
                id="staffSection"
                value={staffSection}
                onChange={(e) => setStaffSection(e.target.value)}
              >
                <option value="instructor">Instructor</option>
                <option value="leadership">Leadership</option>
              </select>
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="sortOrder">Sort Order</label>
              <input
                type="number"
                id="sortOrder"
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value)}
                min="0"
              />
            </div>
          </div>

          {staffSection === "leadership" && (
            <div className={styles.fieldGroup + " " + styles.full}>
              <label htmlFor="staffQuote">Quote (Leadership only)</label>
              <textarea
                id="staffQuote"
                value={staffQuote}
                onChange={(e) => setStaffQuote(e.target.value)}
                placeholder="Optional quote to display on staff page..."
              />
            </div>
          )}

          <div className={styles.toggleRow}>
            <div className={styles.toggleLabel}>
              Show on Staff Page
              <span>When off, hides from public page without deactivating</span>
            </div>
            <button
              type="button"
              className={`${styles.toggle} ${showOnStaffPage ? styles.on : ""}`}
              onClick={handleToggleVisibility}
              aria-pressed={showOnStaffPage}
            />
          </div>

          <div className={styles.staffActions}>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={loading || bioOver}
            >
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
