"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import styles from "./ClassPanel.module.css";
import {
  createClassWithProgramAction,
  updateClassAction,
  deleteClassAction,
  assignInstructorAction,
  unassignInstructorAction,
  fetchClassNotesAction,
} from "@/lib/schedule/actions";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";

const DAY_OPTIONS = [
  { value: "Mon", label: "Mon" },
  { value: "Tue", label: "Tue" },
  { value: "Wed", label: "Wed" },
  { value: "Thu", label: "Thu" },
  { value: "Fri", label: "Fri" },
  { value: "Sat", label: "Sat" },
];

// Parse time string to minutes from midnight
function parseTimeToMinutes(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return hours * 60 + minutes;
}

// Calculate hours between two time strings
function calculateHours(startTime, endTime) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = parseTimeToMinutes(endTime);
  const diff = endMinutes - startMinutes;
  if (diff <= 0) return 1;
  return Math.round(diff / 60);
}

// Calculate end time from start time and hours
function calculateEndTime(startTime, hours) {
  const startMinutes = parseTimeToMinutes(startTime);
  const endMinutes = startMinutes + hours * 60;
  const endHour24 = Math.floor(endMinutes / 60);
  const endMin = endMinutes % 60;
  const period = endHour24 >= 12 ? "PM" : "AM";
  const endHour12 = endHour24 > 12 ? endHour24 - 12 : endHour24 === 0 ? 12 : endHour24;
  return `${endHour12}:${endMin.toString().padStart(2, "0")} ${period}`;
}

// Convert "7:20 AM" to "07:20" (HTML time input format)
function to24HourFormat(timeStr) {
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return "12:00";
  let hours = parseInt(match[1], 10);
  const minutes = match[2];
  const period = match[3].toUpperCase();
  if (period === "PM" && hours !== 12) hours += 12;
  if (period === "AM" && hours === 12) hours = 0;
  return `${hours.toString().padStart(2, "0")}:${minutes}`;
}

// Convert "07:20" to "7:20 AM" (display format)
function to12HourFormat(timeStr) {
  const [hoursStr, minutes] = timeStr.split(":");
  let hours = parseInt(hoursStr, 10);
  const period = hours >= 12 ? "PM" : "AM";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

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

  // Get holidays and program off days from data
  const holidays = data.holidays || [];
  const allProgramOffDays = data.programOffDays || [];

  // Get initial end date - prefer stored end_date, fallback to computed from target_sessions
  const initialEndDate = useMemo(() => {
    // Use stored end_date if available
    if (existingClass?.end_date) {
      return existingClass.end_date;
    }
    // Fallback: compute from target_sessions for legacy data
    if (!existingClass?.target_sessions || !existingClass?.start_date || !existingClass?.days?.length) {
      return "";
    }
    const relevantOffDays = allProgramOffDays.filter(
      (pod) => pod.program === existingClass.program
    );
    const result = computeClassOccurrences({
      startDate: existingClass.start_date,
      days: existingClass.days,
      targetSessions: existingClass.target_sessions,
      holidays,
      programOffDays: relevantOffDays,
      classTime: existingClass.time,
    });
    return result.endDate || "";
  }, [existingClass, holidays, allProgramOffDays]);

  // Form state
  const [selectedSchoolId, setSelectedSchoolId] = useState(
    existingClass ? classSchool?.id : schoolId || ""
  );
  const [program, setProgram] = useState(existingClass?.program || "wellness");
  const [days, setDays] = useState(existingClass?.days || []);
  const [time, setTime] = useState(existingClass?.time || "2:00 PM");
  // Calculate initial end time from existing data or default to 1 hour after start
  const initialEndTime = existingClass?.end_time ||
    (existingClass?.time && existingClass?.hours_per_day
      ? calculateEndTime(existingClass.time, existingClass.hours_per_day)
      : "3:00 PM");
  const [endTime, setEndTime] = useState(initialEndTime);
  const [startDate, setStartDate] = useState(existingClass?.start_date || "");
  const [endDate, setEndDate] = useState(initialEndDate);
  const [isOngoing, setIsOngoing] = useState(!existingClass?.target_sessions);
  const [isReviewDay, setIsReviewDay] = useState(existingClass?.is_review_day || false);

  // Auto-calculate hours per day from time range
  const hoursPerDay = useMemo(() => {
    return calculateHours(time, endTime);
  }, [time, endTime]);

  // Handle start time change - adjust end time if needed
  const handleStartTimeChange = (newTime) => {
    setTime(newTime);
    const newStartMinutes = parseTimeToMinutes(newTime);
    const currentEndMinutes = parseTimeToMinutes(endTime);
    if (currentEndMinutes <= newStartMinutes) {
      // Set end time to 1 hour after new start time
      setEndTime(calculateEndTime(newTime, 1));
    }
  };

  // Compute session count between start and end date
  const sessionPreview = useMemo(() => {
    if (!startDate || days.length === 0 || isOngoing) return null;
    if (!endDate) return null;

    // Filter program off days to only those matching the selected program
    const relevantOffDays = allProgramOffDays.filter(
      (pod) => pod.program === program
    );

    const result = computeClassOccurrences({
      startDate,
      days,
      targetSessions: null,
      holidays,
      programOffDays: relevantOffDays,
      classTime: time,
      rangeEnd: endDate,
    });

    return result;
  }, [startDate, endDate, days, isOngoing, holidays, allProgramOffDays, program, time]);

  // Instructor assignment
  const [showInstructorPicker, setShowInstructorPicker] = useState(null); // 'instructor_1' or 'instructor_2'

  // Class notes
  const [classNotes, setClassNotes] = useState([]);
  const [notesLoading, setNotesLoading] = useState(false);

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

  // Fetch class notes for existing class
  useEffect(() => {
    if (!classId || mode !== "edit") return;

    async function fetchNotes() {
      setNotesLoading(true);
      try {
        const notes = await fetchClassNotesAction(classId, 10);
        setClassNotes(notes || []);
      } catch (err) {
        console.error("Failed to fetch class notes:", err);
      } finally {
        setNotesLoading(false);
      }
    }

    fetchNotes();
  }, [classId, mode]);

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
          endTime,
          startDate,
          endDate: isOngoing ? null : endDate,
          targetSessions,
          isReviewDay,
          hoursPerDay,
        });
      } else {
        await updateClassAction(classId, {
          program,
          days,
          time,
          end_time: endTime,
          start_date: startDate,
          end_date: isOngoing ? null : endDate,
          target_sessions: targetSessions,
          is_review_day: isReviewDay,
          hours_per_day: hoursPerDay,
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
            <label>Start time</label>
            <input
              type="time"
              value={to24HourFormat(time)}
              onChange={(e) => handleStartTimeChange(to12HourFormat(e.target.value))}
            />
          </div>

          {/* End Time */}
          <div className={styles.field}>
            <label>End time</label>
            <input
              type="time"
              value={to24HourFormat(endTime)}
              onChange={(e) => setEndTime(to12HourFormat(e.target.value))}
            />
            <span className={styles.hint}>
              {hoursPerDay} hour{hoursPerDay !== 1 ? "s" : ""} ({hoursPerDay} class{hoursPerDay !== 1 ? "es" : ""} for payroll)
            </span>
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
                {!isOngoing && sessionPreview ? (
                  <span>
                    {progress.sessionsDone} of {sessionPreview.occurrences.length} sessions completed
                    {endDate && ` · Ends ${endDate}`}
                  </span>
                ) : isOngoing ? (
                  <span>
                    {progress.sessionsDone} sessions completed · Ongoing
                  </span>
                ) : (
                  <span>
                    {progress.sessionsDone} sessions completed
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

          {/* Class Notes (edit mode only) */}
          {existingClass && (
            <div className={styles.notesSection}>
              <h4>Class notes</h4>
              {notesLoading ? (
                <p className={styles.notesLoading}>Loading notes...</p>
              ) : classNotes.length === 0 ? (
                <p className={styles.noNotes}>No notes from instructors yet.</p>
              ) : (
                <>
                  {/* 30-day averages */}
                  {classNotes.length > 0 && (
                    <div className={styles.notesAverages}>
                      <span className={styles.averagesLabel}>30-day avg</span>
                      <div className={styles.averagesRow}>
                        <span className={styles.avgLabel}>Overall</span>
                        <span className={styles.avgStars}>
                          {[1, 2, 3, 4, 5].map((i) => {
                            const avg = classNotes.reduce((sum, n) => sum + (n.overall || 0), 0) / classNotes.length;
                            return (
                              <svg key={i} viewBox="0 0 24 24" className={i <= Math.round(avg) ? styles.starFilled : styles.starEmpty}>
                                <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                              </svg>
                            );
                          })}
                        </span>
                        <span className={styles.avgValue}>
                          {(classNotes.reduce((sum, n) => sum + (n.overall || 0), 0) / classNotes.length).toFixed(1)}
                        </span>
                      </div>
                      {classNotes.some(n => n.attention) && (
                        <div className={styles.averagesRow}>
                          <span className={styles.avgLabel}>Attention</span>
                          <span className={styles.avgStars}>
                            {[1, 2, 3, 4, 5].map((i) => {
                              const notes = classNotes.filter(n => n.attention);
                              const avg = notes.length > 0 ? notes.reduce((sum, n) => sum + n.attention, 0) / notes.length : 0;
                              return (
                                <svg key={i} viewBox="0 0 24 24" className={i <= Math.round(avg) ? styles.starFilled : styles.starEmpty}>
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              );
                            })}
                          </span>
                          <span className={styles.avgValue}>
                            {(() => {
                              const notes = classNotes.filter(n => n.attention);
                              return notes.length > 0 ? (notes.reduce((sum, n) => sum + n.attention, 0) / notes.length).toFixed(1) : "-";
                            })()}
                          </span>
                        </div>
                      )}
                      {classNotes.some(n => n.behavior) && (
                        <div className={styles.averagesRow}>
                          <span className={styles.avgLabel}>Behavior</span>
                          <span className={styles.avgStars}>
                            {[1, 2, 3, 4, 5].map((i) => {
                              const notes = classNotes.filter(n => n.behavior);
                              const avg = notes.length > 0 ? notes.reduce((sum, n) => sum + n.behavior, 0) / notes.length : 0;
                              return (
                                <svg key={i} viewBox="0 0 24 24" className={i <= Math.round(avg) ? styles.starFilled : styles.starEmpty}>
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              );
                            })}
                          </span>
                          <span className={styles.avgValue}>
                            {(() => {
                              const notes = classNotes.filter(n => n.behavior);
                              return notes.length > 0 ? (notes.reduce((sum, n) => sum + n.behavior, 0) / notes.length).toFixed(1) : "-";
                            })()}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                  <div className={styles.notesList}>
                    {classNotes.map((note) => (
                      <div key={note.id} className={styles.noteItem}>
                        <div className={styles.noteHeader}>
                          <span className={styles.noteInstructor}>
                            {note.profile?.full_name?.split(" ")[0]}
                          </span>
                          <span className={styles.noteDate}>
                            {new Date(note.session_date + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </span>
                        </div>
                        <div className={styles.noteStars}>
                          <div className={styles.noteStarRow}>
                            <span className={styles.noteStarLabel}>Overall</span>
                            <span className={styles.noteStarIcons}>
                              {[1, 2, 3, 4, 5].map((i) => (
                                <svg key={i} viewBox="0 0 24 24" className={i <= note.overall ? styles.starFilled : styles.starEmpty}>
                                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                </svg>
                              ))}
                            </span>
                          </div>
                          {note.attention && (
                            <div className={styles.noteStarRow}>
                              <span className={styles.noteStarLabel}>Attention</span>
                              <span className={styles.noteStarIcons}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <svg key={i} viewBox="0 0 24 24" className={i <= note.attention ? styles.starFilled : styles.starEmpty}>
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                ))}
                              </span>
                            </div>
                          )}
                          {note.behavior && (
                            <div className={styles.noteStarRow}>
                              <span className={styles.noteStarLabel}>Behavior</span>
                              <span className={styles.noteStarIcons}>
                                {[1, 2, 3, 4, 5].map((i) => (
                                  <svg key={i} viewBox="0 0 24 24" className={i <= note.behavior ? styles.starFilled : styles.starEmpty}>
                                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
                                  </svg>
                                ))}
                              </span>
                            </div>
                          )}
                          {note.needs_supplies && (
                            <span className={styles.needsSuppliesBadge}>Needs supplies</span>
                          )}
                        </div>
                        {note.body && (
                          <p className={styles.noteBody}>{note.body}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </>
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
