"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Verify the user is an admin.
 */
async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return profile;
}

/**
 * Approve a shout-out.
 */
export async function approveShoutOut(shoutOutId, editedMessage = null) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const updateData = {
    status: "approved",
    reviewed_by: admin.id,
    reviewed_at: new Date().toISOString(),
  };

  if (editedMessage?.trim()) {
    updateData.approved_message = editedMessage.trim();
  }

  const { error } = await supabase
    .from("shout_outs")
    .update(updateData)
    .eq("id", shoutOutId);

  if (error) {
    console.error("Error approving shout-out:", error);
    return { error: "Failed to approve" };
  }

  revalidatePath("/admin/inbox");
  revalidatePath("/instructor/inbox");

  return { success: true };
}

/**
 * Hold back a shout-out (don't show to recipient, sender never knows).
 */
export async function holdShoutOut(shoutOutId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("shout_outs")
    .update({
      status: "held",
      reviewed_by: admin.id,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", shoutOutId);

  if (error) {
    console.error("Error holding shout-out:", error);
    return { error: "Failed to hold" };
  }

  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Mark an instructor reply as done.
 */
export async function markReplyDone(noteId) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("instructor_notes")
    .update({
      admin_marked_done_at: new Date().toISOString(),
      admin_marked_done_by: admin.id,
    })
    .eq("id", noteId);

  if (error) {
    console.error("Error marking reply done:", error);
    return { error: "Failed to mark done" };
  }

  revalidatePath("/admin/inbox");
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Resolve a payroll check issue.
 */
export async function resolvePayrollIssue(issueId, resolutionNote = null) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const updateData = {
    status: "resolved",
    resolved_by: admin.id,
    resolved_at: new Date().toISOString(),
  };

  if (resolutionNote?.trim()) {
    updateData.resolution_note = resolutionNote.trim();
  }

  const { error } = await supabase
    .from("payroll_check_issues")
    .update(updateData)
    .eq("id", issueId);

  if (error) {
    console.error("Error resolving payroll issue:", error);
    return { error: "Failed to resolve" };
  }

  revalidatePath("/admin/inbox");
  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/past");

  return { success: true };
}
