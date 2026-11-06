/**
 * Session staff helper for determining instructor status on each class session.
 * Computes who is teaching each class on a given date, accounting for absences and subs.
 */

/**
 * Slot states for instructor positions
 */
export const SlotStatus = {
  NORMAL: "normal", // Regular instructor teaching as usual
  SUB: "sub", // Substitute filling in
  NEEDS_SUB: "needs_sub", // Someone is out but no sub assigned
  ONE_TIME: "one_time", // One-time assignment (sub with no absent instructor)
  EMPTY: "empty", // No one assigned to this slot
};

/**
 * Get the staff state for all class sessions on given dates.
 *
 * @param {Array} classes - Array of class objects with assignments
 * @param {Array} sessionChanges - Array of session_change records
 * @param {string|Array} dates - Single date (YYYY-MM-DD) or array of dates
 * @returns {Map} Map<classId, Map<date, { instructor_1: SlotState, instructor_2: SlotState }>>
 */
export function getSessionStaff(classes, sessionChanges, dates) {
  const dateArray = Array.isArray(dates) ? dates : [dates];
  const result = new Map();

  // Index session changes by class_id + date + slot_type for quick lookup
  const changesIndex = new Map();
  for (const change of sessionChanges) {
    const key = `${change.class_id}|${change.session_date}|${change.slot_type}`;
    changesIndex.set(key, change);
  }

  for (const cls of classes) {
    const classStates = new Map();

    for (const date of dateArray) {
      const slotStates = {
        instructor_1: getSlotState(cls, "instructor_1", date, changesIndex),
        instructor_2: getSlotState(cls, "instructor_2", date, changesIndex),
      };
      classStates.set(date, slotStates);
    }

    result.set(cls.id, classStates);
  }

  return result;
}

/**
 * Get the staff state for a single class session on a given date.
 *
 * @param {Object} cls - Class object with assignments
 * @param {Array} sessionChanges - Array of session_change records
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {{ instructor_1: SlotState, instructor_2: SlotState }}
 */
export function getClassSessionStaff(cls, sessionChanges, date) {
  const changesIndex = new Map();
  for (const change of sessionChanges) {
    if (change.class_id === cls.id && change.session_date === date) {
      const key = `${change.class_id}|${change.session_date}|${change.slot_type}`;
      changesIndex.set(key, change);
    }
  }

  return {
    instructor_1: getSlotState(cls, "instructor_1", date, changesIndex),
    instructor_2: getSlotState(cls, "instructor_2", date, changesIndex),
  };
}

/**
 * Get the state of a single instructor slot for a class on a date.
 *
 * @param {Object} cls - Class object with assignments array
 * @param {string} slotType - 'instructor_1' or 'instructor_2'
 * @param {string} date - Date (YYYY-MM-DD)
 * @param {Map} changesIndex - Map of session changes indexed by key
 * @returns {SlotState}
 */
function getSlotState(cls, slotType, date, changesIndex) {
  const key = `${cls.id}|${date}|${slotType}`;
  const change = changesIndex.get(key);

  // Find the regular assignment for this slot
  const regularAssignment = (cls.assignments || []).find(
    (a) => a.slotType === slotType
  );
  const regularInstructor = regularAssignment?.profile || null;

  // If there's a session change
  if (change) {
    // One-time assignment (no one out, just adding someone for a day)
    if (!change.absent_profile_id && change.sub_profile_id) {
      return {
        status: SlotStatus.ONE_TIME,
        regularInstructor,
        actualInstructor: change.subProfile || null,
        absentInstructor: null,
        reason: change.reason || null,
        sessionChangeId: change.id,
        absenceGroupId: change.absence_group_id,
      };
    }

    // Someone is out with a sub
    if (change.absent_profile_id && change.sub_profile_id) {
      return {
        status: SlotStatus.SUB,
        regularInstructor,
        actualInstructor: change.subProfile || null,
        absentInstructor: change.absentProfile || null,
        reason: change.reason || null,
        sessionChangeId: change.id,
        absenceGroupId: change.absence_group_id,
      };
    }

    // Someone is out, no sub assigned yet
    if (change.absent_profile_id && !change.sub_profile_id) {
      return {
        status: SlotStatus.NEEDS_SUB,
        regularInstructor,
        actualInstructor: null,
        absentInstructor: change.absentProfile || null,
        reason: change.reason || null,
        sessionChangeId: change.id,
        absenceGroupId: change.absence_group_id,
      };
    }
  }

  // No change - use regular assignment
  if (regularInstructor) {
    return {
      status: SlotStatus.NORMAL,
      regularInstructor,
      actualInstructor: regularInstructor,
      absentInstructor: null,
      reason: null,
      sessionChangeId: null,
      absenceGroupId: null,
    };
  }

  // No one assigned
  return {
    status: SlotStatus.EMPTY,
    regularInstructor: null,
    actualInstructor: null,
    absentInstructor: null,
    reason: null,
    sessionChangeId: null,
    absenceGroupId: null,
  };
}

/**
 * Count sessions needing subs in a date range.
 *
 * @param {Array} sessionChanges - Array of session_change records
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {number}
 */
export function countNeedsSub(sessionChanges, startDate, endDate) {
  return sessionChanges.filter(
    (sc) =>
      sc.session_date >= startDate &&
      sc.session_date <= endDate &&
      sc.absent_profile_id &&
      !sc.sub_profile_id
  ).length;
}

/**
 * Get all absences for a date range grouped by instructor.
 *
 * @param {Array} sessionChanges - Array of session_change records
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 * @returns {Array} Array of { instructor, startDate, endDate, reason, needsSub }
 */
export function getAbsencesInRange(sessionChanges, startDate, endDate) {
  // Filter to date range and group by absence_group_id or individual changes
  const grouped = new Map();

  for (const sc of sessionChanges) {
    if (
      sc.session_date < startDate ||
      sc.session_date > endDate ||
      !sc.absent_profile_id
    ) {
      continue;
    }

    const groupKey = sc.absence_group_id || sc.id;

    if (!grouped.has(groupKey)) {
      grouped.set(groupKey, {
        instructor: sc.absentProfile,
        startDate: sc.session_date,
        endDate: sc.session_date,
        reason: sc.reason,
        needsSub: !sc.sub_profile_id,
        count: 1,
      });
    } else {
      const entry = grouped.get(groupKey);
      if (sc.session_date < entry.startDate) entry.startDate = sc.session_date;
      if (sc.session_date > entry.endDate) entry.endDate = sc.session_date;
      if (!sc.sub_profile_id) entry.needsSub = true;
      entry.count++;
    }
  }

  return Array.from(grouped.values());
}
