/**
 * Payroll Computation
 * ===================
 * Builds payroll views from getPeriodSessions as the single source of truth.
 *
 * Key rules:
 * - `taught` and `subbed` sessions are paid lines
 * - `off` sessions: the absent person isn't paid, their sub gets the line
 * - `holiday` sessions: not paid
 * - `upcoming` sessions: shown as "Coming up" with muted amount, not in total
 * - Only `instructor_1` and `instructor_2` slots are paid
 * - Session pay = hours_per_day × rate
 * - Rate comes from pay notes (details.effective_date) or instructor_pay_rates
 */

import { createClient } from "@/lib/supabase/server";
import {
  getPeriodForDate,
  getTodayLA,
  formatPeriodRangeShort,
} from "./schedule.js";
import { getPeriodSessions, getCheckStatus, getCheckDeadline } from "./checks.js";

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

/**
 * Get payroll settings from database.
 */
export async function getPayrollSettings() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("payroll_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (!data) {
    return DEFAULT_SETTINGS;
  }

  return {
    anchorDate: data.anchor_date,
    periodDays: data.period_days,
    dueOffsetDays: data.due_offset_days,
    paydayOffsetDays: data.payday_offset_days,
    reminderEmails: data.reminder_emails || [],
    reminders: data.reminders || {},
  };
}

/**
 * Get the rate for an instructor on a given date.
 * Uses pay notes first (by effective_date), then falls back to instructor_pay_rates.
 */
export async function getRateForDate(supabase, profileId, date) {
  // First try to find a pay note with effective_date on or before this date
  const { data: payNote } = await supabase
    .from("instructor_notes")
    .select("details")
    .eq("profile_id", profileId)
    .eq("type", "pay")
    .is("archived_at", null)
    .lte("details->effective_date", date)
    .order("details->effective_date", { ascending: false })
    .limit(1)
    .single();

  if (payNote?.details?.rate_to !== undefined) {
    return parseFloat(payNote.details.rate_to);
  }

  // Fall back to instructor_pay_rates
  const { data: payRate } = await supabase
    .from("instructor_pay_rates")
    .select("rate_per_class")
    .eq("profile_id", profileId)
    .single();

  if (payRate?.rate_per_class !== undefined) {
    return parseFloat(payRate.rate_per_class);
  }

  return null; // No rate set
}

/**
 * Get hours_per_day for a class.
 */
async function getClassHours(supabase, classId) {
  const { data } = await supabase
    .from("classes")
    .select("hours_per_day")
    .eq("id", classId)
    .single();

  return data?.hours_per_day || 1;
}

/**
 * Get the payroll period record from the database, creating if needed.
 */
export async function getOrCreatePeriodRecord(period) {
  const supabase = await createClient();

  // Try to find existing
  const { data: existing } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("start_date", period.startDate)
    .single();

  if (existing) {
    return existing;
  }

  // Create new period record
  const { data: created, error } = await supabase
    .from("payroll_periods")
    .insert({
      start_date: period.startDate,
      end_date: period.endDate,
      due_date: period.dueDate,
      payday: period.payday,
      status: "open",
      total: 0,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating period record:", error);
    return null;
  }

  return created;
}

/**
 * Build the payroll view for a period.
 * For open periods: computed live from getPeriodSessions
 * For approved/paid periods: read from snapshot
 */
export async function getPeriodView(period, today = null) {
  if (!today) {
    today = getTodayLA();
  }

  const supabase = await createClient();

  // Get or create period record
  const periodRecord = await getOrCreatePeriodRecord(period);
  if (!periodRecord) {
    return { error: "Failed to get period record" };
  }

  // If approved or paid, read from snapshot
  if (periodRecord.status === "approved" || periodRecord.status === "paid") {
    return await getApprovedPeriodView(supabase, periodRecord);
  }

  // For open or nothing_to_pay periods, compute live
  return await computeLivePeriodView(supabase, period, periodRecord, today);
}

/**
 * Read approved period data from payroll_lines snapshot.
 */
async function getApprovedPeriodView(supabase, periodRecord) {
  // Get all lines for this period
  const { data: lines } = await supabase
    .from("payroll_lines")
    .select("*")
    .eq("period_id", periodRecord.id)
    .order("session_date");

  // Get adjustments
  const { data: adjustments } = await supabase
    .from("payroll_adjustments")
    .select("*")
    .eq("period_id", periodRecord.id);

  // Get activity log
  const { data: activity } = await supabase
    .from("payroll_activity")
    .select("*")
    .eq("period_id", periodRecord.id)
    .order("created_at", { ascending: false });

  // Group lines by instructor
  const instructorMap = new Map();

  (lines || []).forEach((line) => {
    if (!instructorMap.has(line.profile_id)) {
      instructorMap.set(line.profile_id, {
        profileId: line.profile_id,
        fullName: line.instructor_name,
        avatarUrl: null,
        lines: [],
        adjustments: [],
        totalClasses: 0,
        totalAmount: 0,
        rates: new Set(),
        needsReview: false,
        checkStatus: null,
      });
    }

    const instructor = instructorMap.get(line.profile_id);
    instructor.lines.push(line);

    if (line.paid) {
      instructor.totalClasses += parseFloat(line.classes) || 1;
      instructor.totalAmount += parseFloat(line.amount) || 0;
    }

    if (line.rate) {
      instructor.rates.add(parseFloat(line.rate));
    }
  });

  // Add adjustments
  (adjustments || []).forEach((adj) => {
    const instructor = instructorMap.get(adj.profile_id);
    if (instructor) {
      instructor.adjustments.push(adj);
      instructor.totalAmount += parseFloat(adj.amount) || 0;
    }
  });

  // Convert to array and calculate totals
  const instructors = Array.from(instructorMap.values()).map((i) => ({
    ...i,
    rates: Array.from(i.rates),
  }));

  const periodTotal = instructors.reduce((sum, i) => sum + i.totalAmount, 0);

  return {
    period: {
      id: periodRecord.id,
      startDate: periodRecord.start_date,
      endDate: periodRecord.end_date,
      dueDate: periodRecord.due_date,
      payday: periodRecord.payday,
      status: periodRecord.status,
      approvedAt: periodRecord.approved_at,
      paidAt: periodRecord.paid_at,
      total: periodTotal,
    },
    instructors,
    activity: activity || [],
    isSnapshot: true,
  };
}

/**
 * Compute live period view from getPeriodSessions.
 */
async function computeLivePeriodView(supabase, period, periodRecord, today) {
  // Get all active instructors
  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "instructor")
    .eq("is_active", true)
    .order("full_name");

  if (!instructors || instructors.length === 0) {
    return {
      period: formatPeriodInfo(periodRecord),
      instructors: [],
      activity: [],
      isSnapshot: false,
      noClassesCount: 0,
      checkDeadline: await getCheckDeadline(period.endDate),
    };
  }

  // Get check statuses for all instructors
  const checkStatuses = await getCheckStatus(period, today);
  const checkMap = new Map(checkStatuses.map((c) => [c.profileId, c]));

  // Get overrides for this period
  const { data: overrides } = await supabase
    .from("payroll_line_overrides")
    .select("*")
    .eq("period_id", periodRecord.id);

  const overrideMap = new Map();
  (overrides || []).forEach((o) => {
    const key = `${o.profile_id}|${o.class_id}|${o.session_date}`;
    overrideMap.set(key, o);
  });

  // Get adjustments
  const { data: adjustments } = await supabase
    .from("payroll_adjustments")
    .select("*")
    .eq("period_id", periodRecord.id);

  const adjustmentMap = new Map();
  (adjustments || []).forEach((adj) => {
    if (!adjustmentMap.has(adj.profile_id)) {
      adjustmentMap.set(adj.profile_id, []);
    }
    adjustmentMap.get(adj.profile_id).push(adj);
  });

  // Get activity log
  const { data: activity } = await supabase
    .from("payroll_activity")
    .select("*")
    .eq("period_id", periodRecord.id)
    .order("created_at", { ascending: false });

  // Build instructor data
  const instructorData = [];
  let noClassesCount = 0;
  let anyoneHasWork = false;

  for (const instructor of instructors) {
    const sessions = await getPeriodSessions(instructor.id, period, today);

    // Filter to paid session types
    const paidSessions = sessions.filter(
      (s) => s.type === "taught" || s.type === "subbed"
    );
    const upcomingSessions = sessions.filter((s) => s.type === "upcoming");

    // Skip instructors with no classes
    if (paidSessions.length === 0 && upcomingSessions.length === 0) {
      noClassesCount++;
      continue;
    }

    anyoneHasWork = true;

    // Build lines for each paid session
    const lines = [];
    const rates = new Set();
    let totalClasses = 0;
    let totalAmount = 0;
    let hasNoRate = false;
    let hasOverride = false;

    for (const session of paidSessions) {
      const classHours = await getClassHours(supabase, session.classId);
      const rate = await getRateForDate(supabase, instructor.id, session.date);

      // Check for override
      const overrideKey = `${instructor.id}|${session.classId}|${session.date}`;
      const override = overrideMap.get(overrideKey);

      const classes = override?.classes_override ?? classHours;
      const paid = override?.pay !== false;
      const amount = rate !== null ? classes * rate : null;

      if (rate !== null) {
        rates.add(rate);
      } else {
        hasNoRate = true;
      }

      if (override) {
        hasOverride = true;
      }

      if (paid && amount !== null) {
        totalClasses += classes;
        totalAmount += amount;
      }

      lines.push({
        id: session.id,
        classId: session.classId,
        date: session.date,
        schoolName: session.schoolName,
        program: session.program,
        time: session.time,
        source: session.type, // 'taught' or 'subbed'
        classes,
        rate,
        amount,
        paid,
        reason: override?.reason || null,
        isUpcoming: false,
        coTeacher: session.coTeacher,
        coveredFor: session.coveredFor,
      });
    }

    // Add upcoming sessions (muted, not counted in total)
    for (const session of upcomingSessions) {
      const classHours = await getClassHours(supabase, session.classId);
      const rate = await getRateForDate(supabase, instructor.id, session.date);

      lines.push({
        id: session.id,
        classId: session.classId,
        date: session.date,
        schoolName: session.schoolName,
        program: session.program,
        time: session.time,
        source: "upcoming",
        classes: classHours,
        rate,
        amount: rate !== null ? classHours * rate : null,
        paid: true,
        reason: null,
        isUpcoming: true,
        coTeacher: session.coTeacher,
      });
    }

    // Get instructor's adjustments
    const instructorAdj = adjustmentMap.get(instructor.id) || [];
    const adjTotal = instructorAdj.reduce(
      (sum, a) => sum + parseFloat(a.amount),
      0
    );

    // Check status
    const checkInfo = checkMap.get(instructor.id);
    const hasOpenIssues = checkInfo?.issueCount > 0;

    // Determine if needs review
    const needsReview =
      hasNoRate ||
      hasOverride ||
      instructorAdj.length > 0 ||
      (checkInfo?.status === "flagged" && hasOpenIssues);

    instructorData.push({
      profileId: instructor.id,
      fullName: instructor.full_name,
      avatarUrl: instructor.avatar_url,
      lines,
      adjustments: instructorAdj,
      totalClasses,
      totalAmount: totalAmount + adjTotal,
      rates: Array.from(rates),
      needsReview,
      hasNoRate,
      checkStatus: checkInfo?.status || null,
      issueCount: checkInfo?.issueCount || 0,
    });
  }

  // Calculate period total
  const periodTotal = instructorData.reduce((sum, i) => sum + i.totalAmount, 0);

  // Get check deadline
  const checkDeadline = await getCheckDeadline(period.endDate);
  const isCheckOpen = period.endDate < today && today <= checkDeadline;

  // Check counts for banner
  const checkCounts = {
    confirmed: checkStatuses.filter((c) => c.status === "confirmed").length,
    flagged: checkStatuses.filter((c) => c.status === "flagged").length,
    noReply: checkStatuses.filter((c) => c.status === "no_reply").length,
  };

  return {
    period: {
      ...formatPeriodInfo(periodRecord),
      total: periodTotal,
    },
    instructors: instructorData,
    activity: activity || [],
    isSnapshot: false,
    noClassesCount,
    anyoneHasWork,
    checkDeadline,
    isCheckOpen,
    checkCounts,
  };
}

/**
 * Format period record into a consistent shape.
 */
function formatPeriodInfo(record) {
  return {
    id: record.id,
    startDate: record.start_date,
    endDate: record.end_date,
    dueDate: record.due_date,
    payday: record.payday,
    status: record.status,
    approvedAt: record.approved_at,
    paidAt: record.paid_at,
    total: parseFloat(record.total) || 0,
  };
}

/**
 * Get payroll history (list of past periods).
 */
export async function getPayrollHistory(limit = 20) {
  const supabase = await createClient();
  const today = getTodayLA();

  // Get periods from database
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("*")
    .lt("end_date", today)
    .order("start_date", { ascending: false })
    .limit(limit);

  if (!periods || periods.length === 0) {
    return [];
  }

  return periods.map((p) => ({
    id: p.id,
    startDate: p.start_date,
    endDate: p.end_date,
    dueDate: p.due_date,
    payday: p.payday,
    status: p.status,
    total: parseFloat(p.total) || 0,
    approvedAt: p.approved_at,
    paidAt: p.paid_at,
    range: formatPeriodRangeShort(p.start_date, p.end_date),
  }));
}

/**
 * Get the period that should be displayed when opening the payroll page.
 *
 * Priority:
 * 1. Oldest ended period that isn't approved (ignoring nothing_to_pay)
 * 2. The current (in-progress) period
 */
export async function getDefaultPeriod() {
  const supabase = await createClient();
  const today = getTodayLA();
  const settings = await getPayrollSettings();

  // Find oldest ended period that needs approval
  const { data: needsApproval } = await supabase
    .from("payroll_periods")
    .select("*")
    .lt("end_date", today)
    .eq("status", "open")
    .order("start_date", { ascending: true })
    .limit(1);

  if (needsApproval && needsApproval.length > 0) {
    // Count how many need approval
    const { count } = await supabase
      .from("payroll_periods")
      .select("*", { count: "exact", head: true })
      .lt("end_date", today)
      .eq("status", "open");

    const period = needsApproval[0];
    return {
      period: getPeriodForDate(period.start_date, settings),
      periodsNeedingApproval: count || 1,
    };
  }

  // No periods need approval - show current period
  const currentPeriod = getPeriodForDate(today, settings);
  return {
    period: currentPeriod,
    periodsNeedingApproval: 0,
  };
}

/**
 * Get instructor detail for the drawer view.
 */
export async function getInstructorPayDetail(profileId, periodStartDate) {
  const supabase = await createClient();
  const settings = await getPayrollSettings();
  const today = getTodayLA();

  const period = getPeriodForDate(periodStartDate, settings);
  if (!period) {
    return { error: "Invalid period" };
  }

  // Get period record
  const { data: periodRecord } = await supabase
    .from("payroll_periods")
    .select("*")
    .eq("start_date", period.startDate)
    .single();

  if (!periodRecord) {
    return { error: "Period not found" };
  }

  // Get instructor profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("id", profileId)
    .single();

  if (!profile) {
    return { error: "Instructor not found" };
  }

  // For approved/paid periods, read from snapshot
  if (periodRecord.status === "approved" || periodRecord.status === "paid") {
    const { data: lines } = await supabase
      .from("payroll_lines")
      .select("*")
      .eq("period_id", periodRecord.id)
      .eq("profile_id", profileId)
      .order("session_date");

    const { data: adjustments } = await supabase
      .from("payroll_adjustments")
      .select("*")
      .eq("period_id", periodRecord.id)
      .eq("profile_id", profileId);

    return {
      profile,
      period: formatPeriodInfo(periodRecord),
      lines: lines || [],
      adjustments: adjustments || [],
      isSnapshot: true,
    };
  }

  // For open periods, compute live
  const sessions = await getPeriodSessions(profileId, period, today);

  // Get overrides
  const { data: overrides } = await supabase
    .from("payroll_line_overrides")
    .select("*")
    .eq("period_id", periodRecord.id)
    .eq("profile_id", profileId);

  const overrideMap = new Map();
  (overrides || []).forEach((o) => {
    const key = `${o.class_id}|${o.session_date}`;
    overrideMap.set(key, o);
  });

  // Get adjustments
  const { data: adjustments } = await supabase
    .from("payroll_adjustments")
    .select("*")
    .eq("period_id", periodRecord.id)
    .eq("profile_id", profileId);

  // Get open issues
  const { data: issues } = await supabase
    .from("payroll_check_issues")
    .select(`
      *,
      school:school_id (name)
    `)
    .eq("status", "open")
    .in("check_id",
      supabase
        .from("payroll_checks")
        .select("id")
        .eq("profile_id", profileId)
        .eq("period_start", period.startDate)
    );

  // Build lines
  const lines = [];

  for (const session of sessions) {
    if (session.type !== "taught" && session.type !== "subbed" && session.type !== "upcoming") {
      continue;
    }

    const classHours = await getClassHours(supabase, session.classId);
    const rate = await getRateForDate(supabase, profileId, session.date);

    const overrideKey = `${session.classId}|${session.date}`;
    const override = overrideMap.get(overrideKey);

    const classes = override?.classes_override ?? classHours;
    const paid = override?.pay !== false;

    lines.push({
      id: session.id,
      classId: session.classId,
      date: session.date,
      schoolName: session.schoolName,
      program: session.program,
      time: session.time,
      source: session.type,
      classes,
      rate,
      amount: rate !== null ? classes * rate : null,
      paid,
      reason: override?.reason || null,
      isUpcoming: session.type === "upcoming",
      coTeacher: session.coTeacher,
      coveredFor: session.coveredFor,
    });
  }

  // Get current rate
  const currentRate = await getRateForDate(supabase, profileId, today);

  // Get pay note history
  const { data: payNotes } = await supabase
    .from("instructor_notes")
    .select("id, note_date, details")
    .eq("profile_id", profileId)
    .eq("type", "pay")
    .is("archived_at", null)
    .order("note_date", { ascending: false })
    .limit(5);

  return {
    profile,
    period: formatPeriodInfo(periodRecord),
    lines,
    adjustments: adjustments || [],
    issues: issues || [],
    currentRate,
    payNotes: payNotes || [],
    isSnapshot: false,
  };
}

/**
 * Count periods that need approval (for sidebar badge).
 */
export async function getPeriodsNeedingApprovalCount() {
  const supabase = await createClient();
  const today = getTodayLA();

  const { count, error } = await supabase
    .from("payroll_periods")
    .select("*", { count: "exact", head: true })
    .lt("end_date", today)
    .eq("status", "open");

  if (error) {
    return 0;
  }

  return count || 0;
}

/**
 * Check if any instructor has no rate set.
 * Used to determine if approval should be blocked.
 */
export async function checkForMissingRates(period) {
  const supabase = await createClient();
  const today = getTodayLA();

  // Get all active instructors
  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("role", "instructor")
    .eq("is_active", true);

  if (!instructors) return { hasMissing: false };

  for (const instructor of instructors) {
    const sessions = await getPeriodSessions(instructor.id, period, today);
    const hasPaidWork = sessions.some(
      (s) => s.type === "taught" || s.type === "subbed"
    );

    if (!hasPaidWork) continue;

    // Check each session for a rate
    for (const session of sessions) {
      if (session.type !== "taught" && session.type !== "subbed") continue;

      const rate = await getRateForDate(supabase, instructor.id, session.date);
      if (rate === null) {
        return {
          hasMissing: true,
          instructor: { id: instructor.id, name: instructor.full_name },
        };
      }
    }
  }

  return { hasMissing: false };
}
