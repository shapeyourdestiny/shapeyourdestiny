"use client";

import { useState, useMemo } from "react";
import styles from "./MarkOutModal.module.css";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";
import { createSessionChangesBulkAction } from "@/lib/schedule/actions";
import { sendSubAssignedEmail } from "@/lib/email";

const REASONS = [
  { value: "vacation", label: "Vacation" },
  { value: "sick", label: "Sick" },
  { value: "appointment", label: "Appointment" },
  { value: "personal", label: "Personal" },
  { value: "emergency", label: "Emergency" },
  { value: "other", label: "Other" },
];

// Get today's date as YYYY-MM-DD
function getTodayString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

/**
 * Modal for marking an instructor out and optionally assigning subs.
 * Supports one-day and several-days modes.
 */
export default function MarkOutModal({
  open,
  mode = "one_day", // "one_day" or "several_days"
  instructor: initialInstructor,
  cls: initialClass,
  date: initialDate,
  slotType: initialSlotType,
  data,
  onClose,
  onSave,
}) {
  // Track previous open state for reset
  const [lastOpen, setLastOpen] = useState(open);

  // Form state - use initializer functions
  const getInitialDate = () => initialDate || getTodayString();
  const [selectedInstructor, setSelectedInstructor] = useState(initialInstructor?.id || "");
  const [reason, setReason] = useState("vacation");
  const [note, setNote] = useState("");
  const [notifiedOn, setNotifiedOn] = useState(getTodayString);
  const [startDate, setStartDate] = useState(getInitialDate);
  const [endDate, setEndDate] = useState(getInitialDate);

  // Sub assignments per session
  const [subAssignments, setSubAssignments] = useState({});
  const [useSameSub, setUseSameSub] = useState(false);
  const [sameSub, setSameSub] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  // Reset form when modal opens (only when transitioning from closed to open)
  if (open && !lastOpen) {
    setLastOpen(true);
    setSelectedInstructor(initialInstructor?.id || "");
    setReason("vacation");
    setNote("");
    setNotifiedOn(getTodayString());
    setStartDate(initialDate || getTodayString());
    setEndDate(initialDate || getTodayString());
    setSubAssignments({});
    setUseSameSub(false);
    setSameSub("");
    setError("");
    setSendEmail(true);
  } else if (!open && lastOpen) {
    setLastOpen(false);
  }

  // Get all instructors who teach classes
  const instructorOptions = useMemo(() => {
    return data.instructors.filter(i => i.role === "instructor" || i.role === "admin");
  }, [data.instructors]);

  // Get the selected instructor object
  const instructorObj = useMemo(() => {
    return data.instructors.find(i => i.id === selectedInstructor);
  }, [data.instructors, selectedInstructor]);

  // Get classes taught by the selected instructor
  const instructorClasses = useMemo(() => {
    if (!selectedInstructor) return [];

    const classes = [];
    data.districts.forEach(district => {
      district.schools?.forEach(school => {
        school.classes?.forEach(cls => {
          const assignment = cls.assignments?.find(
            a => a.profile?.id === selectedInstructor &&
            (a.slotType === "instructor_1" || a.slotType === "instructor_2")
          );
          if (assignment) {
            classes.push({
              ...cls,
              school,
              district,
              slotType: assignment.slotType,
              coInstructor: cls.assignments?.find(
                a => a.profile?.id !== selectedInstructor &&
                (a.slotType === "instructor_1" || a.slotType === "instructor_2")
              )?.profile || null,
            });
          }
        });
      });
    });
    return classes;
  }, [selectedInstructor, data]);

  // Get sessions affected by the absence
  const affectedSessions = useMemo(() => {
    if (!selectedInstructor || !startDate) return [];

    const sessions = [];
    const end = mode === "one_day" ? startDate : endDate;

    for (const cls of instructorClasses) {
      // Get occurrences for this class in the date range
      const result = computeClassOccurrences({
        startDate: cls.start_date || startDate,
        days: cls.days,
        targetSessions: cls.target_sessions,
        holidays: getApplicableHolidays(cls.district?.id, cls.school?.id),
        programOffDays: getProgramOffDays(cls.program || "wellness"),
        classTime: cls.time,
      });

      // Filter to sessions within the absence range
      for (const occ of result.occurrences) {
        if (occ.date >= startDate && occ.date <= end) {
          sessions.push({
            id: `${cls.id}-${occ.date}`,
            classId: cls.id,
            date: occ.date,
            cls,
            coInstructor: cls.coInstructor,
            slotType: cls.slotType,
          });
        }
      }
    }

    // Sort by date
    sessions.sort((a, b) => a.date.localeCompare(b.date));
    return sessions;
  }, [selectedInstructor, startDate, endDate, mode, instructorClasses]);

  // Get holidays for a school
  function getApplicableHolidays(districtId, schoolId) {
    return (data.holidays || []).filter(h => {
      if (h.district_id === null && h.school_id === null) return true;
      if (h.district_id === districtId && h.school_id === null) return true;
      if (h.school_id === schoolId) return true;
      return false;
    });
  }

  // Get program off days
  function getProgramOffDays(program) {
    return (data.programOffDays || []).filter(od => od.program === program);
  }

  // Check if a session date is an off day (holiday or program off day)
  function isOffDay(session) {
    const holidays = getApplicableHolidays(session.cls.district?.id, session.cls.school?.id);
    const offDays = getProgramOffDays(session.cls.program || "wellness");

    const isHoliday = holidays.some(h => h.date === session.date);
    const isOff = offDays.some(od => od.date === session.date);

    return isHoliday || isOff;
  }

  // Get available subs for a session
  function getAvailableSubs(session) {
    const free = [];
    const unavailable = [];

    for (const instructor of instructorOptions) {
      // Skip the absent instructor
      if (instructor.id === selectedInstructor) continue;

      // Check if already teaching this class
      const isOnThisClass = session.cls.assignments?.some(
        a => a.profile?.id === instructor.id
      );
      if (isOnThisClass) {
        unavailable.push({
          instructor,
          reason: "Already teaching this class",
        });
        continue;
      }

      // Check if they're out that day (has a session_change where they're absent)
      const isOut = (data.sessionChanges || []).some(
        sc => sc.absent_profile_id === instructor.id && sc.session_date === session.date
      );
      if (isOut) {
        const sc = (data.sessionChanges || []).find(
          sc => sc.absent_profile_id === instructor.id && sc.session_date === session.date
        );
        unavailable.push({
          instructor,
          reason: `Out that day${sc?.reason ? ` (${sc.reason})` : ""}`,
        });
        continue;
      }

      // Check if they have an overlapping class
      const hasOverlap = checkTimeOverlap(instructor.id, session);
      if (hasOverlap) {
        unavailable.push({
          instructor,
          reason: hasOverlap,
        });
        continue;
      }

      // Get instructor's districts
      const instructorDistricts = instructor.district_ids || [];
      const sessionDistrictId = session.cls.district?.id;
      const sameDistrict = instructorDistricts.includes(sessionDistrictId);

      free.push({
        instructor,
        sameDistrict,
      });
    }

    // Sort free subs: same district first
    free.sort((a, b) => (b.sameDistrict ? 1 : 0) - (a.sameDistrict ? 1 : 0));

    return { free, unavailable };
  }

  // Check if instructor has overlapping session
  function checkTimeOverlap(instructorId, session) {
    // Get all classes this instructor teaches
    let teachesAt = null;

    data.districts.forEach(district => {
      district.schools?.forEach(school => {
        school.classes?.forEach(cls => {
          const isAssigned = cls.assignments?.some(
            a => a.profile?.id === instructorId &&
            (a.slotType === "instructor_1" || a.slotType === "instructor_2")
          );
          if (!isAssigned) return;

          // Check if this class is on the same day
          const dayOfSession = new Date(session.date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short" });
          if (!cls.days?.includes(dayOfSession)) return;

          // Check time overlap (within 2 hours if no hours_per_day)
          const sessionHours = session.cls.hours_per_day || 1;
          const otherHours = cls.hours_per_day || 1;

          // Simple check: if same time, it's an overlap
          if (cls.time === session.cls.time) {
            teachesAt = `Teaching at ${school.name} at ${cls.time}`;
            return;
          }

          // TODO: More sophisticated time overlap check
        });
      });
    });

    return teachesAt;
  }

  // Format date for display
  function formatDate(dateStr) {
    if (!dateStr) return "";
    const d = new Date(dateStr + "T00:00:00");
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
  }

  // Get initials
  function getInitials(fullName) {
    if (!fullName) return "?";
    const parts = fullName.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return parts[0][0] + parts[parts.length - 1][0];
    }
    return parts[0]?.[0] || "?";
  }

  // Handle sub assignment change
  function handleSubChange(sessionId, subId) {
    setSubAssignments(prev => ({
      ...prev,
      [sessionId]: subId,
    }));
  }

  // Handle save
  async function handleSave() {
    if (!selectedInstructor) {
      setError("Please select who is out");
      return;
    }

    if (affectedSessions.length === 0) {
      setError("No classes found in this date range");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Generate absence group ID for multi-day absences
      const absenceGroupId = crypto.randomUUID();

      // Build session changes
      const changes = affectedSessions
        .filter(session => !isOffDay(session))
        .map(session => {
          const subId = useSameSub ? sameSub : subAssignments[session.id];
          return {
            classId: session.classId,
            sessionDate: session.date,
            slotType: session.slotType,
            absentProfileId: selectedInstructor,
            subProfileId: subId || null,
            reason,
            note: note.trim() || null,
            absenceGroupId: mode === "several_days" ? absenceGroupId : null,
            notifiedOn: notifiedOn || null,
          };
        });

      if (changes.length > 0) {
        await createSessionChangesBulkAction(changes);
      }

      // Send notification emails to subs if enabled
      if (sendEmail) {
        // Group sessions by sub
        const sessionsBySub = {};
        for (const session of affectedSessions) {
          if (isOffDay(session)) continue;
          const subId = useSameSub ? sameSub : subAssignments[session.id];
          if (!subId) continue;

          if (!sessionsBySub[subId]) {
            sessionsBySub[subId] = [];
          }
          sessionsBySub[subId].push({
            date: session.date,
            time: session.cls.time,
            schoolName: session.cls.school?.name || "Unknown School",
            schoolAddress: session.cls.school?.address || null,
            program: session.cls.program || "Wellness",
          });
        }

        // Send emails to each sub
        const emailPromises = Object.entries(sessionsBySub).map(([subId, sessions]) => {
          const subInstructor = data.instructors.find(i => i.id === subId);
          if (!subInstructor?.email) return Promise.resolve();

          return sendSubAssignedEmail({
            sub: subInstructor,
            absentInstructor: instructorObj,
            sessions,
          }).catch(err => {
            console.error(`Failed to send email to ${subInstructor.email}:`, err);
          });
        });

        await Promise.all(emailPromises);
      }

      await onSave();
    } catch (err) {
      console.error("Failed to save:", err);
      setError(err.message || "Failed to save");
    } finally {
      setLoading(false);
    }
  }

  // Count sessions still needing a sub
  const needsSubCount = affectedSessions.filter(s => {
    if (isOffDay(s)) return false;
    const subId = useSameSub ? sameSub : subAssignments[s.id];
    return !subId;
  }).length;

  if (!open) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>
            {instructorObj
              ? `Mark ${instructorObj.full_name.split(" ")[0]} out`
              : "Mark someone out"}
          </h2>
          <button className={styles.closeBtn} onClick={onClose}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className={styles.content}>
          {error && <div className={styles.error}>{error}</div>}

          {/* Who's out + Duration */}
          <div className={styles.topRow}>
            <div className={styles.field}>
              <label>Who&apos;s out?</label>
              <select
                value={selectedInstructor}
                onChange={e => setSelectedInstructor(e.target.value)}
              >
                <option value="">Select instructor...</option>
                {instructorOptions.map(i => (
                  <option key={i.id} value={i.id}>{i.full_name}</option>
                ))}
              </select>
            </div>

          </div>

          {/* Reason */}
          <div className={styles.section}>
            <label>Reason (only admins see this)</label>
            <div className={styles.reasonChips}>
              {REASONS.map(r => (
                <button
                  key={r.value}
                  type="button"
                  className={`${styles.reasonChip} ${reason === r.value ? styles.active : ""}`}
                  onClick={() => setReason(r.value)}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <div className={styles.noteRow}>
              <input
                type="text"
                placeholder="Note (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
                className={styles.noteInput}
              />
              <div className={styles.notifiedField}>
                <label>They told us on</label>
                <input
                  type="date"
                  value={notifiedOn}
                  onChange={e => setNotifiedOn(e.target.value)}
                  max={getTodayString()}
                />
              </div>
            </div>
          </div>

          {/* Date range (several days mode) */}
          {mode === "several_days" && (
            <div className={styles.dateRow}>
              <div className={styles.field}>
                <label>First day out</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
              </div>
              <div className={styles.field}>
                <label>Last day out</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  min={startDate}
                />
              </div>
            </div>
          )}

          {/* Affected sessions */}
          {selectedInstructor && affectedSessions.length > 0 && (
            <div className={styles.sessionsSection}>
              <div className={styles.sessionsHeader}>
                <span>
                  {instructorObj?.full_name?.split(" ")[0] || "They"} {mode === "one_day" ? "has" : "have"}{" "}
                  {affectedSessions.filter(s => !isOffDay(s)).length} class
                  {affectedSessions.filter(s => !isOffDay(s)).length !== 1 ? "es" : ""} in these dates
                </span>
                {mode === "several_days" && affectedSessions.length > 1 && (
                  <div className={styles.sameSubToggle}>
                    <label>
                      <input
                        type="checkbox"
                        checked={useSameSub}
                        onChange={e => setUseSameSub(e.target.checked)}
                      />
                      Same sub for all
                    </label>
                    {useSameSub && (
                      <select
                        value={sameSub}
                        onChange={e => setSameSub(e.target.value)}
                        className={styles.sameSubSelect}
                      >
                        <option value="">Pick sub...</option>
                        {instructorOptions
                          .filter(i => i.id !== selectedInstructor)
                          .map(i => (
                            <option key={i.id} value={i.id}>{i.full_name}</option>
                          ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              <div className={styles.sessionsList}>
                {affectedSessions.map(session => {
                  const isOff = isOffDay(session);
                  const { free, unavailable } = getAvailableSubs(session);
                  const currentSub = useSameSub ? sameSub : subAssignments[session.id];

                  return (
                    <div
                      key={session.id}
                      className={`${styles.sessionCard} ${isOff ? styles.offDay : ""}`}
                    >
                      <div className={styles.sessionInfo}>
                        <span className={styles.sessionDate}>{formatDate(session.date)}</span>
                        <span className={styles.sessionClass}>
                          {session.cls.school?.name} \u00b7 {session.cls.program || "Wellness"} {session.cls.time}
                        </span>
                        {session.coInstructor && (
                          <span className={styles.coTeacher}>
                            with {session.coInstructor.full_name?.split(" ")[0]}
                          </span>
                        )}
                      </div>

                      {isOff ? (
                        <span className={styles.noClassLabel}>No class</span>
                      ) : !useSameSub ? (
                        <select
                          value={currentSub || ""}
                          onChange={e => handleSubChange(session.id, e.target.value)}
                          className={`${styles.subSelect} ${!currentSub ? styles.needsSub : ""}`}
                        >
                          <option value="">
                            {currentSub ? "No sub" : "Needs a sub"}
                          </option>
                          {free.length > 0 && (
                            <optgroup label="Free then">
                              {free.map(({ instructor, sameDistrict }) => (
                                <option key={instructor.id} value={instructor.id}>
                                  {instructor.full_name}
                                  {sameDistrict ? "" : " (different district)"}
                                </option>
                              ))}
                            </optgroup>
                          )}
                          {unavailable.length > 0 && (
                            <optgroup label="Can't sub">
                              {unavailable.map(({ instructor, reason }) => (
                                <option key={instructor.id} value={instructor.id} disabled>
                                  {instructor.full_name} - {reason}
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      ) : (
                        <span className={styles.sameSubNote}>
                          {sameSub
                            ? instructorOptions.find(i => i.id === sameSub)?.full_name
                            : "Using same sub"}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              <p className={styles.saveNote}>
                You can save now and pick the rest later.
              </p>
            </div>
          )}

          {/* Email notification checkbox */}
          {selectedInstructor && affectedSessions.some(s => {
            if (isOffDay(s)) return false;
            const subId = useSameSub ? sameSub : subAssignments[s.id];
            return !!subId;
          }) && (
            <label className={styles.emailCheckbox}>
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={e => setSendEmail(e.target.checked)}
              />
              Email subs about their assignments
            </label>
          )}
        </div>

        <div className={styles.footer}>
          {needsSubCount > 0 && (
            <span className={styles.needsSubWarning}>
              {needsSubCount} class{needsSubCount !== 1 ? "es" : ""} still need{needsSubCount === 1 ? "s" : ""} a sub
            </span>
          )}
          <div className={styles.footerButtons}>
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
              onClick={handleSave}
              disabled={loading || !selectedInstructor}
            >
              {loading ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
