"use client";

import { useState, useEffect, useMemo } from "react";
import styles from "./AddClassModal.module.css";
import { createClassWithProgramAction } from "@/lib/schedule/actions";
import { computeClassOccurrences, formatDateDisplay, formatDateFull } from "@/lib/schedule/occurrences";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];
const PROGRAMS = [
  { value: "wellness", label: "Youth Wellness Program" },
  { value: "soccer", label: "Intramural Soccer" },
];

// Get the next occurrence of a specific weekday from today
function getNextWeekday(weekdays) {
  if (!weekdays || weekdays.length === 0) return "";

  const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const today = new Date();
  const todayDay = today.getDay();

  // Find the nearest upcoming selected weekday
  let minDays = 7;
  weekdays.forEach((day) => {
    const targetDay = dayMap[day];
    let daysUntil = (targetDay - todayDay + 7) % 7;
    if (daysUntil === 0) daysUntil = 7; // Skip today, go to next week
    if (daysUntil < minDays) minDays = daysUntil;
  });

  const nextDate = new Date(today);
  nextDate.setDate(nextDate.getDate() + minDays);

  const y = nextDate.getFullYear();
  const m = String(nextDate.getMonth() + 1).padStart(2, "0");
  const d = String(nextDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function AddClassModal({ open, onClose, data, onDataChange }) {
  // Form state
  const [program, setProgram] = useState("wellness");
  const [districtId, setDistrictId] = useState("");
  const [schoolId, setSchoolId] = useState("");
  const [selectedDays, setSelectedDays] = useState([]);
  const [time, setTime] = useState("");
  const [startDate, setStartDate] = useState("");
  const [recurrenceType, setRecurrenceType] = useState("sessions"); // "sessions" or "ongoing"
  const [targetSessions, setTargetSessions] = useState(8);

  // Off days state
  const [offDays, setOffDays] = useState([]);
  const [newOffDayDate, setNewOffDayDate] = useState("");
  const [newOffDayReason, setNewOffDayReason] = useState("");
  const [offDaysLoading, setOffDaysLoading] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Get schools for selected district
  const schoolsForDistrict = useMemo(() => {
    if (!districtId) return [];
    const district = data.districts.find((d) => d.id === districtId);
    return district?.schools || [];
  }, [districtId, data.districts]);

  // Fetch off days when program changes
  useEffect(() => {
    if (!open || !program) return;

    const fetchOffDays = async () => {
      setOffDaysLoading(true);
      try {
        const res = await fetch(`/api/admin/program-off-days?program=${program}`);
        if (res.ok) {
          const data = await res.json();
          setOffDays(data);
        }
      } catch (err) {
        console.error("Failed to fetch off days:", err);
      } finally {
        setOffDaysLoading(false);
      }
    };

    fetchOffDays();
  }, [open, program]);

  // Filter holidays to those applicable to the selected school
  // Includes: global holidays, district holidays, and school-specific holidays
  const applicableHolidays = useMemo(() => {
    return (data.holidays || []).filter(h => {
      // Global holiday (applies to all)
      if (h.district_id === null && h.school_id === null) return true;
      // District-specific holiday (applies to all schools in district)
      if (h.district_id === districtId && h.school_id === null) return true;
      // School-specific holiday
      if (h.school_id === schoolId) return true;
      return false;
    });
  }, [data.holidays, districtId, schoolId]);

  // Compute preview
  const preview = useMemo(() => {
    if (!startDate || selectedDays.length === 0) {
      return null;
    }

    return computeClassOccurrences({
      startDate,
      days: selectedDays,
      targetSessions: recurrenceType === "sessions" ? targetSessions : null,
      holidays: applicableHolidays,
      programOffDays: offDays,
      rangeEnd: recurrenceType === "ongoing"
        ? (() => {
            // For ongoing preview, show next 3 months
            const d = new Date();
            d.setMonth(d.getMonth() + 3);
            return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          })()
        : null,
    });
  }, [startDate, selectedDays, recurrenceType, targetSessions, applicableHolidays, offDays]);

  // Track previous open state for reset logic
  const [lastOpen, setLastOpen] = useState(open);

  // Reset form when modal opens (only when transitioning from closed to open)
  if (open && !lastOpen) {
    setLastOpen(true);
    setProgram("wellness");
    setDistrictId("");
    setSchoolId("");
    setSelectedDays([]);
    setTime("");
    setStartDate("");
    setRecurrenceType("sessions");
    setTargetSessions(8);
    setNewOffDayDate("");
    setNewOffDayReason("");
    setError("");
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  // Handler for district change that also resets school
  const handleDistrictChange = (newDistrictId) => {
    setDistrictId(newDistrictId);
    setSchoolId("");
  };

  const toggleDay = (day) => {
    setSelectedDays((prev) => {
      const newDays = prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day];
      // Auto-set start date when first day is selected
      if (newDays.length > 0 && !startDate) {
        setStartDate(getNextWeekday(newDays));
      }
      return newDays;
    });
  };

  const handleAddOffDay = async (e) => {
    e.preventDefault();
    if (!newOffDayDate || !newOffDayReason.trim()) return;

    setOffDaysLoading(true);
    try {
      const res = await fetch("/api/admin/program-off-days", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          program,
          date: newOffDayDate,
          reason: newOffDayReason.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add off day");
        return;
      }

      const newOffDay = await res.json();
      setOffDays((prev) => [...prev, newOffDay].sort((a, b) => a.date.localeCompare(b.date)));
      setNewOffDayDate("");
      setNewOffDayReason("");
    } catch (err) {
      console.error("Failed to add off day:", err);
      setError("Failed to add off day");
    } finally {
      setOffDaysLoading(false);
    }
  };

  const handleDeleteOffDay = async (id) => {
    setOffDaysLoading(true);
    try {
      const res = await fetch(`/api/admin/program-off-days?id=${id}`, {
        method: "DELETE",
      });

      if (res.ok) {
        setOffDays((prev) => prev.filter((od) => od.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete off day:", err);
    } finally {
      setOffDaysLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!schoolId || selectedDays.length === 0 || !time.trim() || !startDate) {
      setError("Please fill in all required fields");
      return;
    }

    setLoading(true);
    setError("");

    try {
      await createClassWithProgramAction({
        schoolId,
        program,
        days: selectedDays,
        time: time.trim(),
        startDate,
        targetSessions: recurrenceType === "sessions" ? targetSessions : null,
        isReviewDay: false,
      });

      await onDataChange();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to create class");
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Add Class</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <form className={styles.content} onSubmit={handleSubmit}>
          {error && <p className={styles.error}>{error}</p>}

          {/* Program Selection */}
          <div className={styles.section}>
            <div className={styles.field}>
              <label>Program</label>
              <select value={program} onChange={(e) => setProgram(e.target.value)}>
                {PROGRAMS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* District & School */}
          <div className={styles.section}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>District</label>
                <select
                  value={districtId}
                  onChange={(e) => handleDistrictChange(e.target.value)}
                  required
                >
                  <option value="">Select district...</option>
                  {data.districts.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.field}>
                <label>School</label>
                <select
                  value={schoolId}
                  onChange={(e) => setSchoolId(e.target.value)}
                  required
                  disabled={!districtId}
                >
                  <option value="">Select school...</option>
                  {schoolsForDistrict.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Days & Time */}
          <div className={styles.section}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Days</label>
                <div className={styles.dayCheckboxes}>
                  {DAYS.map((day) => (
                    <label key={day} className={`${styles.dayCheckbox} ${selectedDays.includes(day) ? styles.selected : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedDays.includes(day)}
                        onChange={() => toggleDay(day)}
                      />
                      <span>{day}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label>Time</label>
                <input
                  type="text"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  placeholder="e.g., 2:30pm"
                  required
                />
              </div>
            </div>
          </div>

          {/* Start Date & Recurrence */}
          <div className={styles.section}>
            <div className={styles.row}>
              <div className={styles.field}>
                <label>Start Date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  required
                />
              </div>

              <div className={styles.field}>
                <label>Recurrence</label>
                <div className={styles.recurrenceToggle}>
                  <button
                    type="button"
                    className={`${styles.recurrenceBtn} ${recurrenceType === "sessions" ? styles.active : ""}`}
                    onClick={() => setRecurrenceType("sessions")}
                  >
                    Fixed Sessions
                  </button>
                  <button
                    type="button"
                    className={`${styles.recurrenceBtn} ${recurrenceType === "ongoing" ? styles.active : ""}`}
                    onClick={() => setRecurrenceType("ongoing")}
                  >
                    Ongoing
                  </button>
                </div>
              </div>
            </div>

            {recurrenceType === "sessions" && (
              <div className={styles.sessionsInput}>
                <label>Number of sessions per day:</label>
                <input
                  type="number"
                  min="1"
                  max="52"
                  value={targetSessions}
                  onChange={(e) => setTargetSessions(parseInt(e.target.value) || 8)}
                />
              </div>
            )}
          </div>

          {/* Off Days Section */}
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h3>Program Off Days</h3>
              <span className={styles.programBadge}>
                {PROGRAMS.find((p) => p.value === program)?.label}
              </span>
            </div>
            <p className={styles.sectionDesc}>
              These dates are skipped for all {PROGRAMS.find((p) => p.value === program)?.label} classes.
            </p>

            {/* Existing off days */}
            {offDays.length > 0 && (
              <div className={styles.offDaysList}>
                {offDays.map((od) => (
                  <div key={od.id} className={styles.offDayItem}>
                    <span className={styles.offDayDate}>{formatDateDisplay(od.date)}</span>
                    <span className={styles.offDayReason}>{od.reason}</span>
                    <button
                      type="button"
                      className={styles.offDayDelete}
                      onClick={() => handleDeleteOffDay(od.id)}
                      disabled={offDaysLoading}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Add off day form */}
            <div className={styles.addOffDayForm}>
              <input
                type="date"
                value={newOffDayDate}
                onChange={(e) => setNewOffDayDate(e.target.value)}
                placeholder="Date"
              />
              <input
                type="text"
                value={newOffDayReason}
                onChange={(e) => setNewOffDayReason(e.target.value)}
                placeholder="Reason (e.g., Field Trip)"
              />
              <button
                type="button"
                onClick={handleAddOffDay}
                disabled={offDaysLoading || !newOffDayDate || !newOffDayReason.trim()}
                className={styles.addOffDayBtn}
              >
                + Add
              </button>
            </div>
          </div>

          {/* Live Preview */}
          {preview && (
            <div className={styles.preview}>
              <h3>Preview</h3>
              {recurrenceType === "sessions" ? (
                <>
                  <p className={styles.previewMain}>
                    This creates <strong>{preview.occurrences.length} sessions</strong>, running from{" "}
                    <strong>{formatDateFull(startDate)}</strong> to{" "}
                    <strong>{formatDateFull(preview.endDate)}</strong>.
                  </p>
                  {preview.skipped.length > 0 && (
                    <p className={styles.previewSkipped}>
                      Skipping {preview.skipped.length} date{preview.skipped.length > 1 ? "s" : ""}:{" "}
                      {preview.skipped.map((s, i) => (
                        <span key={s.date}>
                          {i > 0 && ", "}
                          {formatDateDisplay(s.date)} ({s.reason}
                          {s.type === "holiday" && " - Holiday"}
                          {s.type === "off_day" && " - Off Day"})
                        </span>
                      ))}
                    </p>
                  )}
                </>
              ) : (
                <p className={styles.previewMain}>
                  Creates an ongoing class starting <strong>{formatDateFull(startDate)}</strong>.
                  Holidays and off days will be skipped automatically.
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <div className={styles.footer}>
            <button type="button" className={styles.cancelBtn} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={styles.submitBtn} disabled={loading}>
              {loading ? "Creating..." : "Create Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
