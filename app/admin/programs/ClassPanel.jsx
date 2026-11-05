"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./ClassPanel.module.css";
import {
  createClassWithProgramAction,
  updateClassAction,
  deleteClassAction,
  assignInstructorAction,
  unassignInstructorAction,
} from "@/lib/schedule/actions";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";

const DAY_OPTIONS = [
  { value: "Mon", label: "Mon" },
  { value: "Tue", label: "Tue" },
  { value: "Wed", label: "Wed" },
  { value: "Thu", label: "Thu" },
  { value: "Fri", label: "Fri" },
];

const TIME_OPTIONS = [
  "7:00 AM", "7:30 AM", "8:00 AM", "8:30 AM", "9:00 AM", "9:30 AM",
  "10:00 AM", "10:30 AM", "11:00 AM", "11:30 AM", "12:00 PM", "12:30 PM",
  "1:00 PM", "1:30 PM", "2:00 PM", "2:30 PM", "3:00 PM", "3:30 PM",
  "4:00 PM", "4:30 PM", "5:00 PM",
];

export default function ClassPanel({
  mode,
  classId,
  schoolId,
  // districtId - unused but passed from spread
  // today - unused but passed from spread
  data,
  progressMap,
  onClose,
  onSave,
}) {
  const panelRef = useRef(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Find existing class if editing
  const existingClass = classId
    ? data.districts
        .flatMap((d) => d.schools || [])
        .flatMap((s) => s.classes || [])
        .find((c) => c.id === classId)
    : null;

  // Find school for this class
  const classSchool = existingClass
    ? data.districts
        .flatMap((d) => d.schools || [])
        .find((s) => s.classes?.some((c) => c.id === classId))
    : schoolId
    ? data.districts
        .flatMap((d) => d.schools || [])
        .find((s) => s.id === schoolId)
    : null;

  // Form state
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    existingClass ? classSchool?.id : schoolId || ""
  );
  const [program, setProgram] = useState(existingClass?.program || "wellness");
  const [days, setDays] = useState(existingClass?.days || []);
  const [time, setTime] = useState(existingClass?.time || "2:00 PM");
  const [startDate, setStartDate] = useState(existingClass?.start_date || "");
  const [endDate, setEndDate] = useState("");
  const [isOngoing, setIsOngoing] = useState(!existingClass?.target_sessions);
  const [isReviewDay, setIsReviewDay] = useState(existingClass?.is_review_day || false);

  // Get holidays from data (if available)
  const holidays = data.holidays || [];

  // Compute session count between start and end date
  const sessionPreview = useMemo(() => {
    if (!startDate || days.length === 0 || isOngoing) return null;
    if (!endDate) return null;

    const result = computeClassOccurrences({
      startDate,
      days,
      targetSessions: null,
      holidays,
      programOffDays: [],
      classTime: time,
      rangeEnd: endDate,
    });

    return result;
  }, [startDate, endDate, days, isOngoing, holidays, time]);

  // Instructor assignment
  const [showInstructorPicker, setShowInstructorPicker] = useState(null); // 'instructor_1' or 'instructor_2'

  // Get instructors from data
  const instructors = data.instructors || [];

  // Current assignments
  const instructor1 = existingClass?.assignments?.find((a) => a.slotType === "instructor_1");
  const instructor2 = existingClass?.assignments?.find((a) => a.slotType === "instructor_2");

  // Progress info
  const progress = existingClass ? progressMap[existingClass.id] : null;

  // Close on escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Focus trap
  useEffect(() => {
    const panel = panelRef.current;
    if (!panel) return;
    const firstFocusable = panel.querySelector("button, input, select, textarea");
    firstFocusable?.focus();
  }, []);

  const handleDayToggle = (day) => {
    setDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSave = async () => {
    setError(null);

    if (!selectedSchoolId) {
      setError("Please select a school");
      return;
    }
    if (days.length === 0) {
      setError("Please select at least one day");
      return;
    }
    if (!startDate) {
      setError("Please enter a start date");
      return;
    }
    if (!isOngoing && !endDate) {
      setError("Please select an end date or mark as ongoing");
      return;
    }

    // Calculate target sessions from the preview (sessions per day)
    let targetSessions = null;
    if (!isOngoing && sessionPreview && sessionPreview.occurrences.length > 0) {
      const countsByDay = {};
      sessionPreview.occurrences.forEach(occ => {
        countsByDay[occ.weekday] = (countsByDay[occ.weekday] || 0) + 1;
      });
      targetSessions = Math.max(...Object.values(countsByDay));
    }

    setLoading(true);

    try {
      if (mode === "create") {
        await createClassWithProgramAction({
          schoolId: selectedSchoolId,
          program,
          days,
          time,
          startDate,
          targetSessions,
          isReviewDay,
        });
      } else {
        await updateClassAction(classId, {
          program,
          days,
          time,
          start_date: startDate,
          target_sessions: targetSessions,
          is_review_day: isReviewDay,
        });
      }
      await onSave();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this class? This cannot be undone.")) return;

    setLoading(true);
    try {
      await deleteClassAction(classId);
      await onSave();
      onClose();
    } catch (err) {
      setError(err.message || "Failed to delete");
    } finally {
      setLoading(false);
    }
  };

  const handleAssignInstructor = async (profileId, slotType) => {
    setLoading(true);
    try {
      await assignInstructorAction(classId, profileId, slotType);
      await onSave();
      setShowInstructorPicker(null);
    } catch (err) {
      setError(err.message || "Failed to assign");
    } finally {
      setLoading(false);
    }
  };

  const handleUnassignInstructor = async (slotType) => {
    setLoading(true);
    try {
      await unassignInstructorAction(classId, slotType);
      await onSave();
    } catch (err) {
      setError(err.message || "Failed to unassign");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className={styles.overlay} onClick={onClose} />
      <div className={styles.panel} ref={panelRef}>
        <div className={styles.header}>
          <h2>{mode === "create" ? "Add class" : "Edit class"}</h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {/* School selection (only for create without preset school) */}
          {mode === "create" && !schoolId && (
            <div className={styles.field}>
              <label>School</label>
              <select
                value={selectedSchoolId}
                onChange={(e) => setSelectedSchoolId(e.target.value)}
              >
                <option value="">Select a school...</option>
                {data.districts.map((district) => (
                  <optgroup key={district.id} label={district.name}>
                    {(district.schools || []).map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
          )}

          {/* School info (display only when preset or editing) */}
          {classSchool && (
            <div className={styles.schoolInfo}>
              <span className={styles.schoolLabel}>School</span>
              <span className={styles.schoolName}>{classSchool.name}</span>
            </div>
          )}

          {/* Program */}
          <div className={styles.field}>
            <label>Program</label>
            <div className={styles.programToggle}>
              <button
                type="button"
                className={`${styles.programBtn} ${program === "wellness" ? styles.programBtnActive : ""}`}
                onClick={() => setProgram("wellness")}
              >
                Youth Wellness
              </button>
              <button
                type="button"
                className={`${styles.programBtn} ${program === "soccer" ? styles.programBtnActive : ""}`}
                onClick={() => setProgram("soccer")}
              >
                Soccer
              </button>
            </div>
          </div>

          {/* Days */}
          <div className={styles.field}>
            <label>Days</label>
            <div className={styles.daysPicker}>
              {DAY_OPTIONS.map((day) => (
                <button
                  key={day.value}
                  type="button"
                  className={`${styles.dayBtn} ${days.includes(day.value) ? styles.dayBtnActive : ""}`}
                  onClick={() => handleDayToggle(day.value)}
                >
                  {day.label}
                </button>
              ))}
            </div>
          </div>

          {/* Time */}
          <div className={styles.field}>
            <label>Time</label>
            <select value={time} onChange={(e) => setTime(e.target.value)}>
              {TIME_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Start date */}
          <div className={styles.field}>
            <label>Start date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* End date */}
          <div className={styles.field}>
            <label>End date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              disabled={isOngoing}
              min={startDate}
            />
          </div>

          {/* Ongoing checkbox */}
          <div className={styles.toggleField}>
            <label>
              <input
                type="checkbox"
                checked={isOngoing}
                onChange={(e) => {
                  setIsOngoing(e.target.checked);
                  if (e.target.checked) setEndDate("");
                }}
              />
              <span className={styles.toggleLabel}>Ongoing class (no end date)</span>
            </label>
          </div>

          {/* Session count preview */}
          {sessionPreview && sessionPreview.occurrences.length > 0 && !isOngoing && (
            <div className={styles.sessionPreview}>
              <span className={styles.sessionCount}>{sessionPreview.occurrences.length}</span>
              <span className={styles.sessionLabel}>sessions</span>
            </div>
          )}

          {/* Review day toggle */}
          <div className={styles.toggleField}>
            <label>
              <input
                type="checkbox"
                checked={isReviewDay}
                onChange={(e) => setIsReviewDay(e.target.checked)}
              />
              <span className={styles.toggleLabel}>This is a review day</span>
            </label>
            <span className={styles.hint}>
              Review days count toward total sessions but may be excluded from curriculum tracking.
            </span>
          </div>

          {/* Progress info (edit mode only) */}
          {existingClass && progress && (
            <div className={styles.progressSection}>
              <h4>Progress</h4>
              <div className={styles.progressInfo}>
                {progress.totalSessions ? (
                  <span>
                    {progress.sessionsDone} of {progress.totalSessions} sessions completed
                    {progress.endDate && ` · Ends ${progress.endDate}`}
                  </span>
                ) : (
                  <span>
                    {progress.sessionsDone} sessions completed · Ongoing
                  </span>
                )}
              </div>
              <div className={styles.statusPill} data-status={progress.status}>
                {progress.status === "starts_soon"
                  ? "Starts soon"
                  : progress.status === "ended"
                  ? "Ended"
                  : "Running"}
              </div>
            </div>
          )}

          {/* Instructors (edit mode only) */}
          {existingClass && (
            <div className={styles.instructorsSection}>
              <h4>Instructors</h4>

              {/* Instructor 1 */}
              <div className={styles.instructorSlot}>
                <span className={styles.slotLabel}>Instructor 1</span>
                {instructor1 ? (
                  <div className={styles.assignedInstructor}>
                    <span className={styles.instructorInitial}>
                      {instructor1.profile?.full_name?.charAt(0)}
                    </span>
                    <span className={styles.instructorName}>
                      {instructor1.profile?.full_name}
                    </span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleUnassignInstructor("instructor_1")}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.assignBtn}
                    onClick={() => setShowInstructorPicker("instructor_1")}
                    disabled={loading}
                  >
                    + Assign
                  </button>
                )}
              </div>

              {/* Instructor 2 */}
              <div className={styles.instructorSlot}>
                <span className={styles.slotLabel}>Instructor 2</span>
                {instructor2 ? (
                  <div className={styles.assignedInstructor}>
                    <span className={styles.instructorInitial}>
                      {instructor2.profile?.full_name?.charAt(0)}
                    </span>
                    <span className={styles.instructorName}>
                      {instructor2.profile?.full_name}
                    </span>
                    <button
                      className={styles.removeBtn}
                      onClick={() => handleUnassignInstructor("instructor_2")}
                      disabled={loading}
                    >
                      Remove
                    </button>
                  </div>
                ) : (
                  <button
                    className={styles.assignBtn}
                    onClick={() => setShowInstructorPicker("instructor_2")}
                    disabled={loading}
                  >
                    + Assign
                  </button>
                )}
              </div>

              {/* Instructor picker dropdown */}
              {showInstructorPicker && (
                <div className={styles.instructorPicker}>
                  <div className={styles.pickerHeader}>
                    <span>Select instructor</span>
                    <button onClick={() => setShowInstructorPicker(null)}>Cancel</button>
                  </div>
                  <div className={styles.instructorList}>
                    {instructors.length === 0 ? (
                      <p className={styles.noInstructors}>No instructors available</p>
                    ) : (
                      instructors.map((instructor) => (
                        <button
                          key={instructor.id}
                          className={styles.instructorOption}
                          onClick={() =>
                            handleAssignInstructor(instructor.id, showInstructorPicker)
                          }
                          disabled={loading}
                        >
                          <span className={styles.instructorInitial}>
                            {instructor.full_name?.charAt(0)}
                          </span>
                          <span>{instructor.full_name}</span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className={styles.footer}>
          {mode === "edit" && (
            <button
              className={styles.deleteBtn}
              onClick={handleDelete}
              disabled={loading}
            >
              Delete class
            </button>
          )}
          <div className={styles.footerRight}>
            <button className={styles.cancelBtn} onClick={onClose} disabled={loading}>
              Cancel
            </button>
            <button
              className={styles.saveBtn}
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? "Saving..." : mode === "create" ? "Add class" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
