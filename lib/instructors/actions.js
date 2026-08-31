"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Update instructor profile information.
 */
export async function updateInstructorAction(profileId, updates) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden" };
  }

  // Build update object with only allowed fields
  const allowedFields = ["phone", "cpr_expires", "food_handler_expires"];
  const updateData = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      // Convert empty strings to null for date fields
      if (field.includes("expires") && updates[field] === "") {
        updateData[field] = null;
      } else {
        updateData[field] = updates[field];
      }
    }
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No valid fields to update" };
  }

  const adminClient = createAdminClient();

  const { error } = await adminClient
    .from("profiles")
    .update(updateData)
    .eq("id", profileId);

  if (error) {
    console.error("Error updating profile:", error);
    return { error: "Failed to update instructor" };
  }

  revalidatePath(`/admin/instructors/${profileId}`);
  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Archive or restore an instructor.
 * Sets the profile status to 'archived' or 'active'.
 */
export async function archiveInstructorAction(profileId, archive = true) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden" };
  }

  // Update status using admin client
  const adminClient = createAdminClient();
  const newStatus = archive ? "archived" : "active";

  // Try updating status column first, fall back to archived if it doesn't exist
  const { error: statusError } = await adminClient
    .from("profiles")
    .update({ status: newStatus })
    .eq("id", profileId);

  // Check if error is about missing column
  const isColumnError = statusError && (
    statusError.message?.includes("status") ||
    statusError.message?.includes("column") ||
    statusError.code === "42703"
  );

  if (isColumnError) {
    // status column doesn't exist, use archived instead
    const { error: archivedError } = await adminClient
      .from("profiles")
      .update({ archived: archive })
      .eq("id", profileId);

    if (archivedError) {
      console.error("Error updating profile status:", archivedError);
      return { error: "Failed to update instructor" };
    }
  } else if (statusError) {
    console.error("Error updating profile status:", statusError);
    return { error: "Failed to update instructor" };
  }

  revalidatePath("/admin/instructors");
  revalidatePath(`/admin/instructors/${profileId}`);

  return { success: true, status: newStatus };
}

/**
 * Delete an instructor account.
 * Only allowed if they have 0 session history.
 * Also clears invite_codes.used_by reference.
 */
export async function deleteInstructorAction(profileId) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden" };
  }

  // Check session count
  const { count, error: countError } = await supabase
    .from("class_assignments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profileId);

  if (countError) {
    console.error("Error checking session count:", countError);
    return { error: "Failed to check session history" };
  }

  if (count > 0) {
    return {
      error: `Cannot delete instructor with ${count} session(s) of history. Use archive instead.`,
    };
  }

  const adminClient = createAdminClient();

  // Clear invite_codes.used_by reference
  const { error: inviteError } = await adminClient
    .from("invite_codes")
    .update({ used_by: null })
    .eq("used_by", profileId);

  if (inviteError) {
    console.error("Error clearing invite code:", inviteError);
    // Continue anyway - not critical
  }

  // Delete auth user (profile will cascade delete due to foreign key)
  const { error: authError } = await adminClient.auth.admin.deleteUser(
    profileId
  );

  if (authError) {
    console.error("Error deleting auth user:", authError);
    return { error: "Failed to delete user: " + authError.message };
  }

  revalidatePath("/admin/instructors");

  return { success: true };
}

/**
 * Send password reset email to an instructor.
 */
export async function sendPasswordResetAction(profileId) {
  const supabase = await createClient();

  // Verify caller is admin
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized" };
  }

  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden" };
  }

  // Get the instructor's email from auth.users
  const adminClient = createAdminClient();
  const { data: authUser, error: authError } =
    await adminClient.auth.admin.getUserById(profileId);

  if (authError || !authUser?.user?.email) {
    console.error("Error fetching user email:", authError);
    return { error: "Could not find user email" };
  }

  const email = authUser.user.email;

  // Send password reset email
  const { error: resetError } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"}/instructor-login/reset-password`,
    }
  );

  if (resetError) {
    console.error("Error sending reset email:", resetError);
    return { error: "Failed to send reset email" };
  }

  return { success: true, email };
}
