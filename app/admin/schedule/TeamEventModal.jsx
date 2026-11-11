"use client";

import { useState, useEffect } from "react";
import styles from "./TeamEventModal.module.css";
import BottomSheet from "./BottomSheet";
import { createTeamEvent, updateTeamEvent } from "@/lib/team-events/actions";

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", color: "#1F3F91" },
  { value: "training", label: "Training", color: "#3E8FA0" },
  { value: "social", label: "Social", color: "#F2A65E" },
];

export default function TeamEventModal({
  open,
  onClose,
  onSave,
  event = null,
  initialDate = null,
  instructors = [],
}) {
  const isEdit = !!event;

  const [type, setType] = useState("meeting");
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [location, setLocation] = useState("");
  const [details, setDetails] = useState("");
  const [paid, setPaid] = useState(false);
  const [payClasses, setPayClasses] = useState("1");
  const [required, setRequired] = useState(true);
  const [audienceType, setAudienceType] = useState("all");
  const [selectedProfiles, setSelectedProfiles] = useState([]);
  const [sendEmail, setSendEmail] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when opening
  useEffect(() => {
    if (open) {
      if (event) {
        setType(event.type);
        setTitle(event.title);
        setEventDate(event.event_date);
        setStartTime(event.start_time?.slice(0, 5) || "09:00");
        setEndTime(event.end_time?.slice(0, 5) || "10:00");
        setLocation(event.location || "");
        setDetails(event.details || "");
        setPaid(event.paid || false);
        setPayClasses(event.pay_classes?.toString() || "1");
        setRequired(event.required !== false);
        setAudienceType(event.audience?.type || "all");
        setSelectedProfiles(event.audience?.profileIds || []);
        setSendEmail(false); // Don't re-send emails on edit
      } else {
        setType("meeting");
        setTitle("");
        setEventDate(initialDate || new Date().toISOString().split("T")[0]);
        setStartTime("09:00");
        setEndTime("10:00");
        setLocation("");
        setDetails("");
        setPaid(false);
        setPayClasses("1");
        setRequired(true);
        setAudienceType("all");
        setSelectedProfiles([]);
        setSendEmail(true);
      }
      setError(null);
    }
  }, [open, event, initialDate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Validation
    if (!title.trim()) {
      setError("Please enter a title");
      return;
    }
    if (!eventDate) {
      setError("Please select a date");
      return;
    }
    if (!startTime || !endTime) {
      setError("Please enter start and end times");
      return;
    }
    if (startTime >= endTime) {
      setError("End time must be after start time");
      return;
    }
    if (paid && (!payClasses || parseFloat(payClasses) <= 0)) {
      setError("Please enter the number of classes to pay");
      return;
    }
    if (audienceType === "specific" && selectedProfiles.length === 0) {
      setError("Please select at least one person");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = {
        type,
        title: title.trim(),
        eventDate,
        startTime,
        endTime,
        location: location.trim() || null,
        details: details.trim() || null,
        paid,
        payClasses: paid ? parseFloat(payClasses) : null,
        required,
        audience: audienceType === "all"
          ? { type: "all" }
          : { type: "specific", profileIds: selectedProfiles },
        sendEmail: isEdit ? false : sendEmail,
      };

      if (isEdit) {
        await updateTeamEvent(event.id, data);
      } else {
        await createTeamEvent(data);
      }

      onSave?.();
      onClose();
    } catch (err) {
      console.error("Error saving team event:", err);
      setError(err.message || "Failed to save event");
    } finally {
      setLoading(false);
    }
  };

  const toggleProfile = (profileId) => {
    setSelectedProfiles((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
  };

  const content = (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Event Type */}
      <div className={styles.field}>
        <label className={styles.label}>Type</label>
        <div className={styles.typeButtons}>
          {EVENT_TYPES.map((t) => (
            <button
              key={t.value}
              type="button"
              className={`${styles.typeBtn} ${type === t.value ? styles.selected : ""}`}
              style={{ "--type-color": t.color }}
              onClick={() => setType(t.value)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className={styles.field}>
        <label className={styles.label}>Title</label>
        <input
          type="text"
          className={styles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Monthly Team Meeting"
          maxLength={100}
        />
      </div>

      {/* Date */}
      <div className={styles.field}>
        <label className={styles.label}>Date</label>
        <input
          type="date"
          className={styles.input}
          value={eventDate}
          onChange={(e) => setEventDate(e.target.value)}
        />
      </div>

      {/* Time */}
      <div className={styles.row}>
        <div className={styles.field}>
          <label className={styles.label}>Start time</label>
          <input
            type="time"
            className={styles.input}
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label}>End time</label>
          <input
            type="time"
            className={styles.input}
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
          />
        </div>
      </div>

      {/* Location */}
      <div className={styles.field}>
        <label className={styles.label}>Location (optional)</label>
        <input
          type="text"
          className={styles.input}
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Office or 123 Main St"
        />
      </div>

      {/* Details */}
      <div className={styles.field}>
        <label className={styles.label}>Details (optional)</label>
        <textarea
          className={styles.textarea}
          value={details}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Add any additional information..."
          rows={3}
          maxLength={1000}
        />
      </div>

      {/* Paid toggle */}
      <div className={styles.toggleRow}>
        <label className={styles.toggleLabel}>
          <span>Paid event</span>
          <span className={styles.toggleHint}>Attendees will be paid for this event</span>
        </label>
        <button
          type="button"
          className={`${styles.toggle} ${paid ? styles.on : ""}`}
          onClick={() => setPaid(!paid)}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      {/* Pay classes (if paid) */}
      {paid && (
        <div className={styles.field}>
          <label className={styles.label}>Pay equivalent to how many classes?</label>
          <input
            type="number"
            className={styles.input}
            value={payClasses}
            onChange={(e) => setPayClasses(e.target.value)}
            min="0.5"
            step="0.5"
            max="10"
          />
        </div>
      )}

      {/* Required toggle */}
      <div className={styles.toggleRow}>
        <label className={styles.toggleLabel}>
          <span>Required</span>
          <span className={styles.toggleHint}>Attendees must provide a reason if declining</span>
        </label>
        <button
          type="button"
          className={`${styles.toggle} ${required ? styles.on : ""}`}
          onClick={() => setRequired(!required)}
        >
          <span className={styles.toggleThumb} />
        </button>
      </div>

      {/* Audience */}
      <div className={styles.field}>
        <label className={styles.label}>Who should attend?</label>
        <div className={styles.radioGroup}>
          <label className={styles.radio}>
            <input
              type="radio"
              name="audience"
              checked={audienceType === "all"}
              onChange={() => setAudienceType("all")}
            />
            <span>All instructors</span>
          </label>
          <label className={styles.radio}>
            <input
              type="radio"
              name="audience"
              checked={audienceType === "specific"}
              onChange={() => setAudienceType("specific")}
            />
            <span>Specific people</span>
          </label>
        </div>
      </div>

      {/* Profile selection (if specific audience) */}
      {audienceType === "specific" && (
        <div className={styles.field}>
          <label className={styles.label}>Select people ({selectedProfiles.length} selected)</label>
          <div className={styles.profileList}>
            {instructors.map((instructor) => (
              <button
                key={instructor.id}
                type="button"
                className={`${styles.profileChip} ${selectedProfiles.includes(instructor.id) ? styles.selected : ""}`}
                onClick={() => toggleProfile(instructor.id)}
              >
                {instructor.full_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Send email toggle (only for new events) */}
      {!isEdit && (
        <div className={styles.toggleRow}>
          <label className={styles.toggleLabel}>
            <span>Send email notification</span>
            <span className={styles.toggleHint}>Notify everyone about this event</span>
          </label>
          <button
            type="button"
            className={`${styles.toggle} ${sendEmail ? styles.on : ""}`}
            onClick={() => setSendEmail(!sendEmail)}
          >
            <span className={styles.toggleThumb} />
          </button>
        </div>
      )}

      {/* Error */}
      {error && <div className={styles.error}>{error}</div>}

      {/* Submit */}
      <div className={styles.footer}>
        <button type="button" className={styles.cancelBtn} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? "Saving..." : isEdit ? "Save changes" : "Create event"}
        </button>
      </div>
    </form>
  );

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      title={isEdit ? "Edit team event" : "New team event"}
    >
      {content}
    </BottomSheet>
  );
}
