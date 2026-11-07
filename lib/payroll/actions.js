"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { getTodayLA } from "./schedule.js";
import {
  getPeriodSessions,
  getCheckDeadline,
  getOpenPayrollIssues,
} from "./checks.js";
import { getRateForDate } from "./compute.js";
import { createNote } from "@/lib/instructor-notes/actions.js";

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

/**
 * Verify the caller is an admin.
 */
async function verifyAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return null;
  }

  return profile;
}

/**
 * Set whether a line should be paid (Don't pay toggle).
 */
export async function setLinePay(periodId, profileId, classId, sessionDate, pay, reason = null) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Verify period is open
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("id", periodId)
    .single();

  if (!period || period.status !== "open") {
    return { error: "Period is not open" };
  }

  const adminClient = createAdminClient();

  // Upsert the override
  const { error } = await adminClient
    .from("payroll_line_overrides")
    .upsert({
      period_id: periodId,
      profile_id: profileId,
      class_id: classId,
      session_date: sessionDate,
      pay,
      reason: reason?.trim() || null,
    }, {
      onConflict: "period_id,profile_id,class_id,session_date",
    });

  if (error) {
    console.error("Error setting line pay:", error);
    return { error: "Failed to update" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Set a custom class count override for a line.
 */
export async function setLineClasses(periodId, profileId, classId, sessionDate, classesOverride) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Verify period is open
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("id", periodId)
    .single();

  if (!period || period.status !== "open") {
    return { error: "Period is not open" };
  }

  const adminClient = createAdminClient();

  // First get existing override if any
  const { data: existing } = await adminClient
    .from("payroll_line_overrides")
    .select("*")
    .eq("period_id", periodId)
    .eq("profile_id", profileId)
    .eq("class_id", classId)
    .eq("session_date", sessionDate)
    .single();

  // Upsert the override
  const { error } = await adminClient
    .from("payroll_line_overrides")
    .upsert({
      period_id: periodId,
      profile_id: profileId,
      class_id: classId,
      session_date: sessionDate,
      pay: existing?.pay ?? true,
      reason: existing?.reason || null,
      classes_override: classesOverride,
    }, {
      onConflict: "period_id,profile_id,class_id,session_date",
    });

  if (error) {
    console.error("Error setting line classes:", error);
    return { error: "Failed to update" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Add an adjustment for an instructor.
 */
export async function addAdjustment(periodId, profileId, amount, label, note = null) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Verify period is open
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("id", periodId)
    .single();

  if (!period || period.status !== "open") {
    return { error: "Period is not open" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("payroll_adjustments")
    .insert({
      period_id: periodId,
      profile_id: profileId,
      amount: parseFloat(amount),
      label: label.trim(),
      note: note?.trim() || null,
      created_by: admin.id,
    });

  if (error) {
    console.error("Error adding adjustment:", error);
    return { error: "Failed to add adjustment" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Remove an adjustment.
 */
export async function removeAdjustment(adjustmentId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Get the adjustment to verify period is open
  const { data: adj } = await adminClient
    .from("payroll_adjustments")
    .select("period_id")
    .eq("id", adjustmentId)
    .single();

  if (!adj) {
    return { error: "Adjustment not found" };
  }

  const { data: period } = await supabase
    .from("payroll_periods")
    .select("status")
    .eq("id", adj.period_id)
    .single();

  if (!period || period.status !== "open") {
    return { error: "Period is not open" };
  }

  const { error } = await adminClient
    .from("payroll_adjustments")
    .delete()
    .eq("id", adjustmentId);

  if (error) {
    console.error("Error removing adjustment:", error);
    return { error: "Failed to remove adjustment" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Change an instructor's pay rate.
 * This creates a pay note with the effective date.
 */
export async function changeRate(profileId, newRate, effectiveDate, periodStartDate) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Get current rate for the "from" value
  const currentRate = await getRateForDate(supabase, profileId, effectiveDate);

  // Create a pay note through the existing notes system
  const result = await createNote(profileId, {
    type: "pay",
    title: `Pay rate changed to $${parseFloat(newRate).toFixed(2)}`,
    note_date: effectiveDate,
    details: {
      effective_date: effectiveDate,
      rate_from: currentRate,
      rate_to: parseFloat(newRate),
      period_start: periodStartDate,
    },
  });

  if (result.error) {
    return { error: result.error };
  }

  revalidatePath("/admin/payroll");
  revalidatePath(`/admin/instructors/${profileId}`);
  return { success: true };
}

/**
 * Approve a payroll period.
 * Creates a snapshot of all lines and locks the period.
 */
export async function approvePeriod(periodId, skipWarnings = false) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Get the period
  const { data: periodRecord } = await adminClient
    .from("payroll_periods")
    .select("*")
    .eq("id", periodId)
    .single();

  if (!periodRecord) {
    return { error: "Period not found" };
  }

  if (periodRecord.status !== "open") {
    return { error: "Period is not open" };
  }

  const today = getTodayLA();
  const period = {
    startDate: periodRecord.start_date,
    endDate: periodRecord.end_date,
  };

  // Check for instructors with no rate (blocking)
  const { data: instructors } = await adminClient
    .from("profiles")
    .select("id, full_name")
    .eq("role", "instructor")
    .eq("status", "active");

  let hasNoRate = false;
  let noRateInstructor = null;

  for (const instructor of instructors || []) {
    const sessions = await getPeriodSessions(instructor.id, period, today);
    const paidSessions = sessions.filter(
      (s) => s.type === "taught" || s.type === "subbed"
    );

    if (paidSessions.length === 0) continue;

    for (const session of paidSessions) {
      const rate = await getRateForDate(adminClient, instructor.id, session.date);
      if (rate === null) {
        hasNoRate = true;
        noRateInstructor = instructor;
        break;
      }
    }
    if (hasNoRate) break;
  }

  if (hasNoRate) {
    return {
      error: `${noRateInstructor.full_name} has no pay rate set`,
      blockedBy: noRateInstructor.id,
    };
  }

  // Check for open issues (warning, not blocking)
  if (!skipWarnings) {
    const checkDeadline = await getCheckDeadline(period.endDate);
    const isCheckOpen = today <= checkDeadline;

    const openIssues = await getOpenPayrollIssues();
    const periodIssues = openIssues.filter(
      (i) => i.check?.period_start === period.startDate
    );

    if (periodIssues.length > 0 || isCheckOpen) {
      return {
        warning: true,
        openIssues: periodIssues.length,
        checkOpen: isCheckOpen,
      };
    }
  }

  // Get overrides and adjustments
  const { data: overrides } = await adminClient
    .from("payroll_line_overrides")
    .select("*")
    .eq("period_id", periodId);

  const overrideMap = new Map();
  (overrides || []).forEach((o) => {
    const key = `${o.profile_id}|${o.class_id}|${o.session_date}`;
    overrideMap.set(key, o);
  });

  // Build and insert payroll lines
  const lines = [];
  let periodTotal = 0;

  for (const instructor of instructors || []) {
    const sessions = await getPeriodSessions(instructor.id, period, today);

    for (const session of sessions) {
      if (session.type !== "taught" && session.type !== "subbed") continue;

      // Get class hours
      const { data: cls } = await adminClient
        .from("classes")
        .select("hours_per_day")
        .eq("id", session.classId)
        .single();

      const classHours = cls?.hours_per_day || 1;
      const rate = await getRateForDate(adminClient, instructor.id, session.date);

      const overrideKey = `${instructor.id}|${session.classId}|${session.date}`;
      const override = overrideMap.get(overrideKey);

      const classes = override?.classes_override ?? classHours;
      const paid = override?.pay !== false;
      const amount = rate * classes;

      if (paid) {
        periodTotal += amount;
      }

      lines.push({
        period_id: periodId,
        profile_id: instructor.id,
        instructor_name: instructor.full_name,
        class_id: session.classId,
        school_name: session.schoolName,
        program: session.program || "wellness",
        session_date: session.date,
        session_time: session.time,
        slot_type: "instructor",
        classes,
        rate,
        amount,
        paid,
        reason: override?.reason || null,
        source: session.type,
      });
    }
  }

  // Add adjustments to total
  const { data: adjustments } = await adminClient
    .from("payroll_adjustments")
    .select("amount")
    .eq("period_id", periodId);

  const adjTotal = (adjustments || []).reduce(
    (sum, a) => sum + parseFloat(a.amount),
    0
  );
  periodTotal += adjTotal;

  // Insert lines
  if (lines.length > 0) {
    const { error: insertError } = await adminClient
      .from("payroll_lines")
      .insert(lines);

    if (insertError) {
      console.error("Error inserting payroll lines:", insertError);
      return { error: "Failed to create payroll snapshot" };
    }
  }

  // Update period status
  const { error: updateError } = await adminClient
    .from("payroll_periods")
    .update({
      status: "approved",
      approved_at: new Date().toISOString(),
      approved_by: admin.id,
      total: periodTotal,
    })
    .eq("id", periodId);

  if (updateError) {
    console.error("Error updating period status:", updateError);
    return { error: "Failed to approve period" };
  }

  // Log activity
  await adminClient.from("payroll_activity").insert({
    period_id: periodId,
    kind: "approved",
    text: `Payroll approved`,
    actor: admin.full_name,
  });

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Mark a period as paid.
 */
export async function markPaid(periodId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Get the period
  const { data: periodRecord } = await adminClient
    .from("payroll_periods")
    .select("status")
    .eq("id", periodId)
    .single();

  if (!periodRecord) {
    return { error: "Period not found" };
  }

  if (periodRecord.status !== "approved") {
    return { error: "Period must be approved first" };
  }

  // Update status
  const { error } = await adminClient
    .from("payroll_periods")
    .update({
      status: "paid",
      paid_at: new Date().toISOString(),
    })
    .eq("id", periodId);

  if (error) {
    console.error("Error marking period paid:", error);
    return { error: "Failed to mark as paid" };
  }

  // Log activity
  await adminClient.from("payroll_activity").insert({
    period_id: periodId,
    kind: "paid",
    text: "Instructors paid",
    actor: admin.full_name,
  });

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Mark a period as nothing_to_pay.
 */
export async function markNothingToPay(periodId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("payroll_periods")
    .update({
      status: "nothing_to_pay",
      total: 0,
    })
    .eq("id", periodId);

  if (error) {
    console.error("Error marking nothing to pay:", error);
    return { error: "Failed to update" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Save payroll settings.
 */
export async function saveSettings(settings) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  // Validate settings
  if (settings.periodDays && (settings.periodDays < 7 || settings.periodDays > 31)) {
    return { error: "Period must be 7-31 days" };
  }

  // Check for conflicts with approved periods
  if (settings.anchorDate || settings.periodDays) {
    const { data: lastApproved } = await adminClient
      .from("payroll_periods")
      .select("end_date")
      .in("status", ["approved", "paid"])
      .order("end_date", { ascending: false })
      .limit(1);

    if (lastApproved && lastApproved.length > 0) {
      // New anchor must be after last approved period end
      const newAnchor = settings.anchorDate || DEFAULT_SETTINGS.anchorDate;
      if (newAnchor <= lastApproved[0].end_date) {
        return { error: "New anchor date must be after the last approved period" };
      }
    }
  }

  const updateData = {};

  if (settings.anchorDate) updateData.anchor_date = settings.anchorDate;
  if (settings.periodDays) updateData.period_days = settings.periodDays;
  if (settings.dueOffsetDays !== undefined) updateData.due_offset_days = settings.dueOffsetDays;
  if (settings.paydayOffsetDays !== undefined) updateData.payday_offset_days = settings.paydayOffsetDays;
  if (settings.reminderEmails) updateData.reminder_emails = settings.reminderEmails;
  if (settings.reminders) updateData.reminders = settings.reminders;

  const { error } = await adminClient
    .from("payroll_settings")
    .update(updateData)
    .eq("id", 1);

  if (error) {
    console.error("Error saving settings:", error);
    return { error: "Failed to save settings" };
  }

  revalidatePath("/admin/payroll");
  return { success: true };
}

/**
 * Log payroll activity.
 */
export async function logActivity(periodId, kind, text) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient.from("payroll_activity").insert({
    period_id: periodId,
    kind,
    text,
    actor: admin.full_name,
  });

  if (error) {
    console.error("Error logging activity:", error);
  }

  return { success: true };
}

/**
 * Resolve a payroll check issue.
 */
export async function resolveIssue(issueId, resolutionNote = null) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("payroll_check_issues")
    .update({
      status: "resolved",
      resolution_note: resolutionNote?.trim() || null,
      resolved_by: admin.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", issueId);

  if (error) {
    console.error("Error resolving issue:", error);
    return { error: "Failed to resolve issue" };
  }

  revalidatePath("/admin/payroll");
  revalidatePath("/admin/inbox");
  revalidatePath("/instructor/past");

  return { success: true };
}
