"use client";

import styles from "./WeekSummary.module.css";

const TYPE_LABELS = {
  meeting: "Team meeting",
  training: "Team training",
  social: "Team social",
};

/**
 * Week summary strip showing class count, instructor count, absences, team events, and needs-sub count
 *
 * @param {Object} props
 * @param {number} props.classCount - Total classes this week
 * @param {number} props.instructorCount - Unique instructors teaching this week
 * @param {Array} props.absences - Array of { instructor, startDate, endDate, reason, needsSub }
 * @param {number} props.needsSubCount - Number of sessions that need a sub
 * @param {Function} props.onNeedsSubClick - Callback when "needs a sub" chip is clicked
 * @param {Array} props.teamEvents - Array of team events for the week
 * @param {Function} props.onTeamEventClick - Callback when a team event chip is clicked
 */
export default function WeekSummary({
  classCount,
  instructorCount,
  absences = [],
  needsSubCount = 0,
  onNeedsSubClick,
  teamEvents = [],
  onTeamEventClick,
}) {
  // Format date range for absence display
  const formatAbsenceRange = (absence) => {
    if (absence.startDate === absence.endDate) {
      return formatDayShort(absence.startDate);
    }
    return `${formatDayShort(absence.startDate)}-${formatDayShort(absence.endDate)}`;
  };

  // Format a date as short day name (e.g., "Wed")
  const formatDayShort = (dateStr) => {
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-US", { weekday: "short" });
  };

  // Get first name only
  const getFirstName = (fullName) => {
    if (!fullName) return "Someone";
    return fullName.split(" ")[0];
  };

  return (
    <div className={styles.summary}>
      <div className={styles.stats}>
        <span className={styles.statsLabel}>This week</span>
        <span className={styles.statsValue}>
          {classCount} {classCount === 1 ? "class" : "classes"}
        </span>
        <span className={styles.statsDot} />
        <span className={styles.statsValue}>
          {instructorCount} {instructorCount === 1 ? "instructor" : "instructors"}
        </span>
      </div>

      <div className={styles.chips}>
        {absences.map((absence, idx) => (
          <div key={idx} className={styles.absenceChip}>
            <span className={styles.absenceName}>
              {getFirstName(absence.instructor?.full_name)}
            </span>
            <span className={styles.absenceDetails}>
              out {formatAbsenceRange(absence)}
              {absence.reason && ` (${absence.reason.toLowerCase()})`}
            </span>
          </div>
        ))}

        {/* Team event chips */}
        {teamEvents.map((event) => (
          <button
            key={event.id}
            className={styles.teamEventChip}
            onClick={() => onTeamEventClick?.(event)}
          >
            {TYPE_LABELS[event.type] || "Team event"} {formatDayShort(event.event_date)}
          </button>
        ))}

        {needsSubCount > 0 && (
          <button
            className={styles.needsSubChip}
            onClick={onNeedsSubClick}
          >
            {needsSubCount} {needsSubCount === 1 ? "needs a sub" : "need a sub"}
          </button>
        )}
      </div>
    </div>
  );
}
