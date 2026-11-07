"use server";

import { createClient } from "@/lib/supabase/server";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";
import { revalidatePath } from "next/cache";

/**
 * Verify the current user is an admin
 */
async function verifyAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { isAdmin: false, error: "Not authenticated" };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (profileError || !profile) {
    return { isAdmin: false, error: "Profile not found" };
  }

  if (profile.role !== "admin") {
    return { isAdmin: false, error: "Admin access required" };
  }

  return { isAdmin: true, profileId: profile.id };
}

/**
 * Get today's date as YYYY-MM-DD in LA timezone
 */
function getTodayLA() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = laDate.getFullYear();
  const m = String(laDate.getMonth() + 1).padStart(2, "0");
  const d = String(laDate.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Log a new time off request
 */
export async function logTimeOffRequest({
  profileId,
  startDate,
  endDate,
  reason,
  note,
  requestedOn,
}) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Validate required fields
  if (!profileId || !startDate || !endDate || !reason) {
    return { error: "Missing required fields" };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after start date" };
  }

  const validReasons = ["vacation", "sick", "appointment", "personal", "emergency", "other"];
  if (!validReasons.includes(reason)) {
    return { error: "Invalid reason" };
  }

  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      profile_id: profileId,
      start_date: startDate,
      end_date: endDate,
      reason,
      note: note?.trim() || null,
      requested_on: requestedOn || getTodayLA(),
      status: "pending",
      created_by: auth.profileId,
    })
    .select()
    .single();

  if (error) {
    console.error("Error creating time off request:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/instructors");
  return { success: true, data };
}

/**
 * Approve a time off request and create session_changes
 */
export async function approveTimeOffRequest(requestId, options = {}) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Get the request
  const { data: request, error: requestError } = await supabase
    .from("time_off_requests")
    .select("*")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { error: "Request is not pending" };
  }

  // Generate absence group ID
  const absenceGroupId = crypto.randomUUID();

  // Get instructor's class assignments
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        program,
        days,
        time,
        start_date,
        target_sessions,
        schools:school_id (
          id,
          name,
          district_id
        )
      )
    `)
    .eq("profile_id", request.profile_id);

  // Fetch holidays and program off days
  const { data: holidays } = await supabase
    .from("holidays")
    .select("date, name, time_period, district_id, school_id")
    .order("date");

  const { data: programOffDays } = await supabase
    .from("program_off_days")
    .select("date, reason, program")
    .order("date");

  // Build session changes for each affected class
  const sessionChanges = [];
  const skippedSessions = [];

  for (const a of (assignments || [])) {
    const cls = a.classes;
    if (!cls || !cls.start_date || !cls.days) continue;

    const classHolidays = (holidays || [])
      .filter(h => {
        if (h.district_id === null && h.school_id === null) return true;
        if (h.district_id === cls.schools?.district_id && h.school_id === null) return true;
        if (h.school_id === cls.schools?.id) return true;
        return false;
      })
      .map(h => ({ date: h.date, name: h.name, time_period: h.time_period || "all_day" }));

    const classOffDays = (programOffDays || [])
      .filter(od => !od.program || od.program === cls.program)
      .map(od => ({ date: od.date, reason: od.reason }));

    const result = computeClassOccurrences({
      startDate: cls.start_date,
      days: cls.days,
      targetSessions: cls.target_sessions,
      holidays: classHolidays,
      programOffDays: classOffDays,
      classTime: cls.time,
      rangeEnd: null,
    });

    for (const occ of result.occurrences) {
      if (occ.date >= request.start_date && occ.date <= request.end_date) {
        // Check if a session change already exists
        const { data: existing } = await supabase
          .from("session_changes")
          .select("id")
          .eq("class_id", cls.id)
          .eq("session_date", occ.date)
          .eq("slot_type", a.slot_type)
          .single();

        if (existing) {
          skippedSessions.push({
            classId: cls.id,
            date: occ.date,
            schoolName: cls.schools?.name,
            reason: "Already has a session change",
          });
          continue;
        }

        sessionChanges.push({
          class_id: cls.id,
          session_date: occ.date,
          slot_type: a.slot_type,
          absent_profile_id: request.profile_id,
          sub_profile_id: options.subs?.[`${cls.id}-${occ.date}`] || null,
          reason: request.reason,
          note: request.note,
          absence_group_id: absenceGroupId,
          notified_on: request.requested_on,
          time_off_request_id: requestId,
        });
      }
    }
  }

  // Insert session changes
  if (sessionChanges.length > 0) {
    const { error: insertError } = await supabase
      .from("session_changes")
      .insert(sessionChanges);

    if (insertError) {
      console.error("Error creating session changes:", insertError);
      return { error: insertError.message };
    }
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("time_off_requests")
    .update({
      status: "approved",
      decided_by: auth.profileId,
      decided_at: new Date().toISOString(),
      absence_group_id: absenceGroupId,
    })
    .eq("id", requestId);

  if (updateError) {
    console.error("Error updating request status:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/schedule");

  return {
    success: true,
    sessionsCreated: sessionChanges.length,
    sessionsSkipped: skippedSessions,
  };
}

/**
 * Decline a time off request
 */
export async function declineTimeOffRequest(requestId, decisionNote) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Get the request
  const { data: request, error: requestError } = await supabase
    .from("time_off_requests")
    .select("status")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { error: "Request not found" };
  }

  if (request.status !== "pending") {
    return { error: "Request is not pending" };
  }

  const { error: updateError } = await supabase
    .from("time_off_requests")
    .update({
      status: "declined",
      decided_by: auth.profileId,
      decided_at: new Date().toISOString(),
      decision_note: decisionNote?.trim() || null,
    })
    .eq("id", requestId);

  if (updateError) {
    console.error("Error declining request:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/admin/instructors");
  return { success: true };
}

/**
 * Cancel a time off request
 * If approved, removes future session_changes created by it
 */
export async function cancelTimeOffRequest(requestId) {
  const supabase = await createClient();
  const auth = await verifyAdmin(supabase);

  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const today = getTodayLA();

  // Get the request
  const { data: request, error: requestError } = await supabase
    .from("time_off_requests")
    .select("status, absence_group_id")
    .eq("id", requestId)
    .single();

  if (requestError || !request) {
    return { error: "Request not found" };
  }

  if (request.status === "cancelled") {
    return { error: "Request is already cancelled" };
  }

  // If it was approved, delete future session_changes
  let deletedCount = 0;
  if (request.status === "approved" && request.absence_group_id) {
    const { data: deleted, error: deleteError } = await supabase
      .from("session_changes")
      .delete()
      .eq("absence_group_id", request.absence_group_id)
      .gte("session_date", today)
      .select("id");

    if (deleteError) {
      console.error("Error deleting session changes:", deleteError);
      return { error: deleteError.message };
    }

    deletedCount = deleted?.length || 0;
  }

  // Update request status
  const { error: updateError } = await supabase
    .from("time_off_requests")
    .update({
      status: "cancelled",
      decided_by: auth.profileId,
      decided_at: new Date().toISOString(),
    })
    .eq("id", requestId);

  if (updateError) {
    console.error("Error cancelling request:", updateError);
    return { error: updateError.message };
  }

  revalidatePath("/admin/instructors");
  revalidatePath("/admin/schedule");

  return { success: true, sessionsRemoved: deletedCount };
}
