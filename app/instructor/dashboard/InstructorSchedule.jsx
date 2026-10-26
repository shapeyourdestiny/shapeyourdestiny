"use client";

import { useState } from "react";
import styles from "./InstructorSchedule.module.css";
import ClassDetailsSheet from "./ClassDetailsSheet";
import { getDirectionsUrl } from "@/lib/maps";

const SHORT_MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/**
 * Format a date string for display.
 * Returns "Today", "Tomorrow", or "Thu, Oct 22"
 */
function formatSessionDate(dateStr) {
  const sessionDate = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const sessionDay = new Date(sessionDate);
  sessionDay.setHours(0, 0, 0, 0);

  if (sessionDay.getTime() === today.getTime()) {
    return "Today";
  }
  if (sessionDay.getTime() === tomorrow.getTime()) {
    return "Tomorrow";
  }

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const dayName = dayNames[sessionDate.getDay()];
  const month = SHORT_MONTHS[sessionDate.getMonth()];
  return `${dayName}, ${month} ${sessionDate.getDate()}`;
}

/**
 * Format time for display (e.g., "3:00 pm")
 */
function formatTime(timeStr) {
  if (!timeStr) return "";
  // Assume timeStr is like "15:00" or "3:00 PM"
  const parts = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!parts) return timeStr;

  let hours = parseInt(parts[1], 10);
  const minutes = parts[2];
  const ampm = parts[3];

  if (ampm) {
    // Already has AM/PM
    return `${hours}:${minutes} ${ampm.toLowerCase()}`;
  }

  // Convert 24h to 12h
  const suffix = hours >= 12 ? "pm" : "am";
  if (hours > 12) hours -= 12;
  if (hours === 0) hours = 12;

  return `${hours}:${minutes} ${suffix}`;
}

/**
 * Format date range display (e.g., "Sep 15 – Nov 19")
 */
function formatDateRange(startDate, endDate) {
  if (!startDate) return "";

  const start = new Date(startDate + "T00:00:00");
  const startMonth = SHORT_MONTHS[start.getMonth()];
  const startStr = `${startMonth} ${start.getDate()}`;

  if (!endDate) {
    return `Started ${startStr} · ongoing`;
  }

  const end = new Date(endDate + "T00:00:00");
  const endMonth = SHORT_MONTHS[end.getMonth()];
  const endStr = `${endMonth} ${end.getDate()}`;

  return `${startStr} – ${endStr}`;
}

/**
 * Format next day off note (e.g., "No class Thu, Nov 12 (Veterans Day)")
 */
function formatDayOffNote(nextDayOff) {
  if (!nextDayOff) return null;

  const start = new Date(nextDayOff.startDate + "T00:00:00");
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  if (nextDayOff.startDate === nextDayOff.endDate) {
    // Single day
    const dayName = dayNames[start.getDay()];
    const month = SHORT_MONTHS[start.getMonth()];
    return `No class ${dayName}, ${month} ${start.getDate()} (${nextDayOff.reason})`;
  }

  // Range
  const end = new Date(nextDayOff.endDate + "T00:00:00");
  const startMonth = SHORT_MONTHS[start.getMonth()];
  const endMonth = SHORT_MONTHS[end.getMonth()];

  const startStr = `${startMonth} ${start.getDate()}`;
  const endStr = `${endMonth} ${end.getDate()}`;

  return `No class ${startStr} – ${endStr} (${nextDayOff.reason})`;
}

export default function InstructorSchedule({ nextSession, classes }) {
  const [selectedClass, setSelectedClass] = useState(null);
  const hasClasses = classes && classes.length > 0;

  // Find the most recent end date among all classes (for empty state)
  const mostRecentEndDate = classes.reduce((latest, cls) => {
    if (cls.endDate && (!latest || cls.endDate > latest)) {
      return cls.endDate;
    }
    return latest;
  }, null);

  const handleClassClick = (cls) => {
    setSelectedClass(cls);
  };

  const handleDirectionsClick = (e) => {
    e.stopPropagation();
  };

  return (
    <div className={styles.schedule}>
      {/* Next Class Card */}
      {nextSession ? (
        <div className={styles.nextCard}>
          <div className={styles.nextHeader}>
            <span className={styles.nextLabel}>Next class</span>
            <span
              className={styles.nextProgram}
              data-program={nextSession.program}
            >
              {nextSession.program === "soccer" ? "Soccer" : "Youth Wellness"}
            </span>
          </div>

          <div className={styles.nextDateTime}>
            {formatSessionDate(nextSession.date)}, {formatTime(nextSession.time)}
          </div>

          <div className={styles.nextSchool}>{nextSession.school.name}</div>

          {nextSession.school.address && (
            <div className={styles.nextAddress}>{nextSession.school.address}</div>
          )}

          {nextSession.coTeacher && (
            <div className={styles.nextCoTeacher}>
              Teaching with {nextSession.coTeacher.name}
            </div>
          )}

          <div className={styles.nextActions}>
            {nextSession.school.address && (
              <a
                href={getDirectionsUrl(nextSession.school.address)}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.directionsBtn}
                aria-label={`Directions to ${nextSession.school.name}`}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polygon points="3 11 22 2 13 21 11 13 3 11" />
                </svg>
                Directions
              </a>
            )}
          </div>
        </div>
      ) : hasClasses ? (
        /* Has classes but no upcoming sessions */
        <div className={styles.emptyNextCard}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <path d="M16 2v4M8 2v4M3 10h18" />
          </svg>
          <p>No upcoming classes</p>
          {mostRecentEndDate && (
            <span>
              Last class ended {formatDateRange(mostRecentEndDate, null).replace("Started ", "").replace(" · ongoing", "")}
            </span>
          )}
        </div>
      ) : null}

      {/* My Classes Section */}
      <div className={styles.classesSection}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionTitle}>My classes</span>
          {hasClasses && (
            <span className={styles.sectionCount}>{classes.length}</span>
          )}
        </div>

        {hasClasses ? (
          <div className={styles.classesList}>
            {classes.map((cls) => (
              <button
                key={cls.id}
                type="button"
                className={styles.classCard}
                onClick={() => handleClassClick(cls)}
                aria-label={`${cls.school.name}, ${cls.program === "soccer" ? "Soccer" : "Youth Wellness"}, details`}
              >
                <div className={styles.classHeader}>
                  <span
                    className={styles.classProgram}
                    data-program={cls.program}
                  >
                    {cls.program === "soccer" ? "Soccer" : "Youth Wellness"}
                  </span>
                  {cls.school.address && (
                    <a
                      href={getDirectionsUrl(cls.school.address)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={styles.classDirections}
                      aria-label={`Directions to ${cls.school.name}`}
                      onClick={handleDirectionsClick}
                    >
                      Directions
                    </a>
                  )}
                </div>

                <div className={styles.classSchool}>{cls.school.name}</div>

                <div className={styles.classSchedule}>
                  {cls.daysDisplay} · {formatTime(cls.time)}
                </div>

                <div className={styles.classDates}>
                  {formatDateRange(cls.startDate, cls.endDate)}
                </div>

                {cls.coTeacher && (
                  <div className={styles.classCoTeacher}>
                    With {cls.coTeacher.name}
                  </div>
                )}

                {/* Progress bar for classes with target sessions */}
                {cls.totalSessions && cls.sessionsDone !== undefined && (
                  <div className={styles.progressSection}>
                    <div className={styles.progressBar}>
                      <div
                        className={styles.progressFill}
                        style={{
                          width: `${Math.min(100, (cls.sessionsDone / cls.totalSessions) * 100)}%`,
                        }}
                      />
                    </div>
                    <div className={styles.progressText}>
                      {cls.sessionsDone} of {cls.totalSessions} sessions done · {cls.totalSessions - cls.sessionsDone} to go
                    </div>
                  </div>
                )}

                {/* Next day off note */}
                {cls.nextDayOff && (
                  <div className={styles.dayOffNote}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="3" y="4" width="18" height="18" rx="2" />
                      <path d="M16 2v4M8 2v4M3 10h18" />
                    </svg>
                    {formatDayOffNote(cls.nextDayOff)}
                  </div>
                )}
              </button>
            ))}
          </div>
        ) : (
          <div className={styles.emptyClassesCard}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="4" width="18" height="18" rx="2" />
              <path d="M16 2v4M8 2v4M3 10h18" />
            </svg>
            <p>No classes yet</p>
            <span>Your classes will show here once you&apos;re assigned.</span>
          </div>
        )}
      </div>

      {/* Class Details Sheet */}
      {selectedClass && (
        <ClassDetailsSheet
          classData={selectedClass}
          onClose={() => setSelectedClass(null)}
        />
      )}
    </div>
  );
}
