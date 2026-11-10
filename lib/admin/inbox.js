import { createClient } from "@/lib/supabase/server";
import {
  getPeriodForDate,
  getTodayLA,
  formatPeriodRangeShort,
  addDays,
} from "@/lib/payroll/schedule.js";
import { getNewApplicationsForInbox } from "@/lib/admin/applications";

/**
 * Get pending shout-outs for admin review.
 */
export async function getPendingShoutOuts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shout_outs")
    .select(`
      id,
      tag,
      message,
      created_at,
      context_class_id,
      context_date,
      fromProfile:from_profile_id (
        id,
        full_name,
        avatar_url
      ),
      toProfile:to_profile_id (
        id,
        full_name,
        avatar_url
      ),
      contextClass:context_class_id (
        id,
        time,
        schools:school_id (
          name
        )
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending shout-outs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get instructor replies to shared notes that admin hasn't marked as done.
 */
export async function getInstructorReplies() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_notes")
    .select(`
      id,
      type,
      title,
      note_date,
      instructor_comment,
      instructor_commented_at,
      acknowledged_at,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .not("instructor_comment", "is", null)
    .is("admin_marked_done_at", null)
    .not("shared_at", "is", null)
    .order("instructor_commented_at", { ascending: true });

  if (error) {
    console.error("Error fetching instructor replies:", error);
    return [];
  }

  return data || [];
}

/**
 * Get open payroll check issues.
 */
export async function getOpenPayrollIssues() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("payroll_check_issues")
    .select(`
      id,
      kind,
      issue_date,
      session_date,
      note,
      created_at,
      school:school_id (id, name),
      check:check_id (
        profile_id,
        period_start,
        period_end,
        profile:profile_id (
          id,
          full_name,
          avatar_url
        )
      )
    `)
    .eq("status", "open")
    .order("created_at", { ascending: true });

  if (error) {
    // Table might not exist yet
    if (!error.message?.includes("does not exist")) {
      console.error("Error fetching payroll issues:", error);
    }
    return [];
  }

  return (data || []).map(issue => ({
    ...issue,
    periodRange: issue.check
      ? formatPeriodRangeShort(issue.check.period_start, issue.check.period_end)
      : null,
  }));
}

/**
 * Get payroll check status for the current period (for status card).
 */
export async function getPayrollCheckStatus() {
  const supabase = await createClient();
  const today = getTodayLA();

  // Default payroll settings
  const settings = {
    anchorDate: "2026-09-05",
    periodDays: 14,
    dueOffsetDays: 7,
    paydayOffsetDays: 14,
  };

  // Get check settings for deadline
  const { data: checkSettings } = await supabase
    .from("payroll_check_settings")
    .select("confirm_offset_days")
    .eq("id", 1)
    .single();

  const confirmOffsetDays = checkSettings?.confirm_offset_days || 3;

  // Get the most recently ended period
  const currentPeriod = getPeriodForDate(today, settings);
  if (!currentPeriod) return null;

  // Check if current period or previous period is in check window
  let checkPeriod = null;
  let deadline = null;

  // First check previous period
  const prevStart = addDays(currentPeriod.startDate, -settings.periodDays);
  const prevPeriod = getPeriodForDate(prevStart, settings);

  if (prevPeriod && prevPeriod.endDate < today) {
    deadline = addDays(prevPeriod.endDate, confirmOffsetDays);
    if (today <= deadline) {
      checkPeriod = prevPeriod;
    }
  }

  if (!checkPeriod) return null;

  // Get all active instructors
  const { data: instructors } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "instructor")
    .eq("status", "active");

  if (!instructors || instructors.length === 0) return null;

  // Get checks for this period
  const { data: checks } = await supabase
    .from("payroll_checks")
    .select(`
      id,
      profile_id,
      status,
      issues:payroll_check_issues (id, status)
    `)
    .eq("period_start", checkPeriod.startDate);

  const checksMap = new Map();
  (checks || []).forEach(c => {
    const openIssues = (c.issues || []).filter(i => i.status === "open").length;
    checksMap.set(c.profile_id, { status: c.status, openIssues });
  });

  // Categorize instructors
  const confirmed = [];
  const flagged = [];
  const noReply = [];
  const noClasses = [];

  for (const instructor of instructors) {
    const check = checksMap.get(instructor.id);

    if (check) {
      if (check.status === "confirmed") {
        confirmed.push(instructor);
      } else if (check.status === "flagged") {
        flagged.push({ ...instructor, openIssues: check.openIssues });
      }
    } else {
      // Check if they have classes assigned
      const { data: assignments } = await supabase
        .from("class_assignments")
        .select("id")
        .eq("profile_id", instructor.id)
        .in("slot_type", ["instructor_1", "instructor_2"])
        .limit(1);

      if (!assignments || assignments.length === 0) {
        noClasses.push(instructor);
      } else {
        noReply.push(instructor);
      }
    }
  }

  // If everyone has no classes, don't show the card
  if (confirmed.length === 0 && flagged.length === 0 && noReply.length === 0) {
    return null;
  }

  return {
    period: checkPeriod,
    periodRange: formatPeriodRangeShort(checkPeriod.startDate, checkPeriod.endDate),
    deadline,
    confirmed,
    flagged,
    noReply,
    noClasses,
  };
}

/**
 * Get class notes that need admin attention for inbox.
 * Returns notes with any star rating ≤2 or needs_supplies=true (last 7 days).
 */
export async function getToughClassNotes() {
  const supabase = await createClient();

  // Get notes from the last 7 days
  const sinceDate = addDays(getTodayLA(), -7);

  const { data, error } = await supabase
    .from("class_notes")
    .select(`
      id,
      session_date,
      overall,
      attention,
      behavior,
      needs_supplies,
      body,
      created_at,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      ),
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .or("overall.lte.2,attention.lte.2,behavior.lte.2,needs_supplies.eq.true")
    .gte("created_at", sinceDate + "T00:00:00")
    .order("created_at", { ascending: false });

  if (error) {
    // Table might not exist yet
    if (!error.message?.includes("does not exist")) {
      console.error("Error fetching class notes needing attention:", error);
    }
    return [];
  }

  return data || [];
}

/**
 * Get admin inbox summary data.
 */
export async function getAdminInbox() {
  const [pendingShoutOuts, instructorReplies, payrollIssues, payrollStatus, newApplications, toughClassNotes] = await Promise.all([
    getPendingShoutOuts(),
    getInstructorReplies(),
    getOpenPayrollIssues(),
    getPayrollCheckStatus(),
    getNewApplicationsForInbox(),
    getToughClassNotes(),
  ]);

  return {
    pendingShoutOuts,
    instructorReplies,
    payrollIssues,
    payrollStatus,
    newApplications,
    toughClassNotes,
    totalPending: pendingShoutOuts.length + instructorReplies.length + payrollIssues.length + newApplications.length + toughClassNotes.length,
  };
}
