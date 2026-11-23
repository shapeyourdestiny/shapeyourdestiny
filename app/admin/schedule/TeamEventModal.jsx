"use client";

import { useState } from "react";
import styles from "./TeamEventModal.module.css";
import BottomSheet from "../components/BottomSheet";
import { createTeamEvent, updateTeamEvent } from "@/lib/team-events/actions";

const EVENT_TYPES = [
  { value: "meeting", label: "Meeting", color: "#1F3F91" },
  { value: "training", label: "Training", color: "#3E8FA0" },
  { value: "social", label: "Social", color: "#F2A65E" },
];

// Generate a URL slug from title and year
function generateSlug(title, date) {
  if (!title) return "";
  const year = date ? new Date(date + "T12:00:00").getFullYear() : new Date().getFullYear();
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${base}-${year}`;
}

// Get form values from event or defaults
function getFormValues(event, initialDate) {
  if (event) {
    return {
      type: event.type,
      title: event.title,
      eventDate: event.event_date,
      startTime: event.start_time?.slice(0, 5) || "09:00",
      endTime: event.end_time?.slice(0, 5) || "10:00",
      location: event.location || "",
      details: event.details || "",
      paid: event.paid || false,
      payClasses: event.pay_classes?.toString() || "1",
      required: event.required !== false,
      audienceType: event.audience?.type || "all",
      selectedProfiles: event.audience?.profileIds || [],
      sendEmail: false, // Don't re-send emails on edit
      // Public RSVP fields
      publicRsvp: event.public_rsvp || false,
      publicSlug: event.public_slug || "",
      allowGuests: event.allow_guests || false,
      note: event.note || "",
      highlight: event.highlight || "",
      locationUrl: event.location_url || "",
    };
  }
  return {
    type: "meeting",
    title: "",
    eventDate: initialDate || new Date().toISOString().split("T")[0],
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    details: "",
    paid: false,
    payClasses: "1",
    required: true,
    audienceType: "all",
    selectedProfiles: [],
    sendEmail: true,
    // Public RSVP fields
    publicRsvp: false,
    publicSlug: "",
    allowGuests: false,
    note: "",
    highlight: "",
    locationUrl: "",
  };
}

export default function TeamEventModal({
  open,
  onClose,
  onSave,
  event = null,
  initialDate = null,
  instructors = [],
}) {
  const isEdit = !!event;

  // Track when to reset form (when event or open state changes)
  const formKey = `${open}-${event?.id || "new"}-${initialDate}`;
  const [lastFormKey, setLastFormKey] = useState(formKey);

  const defaults = getFormValues(event, initialDate);
  const [type, setType] = useState(defaults.type);
  const [title, setTitle] = useState(defaults.title);
  const [eventDate, setEventDate] = useState(defaults.eventDate);
  const [startTime, setStartTime] = useState(defaults.startTime);
  const [endTime, setEndTime] = useState(defaults.endTime);
  const [location, setLocation] = useState(defaults.location);
  const [details, setDetails] = useState(defaults.details);
  const [paid, setPaid] = useState(defaults.paid);
  const [payClasses, setPayClasses] = useState(defaults.payClasses);
  const [required, setRequired] = useState(defaults.required);
  const [audienceType, setAudienceType] = useState(defaults.audienceType);
  const [selectedProfiles, setSelectedProfiles] = useState(defaults.selectedProfiles);
  const [sendEmail, setSendEmail] = useState(defaults.sendEmail);
  // Public RSVP fields
  const [publicRsvp, setPublicRsvp] = useState(defaults.publicRsvp);
  const [publicSlug, setPublicSlug] = useState(defaults.publicSlug);
  const [allowGuests, setAllowGuests] = useState(defaults.allowGuests);
  const [note, setNote] = useState(defaults.note);
  const [highlight, setHighlight] = useState(defaults.highlight);
  const [locationUrl, setLocationUrl] = useState(defaults.locationUrl);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when key changes
  if (formKey !== lastFormKey) {
    setLastFormKey(formKey);
    const vals = getFormValues(event, initialDate);
    setType(vals.type);
    setTitle(vals.title);
    setEventDate(vals.eventDate);
    setStartTime(vals.startTime);
    setEndTime(vals.endTime);
    setLocation(vals.location);
    setDetails(vals.details);
    setPaid(vals.paid);
    setPayClasses(vals.payClasses);
    setRequired(vals.required);
    setAudienceType(vals.audienceType);
    setSelectedProfiles(vals.selectedProfiles);
    setSendEmail(vals.sendEmail);
    setPublicRsvp(vals.publicRsvp);
    setPublicSlug(vals.publicSlug);
    setAllowGuests(vals.allowGuests);
    setNote(vals.note);
    setHighlight(vals.highlight);
    setLocationUrl(vals.locationUrl);
    setError(null);
  }

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
        // Public RSVP fields (only for social events)
        publicRsvp: type === "social" ? publicRsvp : false,
        publicSlug: type === "social" && publicRsvp ? (publicSlug.trim() || generateSlug(title, eventDate)) : null,
        allowGuests: type === "social" ? allowGuests : false,
        note: type === "social" ? (note.trim() || null) : null,
        highlight: type === "social" ? (highlight.trim() || null) : null,
        locationUrl: type === "social" ? (locationUrl.trim() || null) : null,
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

      {/* Social event: Public RSVP settings */}
      {type === "social" && (
        <>
          {/* Maps link */}
          <div className={styles.field}>
            <label className={styles.label}>Maps link (optional)</label>
            <input
              type="url"
              className={styles.input}
              value={locationUrl}
              onChange={(e) => setLocationUrl(e.target.value)}
              placeholder="https://maps.apple.com/..."
            />
          </div>

          {/* Note to the team */}
          <div className={styles.field}>
            <label className={styles.label}>Note to the team (optional)</label>
            <textarea
              className={styles.textarea}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="A personal message for your team..."
              rows={4}
              maxLength={3000}
            />
          </div>

          {/* Highlight */}
          <div className={styles.field}>
            <label className={styles.label}>Highlight (optional)</label>
            <input
              type="text"
              className={styles.input}
              value={highlight}
              onChange={(e) => setHighlight(e.target.value)}
              placeholder="e.g., Everyone gets a Christmas bonus!"
              maxLength={150}
            />
          </div>

          {/* Public RSVP toggle */}
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <span>Public RSVP link (no sign in)</span>
              <span className={styles.toggleHint}>People type their name to RSVP</span>
            </label>
            <button
              type="button"
              className={`${styles.toggle} ${publicRsvp ? styles.on : ""}`}
              onClick={() => setPublicRsvp(!publicRsvp)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {/* Slug (when public RSVP is on) */}
          {publicRsvp && (
            <div className={styles.field}>
              <label className={styles.label}>Link slug</label>
              <input
                type="text"
                className={styles.input}
                value={publicSlug || generateSlug(title, eventDate)}
                onChange={(e) => setPublicSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                placeholder="christmas-2026"
              />
              <span className={styles.toggleHint}>
                Link: /party/{publicSlug || generateSlug(title, eventDate)}
              </span>
            </div>
          )}

          {/* Allow guests toggle */}
          <div className={styles.toggleRow}>
            <label className={styles.toggleLabel}>
              <span>Let people bring guests</span>
              <span className={styles.toggleHint}>Partners, spouses, and kids</span>
            </label>
            <button
              type="button"
              className={`${styles.toggle} ${allowGuests ? styles.on : ""}`}
              onClick={() => setAllowGuests(!allowGuests)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </>
      )}

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
