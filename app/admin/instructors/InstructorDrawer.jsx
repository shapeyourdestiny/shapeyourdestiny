"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import styles from "./InstructorDrawer.module.css";
import {
  archiveInstructorAction,
  updateInstructorAction,
} from "@/lib/instructors/actions";
import {
  updateStaffProfileAction,
  uploadHeadshotAction,
  removeHeadshotAction,
  toggleStaffVisibilityAction,
} from "@/lib/staff/actions";

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

export default function InstructorDrawer({ instructor, tab, onTabChange, onClose }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const isArchived = instructor.status === "archived";

  const handleArchive = async () => {
    if (!confirm(`${isArchived ? "Restore" : "Archive"} ${instructor.full_name}? ${!isArchived ? "This will remove them from the staff page immediately." : ""}`)) {
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

  return (
    <aside className={styles.drawer} aria-label="Instructor details">
      {/* Header */}
      <div className={styles.header}>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
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
              <span className={`${styles.statusBadge} ${styles[instructor.status]}`}>
                {instructor.status.charAt(0).toUpperCase() + instructor.status.slice(1)}
              </span>
              <span className={styles.staffLabel}>
                Staff page: <strong>{instructor.staffPageLabel}</strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className={styles.tabs} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("overview")}
        >
          Overview
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "profile"}
          className={`${styles.tab} ${tab === "profile" ? styles.tabActive : ""}`}
          onClick={() => onTabChange("profile")}
        >
          Staff page profile
        </button>
      </div>

      {/* Tab Content */}
      <div className={styles.content}>
        {tab === "overview" ? (
          <OverviewTab
            instructor={instructor}
            onArchive={handleArchive}
            loading={loading}
            isArchived={isArchived}
          />
        ) : (
          <ProfileTab instructor={instructor} />
        )}
      </div>
    </aside>
  );
}

function OverviewTab({ instructor, onArchive, loading, isArchived }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [phone, setPhone] = useState(instructor.phone || "");
  const [cprExpires, setCprExpires] = useState(instructor.cpr_expiration || "");
  const [foodHandlerExpires, setFoodHandlerExpires] = useState(instructor.food_handler_expiration || "");
  const [saving, setSaving] = useState(false);

  const handleSaveCerts = async () => {
    setSaving(true);
    const result = await updateInstructorAction(instructor.id, {
      phone: phone.trim(),
      cpr_expires: cprExpires || null,
      food_handler_expires: foodHandlerExpires || null,
    });
    setSaving(false);

    if (result.error) {
      alert(result.error);
    } else {
      setEditing(false);
      router.refresh();
    }
  };

  return (
    <div className={styles.overviewTab}>
      {/* Contact & Details */}
      <div className={styles.section}>
        <h3>Details</h3>
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
        {instructor.districtList.length > 0 ? (
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
        <div className={styles.sectionHeader}>
          <h3>Certifications</h3>
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
        {editing && (
          <div className={styles.editActions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={() => {
                setEditing(false);
                setPhone(instructor.phone || "");
                setCprExpires(instructor.cpr_expiration || "");
                setFoodHandlerExpires(instructor.food_handler_expiration || "");
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSaveCerts}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        )}
      </div>

      {/* Staff Page Summary */}
      <div className={styles.section}>
        <h3>Staff page</h3>
        <div className={styles.staffSummary}>
          <div className={styles.staffPreviewMini}>
            {instructor.headshotUrl ? (
              <img src={instructor.headshotUrl} alt="" />
            ) : (
              <div className={styles.photoPlaceholder}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
                </svg>
              </div>
            )}
          </div>
          <div className={styles.staffSummaryInfo}>
            <div className={styles.staffSummaryName}>
              {instructor.display_name || instructor.full_name}
            </div>
            <div className={styles.staffSummaryTitle}>
              {instructor.title || "No title set"}
            </div>
            <div className={styles.staffSummaryStatus}>
              {instructor.staffPageLabel}
              {instructor.needsProfile && (
                <span className={styles.needsWarning}>
                  {!instructor.hasHeadshot && !instructor.hasBio
                    ? " · No photo or bio"
                    : !instructor.hasHeadshot
                      ? " · No photo"
                      : " · No bio"}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Archive/Restore */}
      <div className={styles.archiveSection}>
        <button
          type="button"
          className={`${styles.archiveBtn} ${isArchived ? styles.restore : ""}`}
          onClick={onArchive}
          disabled={loading}
        >
          {isArchived ? "Restore Instructor" : "Archive Instructor"}
        </button>
        <p className={styles.archiveNote}>
          {isArchived
            ? "Restoring will make them available for scheduling again."
            : "Archiving removes them from the staff page and scheduling immediately."}
        </p>
      </div>
    </div>
  );
}

function ProfileTab({ instructor }) {
  const router = useRouter();
  const fileInputRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Form state
  const [displayName, setDisplayName] = useState(instructor.display_name || "");
  const [title, setTitle] = useState(instructor.title || "");
  const [bio, setBio] = useState(instructor.bio || "");
  const [section, setSection] = useState(instructor.staff_section || "instructor");
  const [quote, setQuote] = useState(instructor.staff_quote || "");
  const [showOnPage, setShowOnPage] = useState(instructor.show_on_staff_page ?? true);

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
      staff_section: section,
      staff_quote: quote.trim() || null,
      show_on_staff_page: showOnPage,
    });
    setLoading(false);

    if (result.error) {
      alert(result.error);
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

    e.target.value = "";
  };

  const handleRemovePhoto = async () => {
    if (!confirm("Remove photo?")) return;

    setUploading(true);
    const result = await removeHeadshotAction(instructor.id);
    setUploading(false);

    if (result.error) {
      alert(result.error);
    } else {
      router.refresh();
    }
  };

  const handleToggleVisibility = async () => {
    const newValue = !showOnPage;
    setShowOnPage(newValue);

    const result = await toggleStaffVisibilityAction(instructor.id, newValue);
    if (result.error) {
      alert(result.error);
      setShowOnPage(!newValue);
    } else {
      router.refresh();
    }
  };

  return (
    <div className={styles.profileTab}>
      {/* Live Preview */}
      <div className={styles.previewSection}>
        <h3>Preview</h3>
        <div className={styles.previewCard}>
          <div className={styles.previewPhoto}>
            {instructor.headshotUrl ? (
              <img src={instructor.headshotUrl} alt="" />
            ) : (
              <div className={styles.previewPlaceholder}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
                </svg>
              </div>
            )}
          </div>
          <div className={styles.previewName}>
            {displayName || instructor.full_name}
          </div>
          <div className={styles.previewTitle}>{title || "Title"}</div>
          {bio && <p className={styles.previewBio}>{bio}</p>}
          {instructor.programs.length > 0 && (
            <div className={styles.previewTags}>
              {instructor.programs.map((p) => (
                <span key={p} className={styles.previewTag}>
                  {PROGRAM_LABELS[p] || p}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Photo Upload */}
      <div className={styles.fieldSection}>
        <h3>Photo</h3>
        <div className={styles.photoRow}>
          <div className={styles.photoThumb}>
            {instructor.headshotUrl ? (
              <img src={instructor.headshotUrl} alt="" />
            ) : (
              <div className={styles.photoPlaceholderSmall}>
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="8" r="4" />
                  <path d="M12 14c-5 0-8 2.5-8 5v1h16v-1c0-2.5-3-5-8-5z" />
                </svg>
              </div>
            )}
          </div>
          <div className={styles.photoActions}>
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
              {uploading ? "Uploading..." : instructor.headshotUrl ? "Change photo" : "Upload photo"}
            </button>
            {instructor.headshotUrl && (
              <button
                type="button"
                className={styles.removeBtn}
                onClick={handleRemovePhoto}
                disabled={uploading}
              >
                Remove
              </button>
            )}
          </div>
        </div>
        <p className={styles.hint}>Square image, at least 400×400px. JPEG, PNG or WebP.</p>
      </div>

      {/* Fields */}
      <div className={styles.fieldSection}>
        <label className={styles.fieldLabel}>Display name</label>
        <input
          type="text"
          className={styles.input}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={instructor.full_name}
        />
      </div>

      <div className={styles.fieldSection}>
        <label className={styles.fieldLabel}>Title</label>
        <input
          type="text"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Lead Instructor, Sports Coach, etc."
        />
      </div>

      <div className={styles.fieldSection}>
        <label className={styles.fieldLabel}>Bio</label>
        <textarea
          className={styles.textarea}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="A short bio..."
          rows={3}
        />
        <div className={`${styles.charCount} ${bioOver ? styles.charOver : ""}`}>
          {bioLength}/280
        </div>
      </div>

      <div className={styles.fieldSection}>
        <label className={styles.fieldLabel}>Section</label>
        <select
          className={styles.select}
          value={section}
          onChange={(e) => setSection(e.target.value)}
        >
          <option value="instructor">Instructor</option>
          <option value="leadership">Leadership</option>
        </select>
      </div>

      {section === "leadership" && (
        <div className={styles.fieldSection}>
          <label className={styles.fieldLabel}>Quote (Leadership only)</label>
          <textarea
            className={styles.textarea}
            value={quote}
            onChange={(e) => setQuote(e.target.value)}
            placeholder="Optional quote..."
            rows={2}
          />
        </div>
      )}

      {/* Show on page toggle */}
      <div className={styles.toggleSection}>
        <div className={styles.toggleInfo}>
          <span className={styles.toggleLabel}>Show on staff page</span>
          <span className={styles.toggleHint}>
            When off, hides from public page without archiving
          </span>
        </div>
        <button
          type="button"
          className={`${styles.toggle} ${showOnPage ? styles.toggleOn : ""}`}
          onClick={handleToggleVisibility}
          aria-pressed={showOnPage}
        />
      </div>

      {/* Save */}
      <div className={styles.saveRow}>
        <p className={styles.saveNote}>Changes go live on save.</p>
        <button
          type="button"
          className={styles.primaryBtn}
          onClick={handleSave}
          disabled={loading || bioOver}
        >
          {loading ? "Saving..." : "Save changes"}
        </button>
      </div>
    </div>
  );
}
