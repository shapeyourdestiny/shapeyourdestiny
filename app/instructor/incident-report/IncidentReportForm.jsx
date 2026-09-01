"use client";

import { useState, useEffect, useRef } from "react";
import { createIncidentReport, getCoInstructorForSchool, uploadIncidentPhoto } from "@/lib/incidents/queries";
import styles from "./page.module.css";

const INCIDENT_TYPES = [
  "Injury",
  "Medical situation",
  "Behavioral incident",
  "Conflict between kids",
  "Property damage",
  "Other",
];

export default function IncidentReportForm({ schools }) {
  const [severity, setSeverity] = useState(null);
  const [type, setType] = useState("");
  const [occurredAt, setOccurredAt] = useState(() => {
    // Default to now in local timezone format
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    return local.toISOString().slice(0, 16);
  });
  const [schoolId, setSchoolId] = useState("");
  const [locationNote, setLocationNote] = useState("");
  const [involved, setInvolved] = useState("");
  const [whatHappened, setWhatHappened] = useState("");
  const [actionsTaken, setActionsTaken] = useState("");
  const [firstAidAdministered, setFirstAidAdministered] = useState(null);
  const [staffNotified, setStaffNotified] = useState(null);
  const [staffNotifiedName, setStaffNotifiedName] = useState("");
  const [parentNotified, setParentNotified] = useState(null);
  const [witnesses, setWitnesses] = useState("");

  // New fields
  const [coInstructor, setCoInstructor] = useState(null);
  const [coInstructorOverride, setCoInstructorOverride] = useState("");
  const [showCoInstructorOverride, setShowCoInstructorOverride] = useState(false);
  const [activityContext, setActivityContext] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [certified, setCertified] = useState(false);
  const fileInputRef = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const isOther = schoolId === "other";

  // Fetch co-instructor when school is selected
  useEffect(() => {
    let cancelled = false;

    async function fetchCoInstructor() {
      if (schoolId && schoolId !== "other") {
        const result = await getCoInstructorForSchool(schoolId);
        if (!cancelled) {
          setCoInstructor(result);
          setShowCoInstructorOverride(false);
          setCoInstructorOverride("");
        }
      } else {
        if (!cancelled) {
          setCoInstructor(null);
        }
      }
    }

    fetchCoInstructor();

    return () => {
      cancelled = true;
    };
  }, [schoolId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!severity) {
      setError("Please select how serious the incident was.");
      return;
    }
    if (!type) {
      setError("Please select the type of incident.");
      return;
    }
    if (!occurredAt) {
      setError("Please enter when the incident occurred.");
      return;
    }
    if (!schoolId) {
      setError("Please select where the incident happened.");
      return;
    }
    if (!whatHappened.trim()) {
      setError("Please describe what happened.");
      return;
    }
    if (!actionsTaken.trim()) {
      setError("Please describe what you did about it.");
      return;
    }
    if (firstAidAdministered === null) {
      setError("Please indicate if first aid was administered.");
      return;
    }
    if (staffNotified === null) {
      setError("Please indicate if a staff member was notified.");
      return;
    }
    if (parentNotified === null) {
      setError("Please indicate if a parent/guardian was notified.");
      return;
    }
    if (!certified) {
      setError("Please confirm that the report is accurate.");
      return;
    }

    setSubmitting(true);

    try {
      // Upload photo if one was selected
      let photoUrl = null;
      if (photoFile) {
        setPhotoUploading(true);
        const formData = new FormData();
        formData.append("file", photoFile);
        const uploadResult = await uploadIncidentPhoto(formData);
        setPhotoUploading(false);

        if (uploadResult.error) {
          setError(uploadResult.error);
          setSubmitting(false);
          return;
        }
        photoUrl = uploadResult.path;
      }

      const result = await createIncidentReport({
        severity,
        type,
        occurredAt: new Date(occurredAt).toISOString(),
        schoolId: isOther ? null : schoolId,
        locationNote: isOther ? locationNote : null,
        involved: involved.trim() || null,
        whatHappened: whatHappened.trim(),
        actionsTaken: actionsTaken.trim(),
        firstAidAdministered,
        staffNotified,
        staffNotifiedName: staffNotified ? staffNotifiedName.trim() : null,
        parentNotified,
        witnesses: witnesses.trim() || null,
        // New fields
        coInstructorId: showCoInstructorOverride ? null : coInstructor?.id || null,
        coInstructorOverride: showCoInstructorOverride ? coInstructorOverride.trim() : null,
        activityContext: activityContext.trim() || null,
        photoUrl,
        certified,
      });

      if (result.error) {
        setError(result.error);
        setSubmitting(false);
        return;
      }

      // Success - show confirmation and reset form
      setSuccess(true);
      resetForm();
    } catch (err) {
      console.error("Error submitting incident report:", err);
      setError("An unexpected error occurred. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSeverity(null);
    setType("");
    const now = new Date();
    const offset = now.getTimezoneOffset();
    const local = new Date(now.getTime() - offset * 60000);
    setOccurredAt(local.toISOString().slice(0, 16));
    setSchoolId("");
    setLocationNote("");
    setInvolved("");
    setWhatHappened("");
    setActionsTaken("");
    setFirstAidAdministered(null);
    setStaffNotified(null);
    setStaffNotifiedName("");
    setParentNotified(null);
    setWitnesses("");
    // New fields
    setCoInstructor(null);
    setCoInstructorOverride("");
    setShowCoInstructorOverride(false);
    setActivityContext("");
    setPhotoFile(null);
    setPhotoPreview(null);
    setCertified(false);
  };

  // Handle file selection
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Please upload a JPEG, PNG, or WebP image.");
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      setError("File too large. Maximum size is 10MB.");
      return;
    }

    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    setError("");
  };

  const removePhoto = () => {
    setPhotoFile(null);
    if (photoPreview) {
      URL.revokeObjectURL(photoPreview);
    }
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (success) {
    return (
      <div className={styles.formCard}>
        <div className={styles.successState}>
          <div className={styles.successIcon}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>
          <h2>Report Submitted</h2>
          <p>Thank you for documenting this incident. The admin team has been notified and will review it shortly.</p>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={() => setSuccess(false)}
          >
            Submit Another Report
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className={styles.formCard} onSubmit={handleSubmit}>
      {/* Severity */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          How serious was it? <span className={styles.requiredStar}>*</span>
        </label>
        <select
          value={severity || ""}
          onChange={(e) => setSeverity(e.target.value || null)}
          className={severity ? styles[`severity${severity.charAt(0).toUpperCase() + severity.slice(1)}`] : ""}
        >
          <option value="">Select severity...</option>
          <option value="minor">Minor — No injury, resolved on the spot</option>
          <option value="moderate">Moderate — Injury or needed real attention</option>
          <option value="serious">Serious — Medical care, immediate follow-up</option>
        </select>
      </div>

      {/* Type & Date/Time */}
      <div className={`${styles.fieldRow} ${styles.fieldGroup}`}>
        <div>
          <label className={styles.fieldLabel}>
            Type <span className={styles.requiredStar}>*</span>
          </label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Select type...</option>
            {INCIDENT_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={styles.fieldLabel}>
            Date &amp; Time <span className={styles.requiredStar}>*</span>
          </label>
          <input
            type="datetime-local"
            value={occurredAt}
            onChange={(e) => setOccurredAt(e.target.value)}
          />
        </div>
      </div>

      {/* Where */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Where did this happen? <span className={styles.requiredStar}>*</span>
        </label>
        <select value={schoolId} onChange={(e) => setSchoolId(e.target.value)}>
          <option value="">Select location...</option>
          {schools.map((s) => (
            <option key={s.id} value={s.id}>{s.label}</option>
          ))}
          <option value="other">Other / not during a session</option>
        </select>
        {isOther && (
          <input
            type="text"
            value={locationNote}
            onChange={(e) => setLocationNote(e.target.value)}
            placeholder="Where did this happen?"
            style={{ marginTop: 10 }}
          />
        )}
      </div>

      {/* Co-Instructor Present */}
      {schoolId && schoolId !== "other" && (
        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>Co-Instructor Present</label>
          {showCoInstructorOverride ? (
            <input
              type="text"
              value={coInstructorOverride}
              onChange={(e) => setCoInstructorOverride(e.target.value)}
              placeholder="Enter the co-instructor's name"
            />
          ) : coInstructor ? (
            <div className={styles.autofillChip}>
              <div className={styles.autofillLeft}>
                <div className={styles.autofillAvatar}>{coInstructor.initials}</div>
                <div className={styles.autofillInfo}>
                  <span className={styles.autofillName}>{coInstructor.name}</span>
                  <span className={styles.autofillSub}>Pulled from your schedule for this session</span>
                </div>
              </div>
              <button
                type="button"
                className={styles.autofillFix}
                onClick={() => setShowCoInstructorOverride(true)}
              >
                Not right? Fix it
              </button>
            </div>
          ) : (
            <p className={styles.noCoInstructor}>No co-instructor on file for this session</p>
          )}
        </div>
      )}

      {/* Who was involved */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Who was involved</label>
        <input
          type="text"
          value={involved}
          onChange={(e) => setInvolved(e.target.value)}
          placeholder="Names or initials of any kids or staff involved"
        />
        <p className={styles.fieldHint}>
          Use whatever you&apos;re comfortable with, first names are fine, this stays with admin only.
        </p>
      </div>

      {/* Activity Context */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          What were the kids doing when this happened?
        </label>
        <input
          type="text"
          value={activityContext}
          onChange={(e) => setActivityContext(e.target.value)}
          placeholder="e.g. warm-up stretches, free play, a soccer drill"
        />
      </div>

      {/* What happened */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          What happened? <span className={styles.requiredStar}>*</span>
        </label>
        <textarea
          value={whatHappened}
          onChange={(e) => setWhatHappened(e.target.value)}
          placeholder="Walk through it as clearly as you can, what led up to it, what happened, in what order."
        />
      </div>

      {/* What did you do */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          What did you do about it? <span className={styles.requiredStar}>*</span>
        </label>
        <textarea
          value={actionsTaken}
          onChange={(e) => setActionsTaken(e.target.value)}
          placeholder="First aid given, how it was resolved, who you notified in the moment, etc."
        />
      </div>

      {/* First aid */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Was first aid administered? <span className={styles.requiredStar}>*</span>
        </label>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${firstAidAdministered === true ? styles.selected : ""}`}
            onClick={() => setFirstAidAdministered(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${firstAidAdministered === false ? styles.selected : ""}`}
            onClick={() => setFirstAidAdministered(false)}
          >
            No
          </button>
        </div>
      </div>

      {/* Staff notified */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Was a staff member notified at the time? <span className={styles.requiredStar}>*</span>
        </label>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${staffNotified === true ? styles.selected : ""}`}
            onClick={() => setStaffNotified(true)}
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${staffNotified === false ? styles.selected : ""}`}
            onClick={() => {
              setStaffNotified(false);
              setStaffNotifiedName("");
            }}
          >
            No
          </button>
        </div>
        {staffNotified && (
          <input
            type="text"
            value={staffNotifiedName}
            onChange={(e) => setStaffNotifiedName(e.target.value)}
            placeholder="Who was notified?"
            style={{ marginTop: 10 }}
          />
        )}
      </div>

      {/* Parent notified */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Was a parent or guardian notified? <span className={styles.requiredStar}>*</span>
        </label>
        <div className={styles.toggleRow}>
          <button
            type="button"
            className={`${styles.toggleBtn} ${parentNotified === "yes" ? styles.selected : ""}`}
            onClick={() => setParentNotified("yes")}
          >
            Yes
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${parentNotified === "no" ? styles.selected : ""}`}
            onClick={() => setParentNotified("no")}
          >
            No
          </button>
          <button
            type="button"
            className={`${styles.toggleBtn} ${parentNotified === "n/a" ? styles.selected : ""}`}
            onClick={() => setParentNotified("n/a")}
          >
            N/A
          </button>
        </div>
      </div>

      {/* Witnesses */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>Anyone else who saw what happened</label>
        <input
          type="text"
          value={witnesses}
          onChange={(e) => setWitnesses(e.target.value)}
          placeholder="Co-instructor, other staff, witnesses"
        />
      </div>

      {/* Photo Upload */}
      <div className={styles.fieldGroup}>
        <label className={styles.fieldLabel}>
          Attach a Photo <span className={styles.optionalLabel}>(optional)</span>
        </label>
        {photoPreview ? (
          <div className={styles.photoPreview}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={photoPreview} alt="Preview" className={styles.photoThumb} />
            <div className={styles.photoInfo}>
              <div className={styles.photoName}>{photoFile?.name}</div>
              <div className={styles.photoSize}>{formatFileSize(photoFile?.size || 0)}</div>
            </div>
            <button type="button" className={styles.photoRemove} onClick={removePhoto}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        ) : (
          <div
            className={styles.dropzone}
            onClick={() => fileInputRef.current?.click()}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path d="M21 15l-5-5L5 21" />
            </svg>
            <p>Click to upload, or drag a photo here</p>
            <div className={styles.dropzoneSub}>Useful for an injury or property damage, not required</div>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,image/heic"
          onChange={handleFileSelect}
          className={styles.dropzoneInput}
        />
      </div>

      {/* Certification Checkbox */}
      <div
        className={styles.certCheckRow}
        onClick={() => setCertified(!certified)}
      >
        <input
          type="checkbox"
          id="certCheck"
          checked={certified}
          onChange={(e) => setCertified(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        <span>
          I confirm this report is accurate to the best of my knowledge.
        </span>
      </div>

      {/* Privacy note */}
      <div className={styles.privacyNote}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <rect x="3" y="11" width="18" height="10" rx="2" />
          <path d="M7 11V7a5 5 0 0110 0v4" />
        </svg>
        <span>
          This report goes directly to Destiny and Heather only. Thank you for taking the time to
          document this carefully, it genuinely helps us take care of the kids and back you up if
          anything needs to be revisited later.
        </span>
      </div>

      {error && <div className={styles.errorText}>{error}</div>}

      <button type="submit" className={styles.submitBtn} disabled={submitting || photoUploading}>
        {photoUploading ? "Uploading photo..." : submitting ? "Submitting..." : "Submit Report"}
      </button>
    </form>
  );
}
