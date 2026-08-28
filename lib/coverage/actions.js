"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import {
  sendCoverageClaimNotification,
  sendCoverageRequestNotification,
  sendCoverageClaimAdminNotification,
} from "@/lib/email";

/**
 * Get all admin email addresses for notifications
 */
async function getAdminEmails() {
  const adminClient = createAdminClient();

  // Get admin profile IDs
  const { data: admins } = await adminClient
    .from("profiles")
    .select("id")
    .eq("role", "admin");

  if (!admins || admins.length === 0) {
    return [];
  }

  // Get their emails from auth.users
  const emails = [];
  for (const admin of admins) {
    const { data: authUser } = await adminClient.auth.admin.getUserById(admin.id);
    if (authUser?.user?.email) {
      emails.push(authUser.user.email);
    }
  }

  return emails;
}

/**
 * Create a coverage request for a specific session.
 * The instructor is saying "I can't make this session, need coverage."
 */
export async function createCoverageRequest(classId, date, note = null) {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Verify the user is assigned to this class
  const { data: assignment } = await supabase
    .from("class_assignments")
    .select("id")
    .eq("class_id", classId)
    .eq("profile_id", user.id)
    .in("slot_type", ["instructor_1", "instructor_2"])
    .maybeSingle();

  if (!assignment) {
    return { error: "You are not assigned to this class" };
  }

  // Check if a coverage request already exists for this session
  const { data: existing } = await supabase
    .from("coverage_requests")
    .select("id, status")
    .eq("class_id", classId)
    .eq("date", date)
    .in("status", ["open", "claimed"])
    .maybeSingle();

  if (existing) {
    return { error: "A coverage request already exists for this session" };
  }

  // Get class details for the email notification
  const { data: classDetails } = await supabase
    .from("classes")
    .select(`
      time,
      schools:school_id (
        name
      )
    `)
    .eq("id", classId)
    .single();

  // Get requester's profile name
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  // Create the coverage request
  const { data, error } = await supabase
    .from("coverage_requests")
    .insert({
      class_id: classId,
      date,
      requested_by: user.id,
      note: note?.trim() || null,
      status: "open",
    })
    .select("id")
    .single();

  if (error) {
    console.error("Error creating coverage request:", error);
    return { error: "Failed to create coverage request" };
  }

  // Send email notification to admins
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendCoverageRequestNotification({
        requesterName: profile?.full_name || "An instructor",
        schoolName: classDetails?.schools?.name || "Unknown School",
        date,
        time: classDetails?.time || "TBD",
        adminEmails,
      });
    }
  } catch (emailError) {
    // Log but don't fail the request creation
    console.error("Failed to send coverage request notification:", emailError);
  }

  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");
  revalidatePath("/admin/coverage");

  return { success: true, id: data.id };
}

/**
 * Claim a coverage request (atomic operation to prevent race conditions).
 * Uses UPDATE with WHERE status='open' to ensure only one person can claim.
 */
export async function claimCoverageRequest(coverageId) {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get user's profile status
  const { data: profile } = await supabase
    .from("profiles")
    .select("status, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "active") {
    return { error: "Only active instructors can claim coverage" };
  }

  // Get the coverage request details first (for validation and email)
  const { data: coverageRequest, error: fetchError } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      requested_by,
      classes:class_id (
        time,
        schools:school_id (
          name,
          address
        )
      ),
      requester:requested_by (
        id,
        full_name
      )
    `)
    .eq("id", coverageId)
    .single();

  if (fetchError || !coverageRequest) {
    return { error: "Coverage request not found" };
  }

  // Can't claim your own request
  if (coverageRequest.requested_by === user.id) {
    return { error: "You cannot claim your own coverage request" };
  }

  // Already claimed check
  if (coverageRequest.status !== "open") {
    return { error: "This coverage request has already been claimed" };
  }

  // Atomic claim: UPDATE with WHERE status='open'
  // This ensures only one person can claim even with concurrent requests
  const adminClient = createAdminClient();
  const { data: updated, error: updateError } = await adminClient
    .from("coverage_requests")
    .update({
      status: "claimed",
      claimed_by: user.id,
      claimed_at: new Date().toISOString(),
    })
    .eq("id", coverageId)
    .eq("status", "open") // Critical: ensures atomicity
    .select("id")
    .maybeSingle();

  if (updateError) {
    console.error("Error claiming coverage:", updateError);
    return { error: "Failed to claim coverage" };
  }

  if (!updated) {
    // Someone else claimed it between our check and update
    return { error: "This coverage request was just claimed by someone else" };
  }

  // Send email notifications
  const schoolName = coverageRequest.classes?.schools?.name || "Unknown School";
  const sessionTime = coverageRequest.classes?.time || "TBD";
  const requesterName = coverageRequest.requester?.full_name || "Instructor";

  // Get requester's email for notification
  const { data: requesterAuth } = await adminClient.auth.admin.getUserById(
    coverageRequest.requested_by
  );

  // Send notification to requester
  if (requesterAuth?.user?.email) {
    try {
      await sendCoverageClaimNotification({
        to: requesterAuth.user.email,
        requesterName,
        claimerName: profile.full_name,
        schoolName,
        date: coverageRequest.date,
        time: sessionTime,
      });
    } catch (emailError) {
      console.error("Failed to send coverage claim notification to requester:", emailError);
    }
  }

  // Send notification to admins
  try {
    const adminEmails = await getAdminEmails();
    if (adminEmails.length > 0) {
      await sendCoverageClaimAdminNotification({
        requesterName,
        claimerName: profile.full_name,
        schoolName,
        date: coverageRequest.date,
        time: sessionTime,
        adminEmails,
      });
    }
  } catch (emailError) {
    console.error("Failed to send coverage claim notification to admins:", emailError);
  }

  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");
  revalidatePath("/admin/coverage");

  return { success: true };
}

/**
 * Cancel a coverage request (only the requester can cancel).
 */
export async function cancelCoverageRequest(coverageId) {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the coverage request
  const { data: coverageRequest, error: fetchError } = await supabase
    .from("coverage_requests")
    .select("id, requested_by, status")
    .eq("id", coverageId)
    .single();

  if (fetchError || !coverageRequest) {
    return { error: "Coverage request not found" };
  }

  // Only the requester can cancel
  if (coverageRequest.requested_by !== user.id) {
    return { error: "You can only cancel your own coverage requests" };
  }

  // Can't cancel if already claimed
  if (coverageRequest.status === "claimed") {
    return { error: "Cannot cancel a request that has already been claimed. Contact the covering instructor directly." };
  }

  // Update status to cancelled
  const { error: updateError } = await supabase
    .from("coverage_requests")
    .update({ status: "cancelled" })
    .eq("id", coverageId);

  if (updateError) {
    console.error("Error cancelling coverage request:", updateError);
    return { error: "Failed to cancel coverage request" };
  }

  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");

  return { success: true };
}

/**
 * Unclaim a coverage request (only the claimer can unclaim).
 */
export async function unclaimCoverageRequest(coverageId) {
  const supabase = await createClient();

  // Get the current user
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized" };
  }

  // Get the coverage request
  const { data: coverageRequest, error: fetchError } = await supabase
    .from("coverage_requests")
    .select("id, claimed_by, status, date")
    .eq("id", coverageId)
    .single();

  if (fetchError || !coverageRequest) {
    return { error: "Coverage request not found" };
  }

  // Only the claimer can unclaim
  if (coverageRequest.claimed_by !== user.id) {
    return { error: "You can only unclaim coverage you claimed" };
  }

  // Must be claimed
  if (coverageRequest.status !== "claimed") {
    return { error: "This coverage request is not claimed" };
  }

  // Check if it's not too close to the date (at least 24 hours notice)
  const sessionDate = new Date(coverageRequest.date + "T00:00:00");
  const now = new Date();
  const hoursUntil = (sessionDate - now) / (1000 * 60 * 60);

  if (hoursUntil < 24) {
    return { error: "Cannot unclaim within 24 hours of the session. Contact the original instructor directly." };
  }

  // Update status back to open
  const { error: updateError } = await supabase
    .from("coverage_requests")
    .update({
      status: "open",
      claimed_by: null,
      claimed_at: null,
    })
    .eq("id", coverageId);

  if (updateError) {
    console.error("Error unclaiming coverage request:", updateError);
    return { error: "Failed to unclaim coverage request" };
  }

  revalidatePath("/instructor/coverage");
  revalidatePath("/instructor/dashboard");

  return { success: true };
}
