"use client";

import { useState } from "react";
import styles from "./AddInstructorModal.module.css";
import { createUnlinkedInstructorAction } from "@/lib/instructors/actions";

export default function AddInstructorModal({ onClose, onSuccess }) {
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [title, setTitle] = useState("");
  const [bio, setBio] = useState("");
  const [staffSection, setStaffSection] = useState("instructor");
  const [showOnStaffPage, setShowOnStaffPage] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      const result = await createUnlinkedInstructorAction({
        fullName,
        displayName: displayName || null,
        title: title || null,
        bio: bio || null,
        staffSection,
        showOnStaffPage,
      });

      if (result.error) {
        setError(result.error);
        setSaving(false);
        return;
      }

      onSuccess(result.profileId);
    } catch {
      setError("Something went wrong");
      setSaving(false);
    }
  };

  return (
    <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <h2 className={styles.title}>Add Instructor</h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className={styles.form}>
        <p className={styles.description}>
          Add a new instructor to the staff page. You can invite them to create an account later.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <div className={styles.field}>
          <label className={styles.label}>
            Full Name <span className={styles.required}>*</span>
          </label>
          <input
            type="text"
            className={styles.input}
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Smith"
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Display Name</label>
          <input
            type="text"
            className={styles.input}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Coach John (optional)"
          />
          <p className={styles.hint}>Shown on staff page instead of full name</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Title</label>
          <input
            type="text"
            className={styles.input}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Lead Instructor"
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Bio</label>
          <textarea
            className={styles.textarea}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Short bio for the staff page..."
            rows={3}
            maxLength={280}
          />
          <p className={styles.hint}>{bio.length}/280 characters</p>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Section</label>
          <div className={styles.radioGroup}>
            <label className={styles.radio}>
              <input
                type="radio"
                name="section"
                value="instructor"
                checked={staffSection === "instructor"}
                onChange={(e) => setStaffSection(e.target.value)}
              />
              <span>Instructor</span>
            </label>
            <label className={styles.radio}>
              <input
                type="radio"
                name="section"
                value="leadership"
                checked={staffSection === "leadership"}
                onChange={(e) => setStaffSection(e.target.value)}
              />
              <span>Leadership</span>
            </label>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.checkbox}>
            <input
              type="checkbox"
              checked={showOnStaffPage}
              onChange={(e) => setShowOnStaffPage(e.target.checked)}
            />
            <span>Show on public staff page immediately</span>
          </label>
        </div>

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={saving || !fullName.trim()}
          >
            {saving ? "Adding..." : "Add Instructor"}
          </button>
        </div>
      </form>
    </div>
  );
}
