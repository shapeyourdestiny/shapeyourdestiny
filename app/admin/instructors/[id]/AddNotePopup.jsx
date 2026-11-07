"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import styles from "./AddNotePopup.module.css";
import { createNote, updateNote, uploadNoteFile, removeNoteFile, shareNote } from "@/lib/instructor-notes/actions";

const TYPE_COLORS = {
  review: "#2C6E7D",
  pay: "#4FA347",
  training: "#7C3AED",
  communication: "#2563EB",
  observations: "#D97706",
  disciplinary: "#E0594C",
  recognition: "#DB2777",
};

const NOTE_TYPES = [
  { value: "review", label: "Review" },
  { value: "pay", label: "Pay" },
  { value: "training", label: "Training" },
  { value: "communication", label: "Communication" },
  { value: "observations", label: "Observations" },
  { value: "disciplinary", label: "Disciplinary" },
  { value: "recognition", label: "Recognition" },
];

const DISCIPLINARY_STEPS = ["verbal", "written", "final", "suspension"];

const RATING_LABELS = {
  attitude: "Attitude",
  reliability: "Reliability",
  skills: "Teaching Skills",
  communication: "Communication",
};

const ABOUT_OPTIONS = [
  "Attendance",
  "Performance",
  "Behavior",
  "Communication",
  "Policy violation",
  "Other",
];

function getTodayStr() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = laDate.getFullYear();
  const m = String(laDate.getMonth() + 1).padStart(2, "0");
  const d = String(laDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function addMonths(dateStr, months) {
  const date = new Date(dateStr + "T00:00:00");
  date.setMonth(date.getMonth() + months);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AddNotePopup({ instructor, note, onClose, onSave, onArchive }) {
  const isEditing = !!note;
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Initialize defaults for new notes based on type
  const getInitialDetails = () => {
    if (note?.details) return note.details;
    // Default next_review_date for new review notes
    return {};
  };

  // Form state
  const [type, setType] = useState(note?.type || "review");
  const [title, setTitle] = useState(note?.title || "");
  const [noteDate, setNoteDate] = useState(note?.note_date || getTodayStr());
  const [body, setBody] = useState(note?.body || "");

  // Follow-up
  const [hasFollowUp, setHasFollowUp] = useState(!!note?.follow_up_date);
  const [followUpDate, setFollowUpDate] = useState(note?.follow_up_date || "");

  // Files
  const [existingFiles, setExistingFiles] = useState(note?.files || []);
  const [newFiles, setNewFiles] = useState([]);
  const [filesToRemove, setFilesToRemove] = useState([]);

  // Sharing
  const [shareAfterSaving, setShareAfterSaving] = useState(false);
  const isShareable = ["review", "recognition", "disciplinary"].includes(type);

  // Type-specific details
  const [details, setDetails] = useState(getInitialDetails);

  useEffect(() => {
    setMounted(true); // eslint-disable-line react-hooks/set-state-in-effect
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const handleTypeChange = (newType) => {
    if (isEditing) return; // Can't change type when editing
    setType(newType);
    // Set defaults for new type
    if (newType === "review") {
      setDetails({ next_review_date: addMonths(getTodayStr(), 6) });
    } else {
      setDetails({});
    }
  };

  const handleRatingClick = (key, value) => {
    setDetails((d) => ({
      ...d,
      ratings: { ...(d.ratings || {}), [key]: value },
    }));
  };

  const handleDetailChange = (key, value) => {
    setDetails((d) => ({ ...d, [key]: value }));
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    setNewFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const handleRemoveNewFile = (index) => {
    setNewFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingFile = (fileId) => {
    setFilesToRemove((prev) => [...prev, fileId]);
    setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const handleOverlayClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleKeyDown = useCallback((e) => {
    if (e.key === "Escape") {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleSubmit = async () => {
    if (!title.trim()) {
      alert("Title is required");
      return;
    }

    setLoading(true);

    try {
      const noteData = {
        type,
        title: title.trim(),
        note_date: noteDate,
        body: body.trim(),
        details,
        follow_up_date: hasFollowUp ? followUpDate : null,
      };

      let result;
      let noteId;

      if (isEditing) {
        result = await updateNote(note.id, noteData);
        noteId = note.id;
      } else {
        result = await createNote(instructor.id, noteData);
        noteId = result.noteId;
      }

      if (result.error) {
        alert(result.error);
        setLoading(false);
        return;
      }

      // Handle file removals
      for (const fileId of filesToRemove) {
        await removeNoteFile(fileId);
      }

      // Handle new file uploads
      for (const file of newFiles) {
        const formData = new FormData();
        formData.append("file", file);
        const uploadResult = await uploadNoteFile(noteId, formData);
        if (uploadResult.error) {
          console.error("File upload failed:", uploadResult.error);
        }
      }

      // Share the note if checkbox was checked (for new shareable notes)
      if (!isEditing && shareAfterSaving && isShareable && noteId) {
        const shareResult = await shareNote(noteId);
        if (shareResult.error) {
          console.error("Failed to share note:", shareResult.error);
        }
      }

      onSave();
    } catch (err) {
      console.error("Error saving note:", err);
      alert("Failed to save note");
    } finally {
      setLoading(false);
    }
  };

  if (!mounted) return null;

  return createPortal(
    <div className={styles.overlay} onClick={handleOverlayClick}>
      <div className={styles.popup}>
        <div className={styles.header}>
          <h2>{isEditing ? "Edit note" : `Add a note for ${instructor.full_name.split(" ")[0]}`}</h2>
          <p className={styles.headerSubtext}>
            Only admins can see notes. Stick to what happened and what was agreed.
          </p>
        </div>

        <div className={styles.body}>
          {/* Type Pills */}
          <div className={styles.typePills}>
            {NOTE_TYPES.map((t) => (
              <button
                key={t.value}
                type="button"
                className={`${styles.typePill} ${type === t.value ? styles.active : ""} ${isEditing ? styles.disabled : ""}`}
                onClick={() => handleTypeChange(t.value)}
                disabled={isEditing}
              >
                <span className={styles.typeDot} style={{ background: TYPE_COLORS[t.value] }} />
                {t.label}
              </button>
            ))}
          </div>

          {/* Title + Date */}
          <div className={styles.fieldRow}>
            <div className={styles.fieldGroup}>
              <label htmlFor="noteTitle">Title</label>
              <input
                id="noteTitle"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Brief summary..."
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="noteDate">Date</label>
              <input
                id="noteDate"
                type="date"
                value={noteDate}
                onChange={(e) => setNoteDate(e.target.value)}
              />
            </div>
          </div>

          {/* Review-specific fields */}
          {type === "review" && (
            <>
              <div className={styles.ratingsGrid}>
                {Object.entries(RATING_LABELS).map(([key, label]) => (
                  <div key={key} className={styles.ratingRow}>
                    <span className={styles.ratingLabel}>{label}</span>
                    <div className={styles.ratingSquares}>
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button
                          key={value}
                          type="button"
                          className={`${styles.ratingSquare} ${(details.ratings?.[key] || 0) >= value ? styles.filled : ""}`}
                          onClick={() => handleRatingClick(key, value)}
                        >
                          {value}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="doingWell">What they&apos;re doing well</label>
                <textarea
                  id="doingWell"
                  value={details.doing_well || ""}
                  onChange={(e) => handleDetailChange("doing_well", e.target.value)}
                  placeholder="Strengths and positive feedback..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="workOn">What to work on next</label>
                <textarea
                  id="workOn"
                  value={details.work_on || ""}
                  onChange={(e) => handleDetailChange("work_on", e.target.value)}
                  placeholder="Areas for improvement..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="nextReview">Next review date</label>
                <input
                  id="nextReview"
                  type="date"
                  value={details.next_review_date || ""}
                  onChange={(e) => handleDetailChange("next_review_date", e.target.value)}
                />
              </div>
            </>
          )}

          {/* Pay-specific fields */}
          {type === "pay" && (
            <div className={styles.payRow}>
              <div className={styles.fieldGroup}>
                <label htmlFor="rateFrom">Current rate</label>
                <input
                  id="rateFrom"
                  type="text"
                  value={details.rate_from ? `$${details.rate_from}` : "Not set"}
                  readOnly
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="rateTo">New rate ($)</label>
                <input
                  id="rateTo"
                  type="number"
                  min="0"
                  step="1"
                  value={details.rate_to || ""}
                  onChange={(e) => handleDetailChange("rate_to", e.target.value)}
                  placeholder="e.g. 40"
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="payPeriod">Effective from</label>
                <input
                  id="payPeriod"
                  type="date"
                  value={details.effective_date || noteDate}
                  onChange={(e) => handleDetailChange("effective_date", e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Disciplinary-specific fields */}
          {type === "disciplinary" && (
            <>
              {details.earlier_steps && (
                <div className={styles.earlierSteps}>
                  Previous steps: {details.earlier_steps}
                </div>
              )}

              <div className={styles.stepCards}>
                {DISCIPLINARY_STEPS.map((step, idx) => {
                  const currentIdx = DISCIPLINARY_STEPS.indexOf(details.step || "verbal");
                  let className = styles.stepCard;
                  if (step === details.step) className += ` ${styles.active}`;
                  else if (idx < currentIdx) className += ` ${styles.past}`;
                  return (
                    <button
                      key={step}
                      type="button"
                      className={className}
                      onClick={() => handleDetailChange("step", step)}
                    >
                      {step}
                    </button>
                  );
                })}
              </div>

              {details.step === "suspension" && (
                <div className={styles.warningBox}>
                  <p>
                    This records the suspension but does not automatically remove classes.
                    Use &quot;Mark someone out&quot; on the Schedule Board to cover their classes.
                  </p>
                </div>
              )}

              <div className={styles.fieldGroup}>
                <label htmlFor="about">About</label>
                <select
                  id="about"
                  value={details.about || ""}
                  onChange={(e) => handleDetailChange("about", e.target.value)}
                >
                  <option value="">Select category...</option>
                  {ABOUT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="whatHappened">What happened</label>
                <textarea
                  id="whatHappened"
                  value={details.what_happened || ""}
                  onChange={(e) => handleDetailChange("what_happened", e.target.value)}
                  placeholder="Describe the situation..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="expectation">What we expect going forward</label>
                <textarea
                  id="expectation"
                  value={details.expectation || ""}
                  onChange={(e) => handleDetailChange("expectation", e.target.value)}
                  placeholder="Expected behavior or changes..."
                />
              </div>

              <div className={styles.fieldGroup}>
                <label htmlFor="consequence">If it happens again</label>
                <textarea
                  id="consequence"
                  value={details.consequence || ""}
                  onChange={(e) => handleDetailChange("consequence", e.target.value)}
                  placeholder="Next steps if repeated..."
                />
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.fieldGroup}>
                  <label htmlFor="talkedOn">Talked on</label>
                  <input
                    id="talkedOn"
                    type="date"
                    value={details.talked_on || ""}
                    onChange={(e) => handleDetailChange("talked_on", e.target.value)}
                  />
                </div>
                <div className={styles.fieldGroup}>
                  <label htmlFor="alsoPresent">Also present</label>
                  <input
                    id="alsoPresent"
                    type="text"
                    value={details.also_present || ""}
                    onChange={(e) => handleDetailChange("also_present", e.target.value)}
                    placeholder="e.g. Heather"
                  />
                </div>
              </div>

              <div className={styles.checkboxRow}>
                <input
                  type="checkbox"
                  id="acknowledged"
                  checked={details.acknowledged || false}
                  onChange={(e) => handleDetailChange("acknowledged", e.target.checked)}
                />
                <label htmlFor="acknowledged">Instructor acknowledged and understood</label>
              </div>
            </>
          )}

          {/* Training-specific fields */}
          {type === "training" && (
            <>
              <div className={styles.fieldGroup}>
                <label htmlFor="trainingBody">What happened</label>
                <textarea
                  id="trainingBody"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Training completed, certifications obtained..."
                />
              </div>
              <div className={styles.fieldGroup}>
                <label htmlFor="expiresDate">Expires</label>
                <input
                  id="expiresDate"
                  type="date"
                  value={details.expires_date || ""}
                  onChange={(e) => handleDetailChange("expires_date", e.target.value)}
                />
              </div>
            </>
          )}

          {/* Generic body field for other types */}
          {!["review", "training"].includes(type) && (
            <div className={styles.fieldGroup}>
              <label htmlFor="body">What happened</label>
              <textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Details..."
              />
            </div>
          )}

          {/* Follow-up */}
          <div className={styles.followUpRow}>
            <input
              type="checkbox"
              id="hasFollowUp"
              checked={hasFollowUp}
              onChange={(e) => setHasFollowUp(e.target.checked)}
            />
            <label htmlFor="hasFollowUp">Schedule follow-up</label>
            {hasFollowUp && (
              <input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
              />
            )}
          </div>

          {/* File Upload */}
          <div className={styles.fileUploadRow}>
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileSelect}
              style={{ display: "none" }}
              multiple
            />
            <button
              type="button"
              className={styles.fileUploadBtn}
              onClick={() => fileInputRef.current?.click()}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" />
              </svg>
              Attach file
            </button>

            {(existingFiles.length > 0 || newFiles.length > 0) && (
              <div className={styles.fileList}>
                {existingFiles.map((file) => (
                  <div key={file.id} className={styles.fileItem}>
                    <span>{file.file_name}</span>
                    <button
                      type="button"
                      className={styles.fileRemove}
                      onClick={() => handleRemoveExistingFile(file.id)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
                {newFiles.map((file, idx) => (
                  <div key={`new-${idx}`} className={styles.fileItem}>
                    <span>{file.name}</span>
                    <button
                      type="button"
                      className={styles.fileRemove}
                      onClick={() => handleRemoveNewFile(idx)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
                        <path d="M18 6L6 18M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className={styles.footer}>
          <div className={styles.footerLeft}>
            <span className={styles.footerNote}>
              Saved with your name and the time. Edits are kept in history.
            </span>
            {!isEditing && isShareable && (
              <label className={styles.shareCheckbox}>
                <input
                  type="checkbox"
                  checked={shareAfterSaving}
                  onChange={(e) => setShareAfterSaving(e.target.checked)}
                />
                Share with {instructor.full_name?.split(" ")[0]} after saving
              </label>
            )}
          </div>
          <div className={styles.footerButtons}>
            {isEditing && onArchive && (
              <button
                type="button"
                className={styles.archiveBtn}
                onClick={onArchive}
                disabled={loading}
              >
                Archive
              </button>
            )}
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.saveBtn}
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Saving..." : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
