"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  getPeriodForDate,
  getTodayLA,
} from "./schedule.js";
import { getCheckDeadline } from "./checks.js";

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

/**
 * Get the current instructor's profile ID.
 */
async function getMyProfileId(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  return profile?.id || null;
}

/**
 * Validate that a period is valid for submitting a check.
 * Must be a real period that has ended and isn't past its deadline.
 */
async function validatePeriod(periodStart, today) {
  const period = getPeriodForDate(periodStart, DEFAULT_SETTINGS);
  if (!period || period.startDate !== periodStart) {
    return { error: "Invalid pay period" };
  }

  // Period must have ended
  if (period.endDate >= today) {
    return { error: "This pay period hasn't ended yet" };
  }

  // Must be before deadline
  const deadline = await getCheckDeadline(period.endDate);
  if (today > deadline) {
    return { error: "The deadline for this pay period has passed" };
  }

  return { period };
}

/**
 * Confirm classes for a pay period ("Looks right").
 */
export async function confirmPayrollCheck(periodStart) {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);
  const today = getTodayLA();

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const validation = await validatePeriod(periodStart, today);
  if (validation.error) {
    return { error: validation.error };
  }

  // Check if already exists
  const { data: existing } = await supabase
    .from("payroll_checks")
    .select("id")
    .eq("profile_id", profileId)
    .eq("period_start", periodStart)
    .single();

  if (existing) {
    return { error: "You've already submitted for this pay period" };
  }

  // Create the check
  const { error } = await supabase.from("payroll_checks").insert({
    profile_id: profileId,
    period_start: periodStart,
    period_end: validation.period.endDate,
    status: "confirmed",
    confirmed_at: new Date().toISOString(),
  });

  if (error) {
    console.error("Error confirming payroll check:", error);
    return { error: "Failed to submit confirmation" };
  }

  revalidatePath("/instructor/past");
  revalidatePath("/instructor/inbox");
  return { success: true };
}

/**
 * Flag an issue with classes for a pay period ("Something's off").
 */
export async function flagPayrollIssue(periodStart, issueData) {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);
  const today = getTodayLA();

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const validation = await validatePeriod(periodStart, today);
  if (validation.error) {
    return { error: validation.error };
  }

  const { kind, issueDate, schoolId, sessionClassId, sessionDate, note } = issueData;

  // Validate required fields
  if (!kind || !["missing", "wrong", "other"].includes(kind)) {
    return { error: "Invalid issue type" };
  }

  if (!note || note.trim().length === 0) {
    return { error: "Please describe the issue" };
  }

  if (note.length > 500) {
    return { error: "Description is too long (max 500 characters)" };
  }

  // Check if check already exists
  let checkId;
  const { data: existing } = await supabase
    .from("payroll_checks")
    .select("id, status")
    .eq("profile_id", profileId)
    .eq("period_start", periodStart)
    .single();

  if (existing) {
    // Can only add issues to flagged checks
    if (existing.status !== "flagged") {
      return { error: "You've already confirmed this pay period" };
    }
    checkId = existing.id;
  } else {
    // Create the check as flagged
    const { data: newCheck, error: checkError } = await supabase
      .from("payroll_checks")
      .insert({
        profile_id: profileId,
        period_start: periodStart,
        period_end: validation.period.endDate,
        status: "flagged",
      })
      .select("id")
      .single();

    if (checkError) {
      console.error("Error creating payroll check:", checkError);
      return { error: "Failed to submit issue" };
    }
    checkId = newCheck.id;
  }

  // Create the issue
  const { error: issueError } = await supabase.from("payroll_check_issues").insert({
    check_id: checkId,
    kind,
    issue_date: issueDate || null,
    school_id: schoolId || null,
    session_class_id: sessionClassId || null,
    session_date: sessionDate || null,
    note: note.trim(),
    status: "open",
  });

  if (issueError) {
    console.error("Error creating payroll issue:", issueError);
    return { error: "Failed to submit issue" };
  }

  revalidatePath("/instructor/past");
  revalidatePath("/instructor/inbox");
  revalidatePath("/admin/inbox");
  return { success: true };
}

/**
 * Resolve a payroll issue (admin only).
 */
export async function resolvePayrollIssue(issueId, resolutionNote = null) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  // Update the issue
  const { error } = await supabase
    .from("payroll_check_issues")
    .update({
      status: "resolved",
      resolution_note: resolutionNote?.trim() || null,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", issueId);

  if (error) {
    console.error("Error resolving payroll issue:", error);
    return { error: "Failed to resolve issue" };
  }

  revalidatePath("/instructor/past");
  revalidatePath("/instructor/inbox");
  revalidatePath("/admin/inbox");
  return { success: true };
}

/**
 * Update payroll check settings (admin only).
 */
export async function updateCheckSettings(settings) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  const { confirmOffsetDays, reminderEnabled } = settings;

  // Validate
  if (confirmOffsetDays < 1 || confirmOffsetDays > 6) {
    return { error: "Deadline must be 1-6 days after period end" };
  }

  const { error } = await supabase
    .from("payroll_check_settings")
    .update({
      confirm_offset_days: confirmOffsetDays,
      reminder_enabled: reminderEnabled,
    })
    .eq("id", 1);

  if (error) {
    console.error("Error updating check settings:", error);
    return { error: "Failed to update settings" };
  }

  revalidatePath("/admin/inbox");
  return { success: true };
}

/**
 * Update period note (admin only).
 */
export async function updatePeriodNote(periodStart, note) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (profile?.role !== "admin") {
    return { error: "Admin access required" };
  }

  if (note && note.length > 200) {
    return { error: "Note is too long (max 200 characters)" };
  }

  const { error } = await supabase
    .from("payroll_period_notes")
    .upsert({
      period_start: periodStart,
      note: note?.trim() || null,
      updated_by: profile.id,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    console.error("Error updating period note:", error);
    return { error: "Failed to update note" };
  }

  revalidatePath("/admin/inbox");
  return { success: true };
}
