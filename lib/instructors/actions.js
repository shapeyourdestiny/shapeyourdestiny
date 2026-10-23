"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";
import { sendProfileInviteEmail } from "@/lib/email/index";

/**
 * Helper to verify caller is admin.
 * Checks by id (legacy schema where profile.id = auth.users.id).
 */
async function verifyAdmin(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", isAdmin: false };
  }

  // Look up profile by id (legacy schema where id = auth user id)
  const { data: callerProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!callerProfile || callerProfile.role !== "admin") {
    return { error: "Forbidden", isAdmin: false };
  }

  return { isAdmin: true, user };
}

/**
 * Update instructor profile information.
 */
export async function updateInstructorAction(profileId, updates) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Build update object with only allowed fields
  const allowedFields = ["phone", "cpr_expires", "food_handler_expires", "full_name"];
  const updateData = {};

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      // Convert empty strings to null for date fields
      if (field.includes("expires") && updates[field] === "") {
        updateData[field] = null;
      } else if (field === "full_name") {
        // Validate full_name is not empty
        const trimmed = (updates[field] || "").trim();
        if (!trimmed) {
          return { error: "Name cannot be empty" };
        }
        updateData[field] = trimmed;
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
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
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
  revalidateTag("staff"); // Update public staff page
  revalidatePath("/our-team");

  return { success: true, status: newStatus };
}

/**
 * Delete an instructor account.
 * Removes all related data including session assignments.
 */
export async function deleteInstructorAction(profileId) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Delete class_assignments (session history)
  await adminClient
    .from("class_assignments")
    .delete()
    .eq("profile_id", profileId);

  // Clear invite_codes references
  await adminClient
    .from("invite_codes")
    .update({ used_by: null })
    .eq("used_by", profileId);

  // Delete invite codes linked to this profile (if profile_id column exists)
  try {
    await adminClient
      .from("invite_codes")
      .delete()
      .eq("profile_id", profileId);
  } catch (e) {
    // profile_id column may not exist - ignore
  }

  // Delete instructor_districts records
  await adminClient
    .from("instructor_districts")
    .delete()
    .eq("profile_id", profileId);

  // Try to delete auth user first (legacy schema where profile.id = auth.users.id)
  // This will cascade delete the profile if FK exists
  const { error: authError } = await adminClient.auth.admin.deleteUser(profileId);

  if (authError) {
    // Auth user doesn't exist or couldn't be deleted - try deleting profile directly
    console.log("Auth user delete failed (may not exist):", authError.message);

    const { error: deleteError } = await adminClient
      .from("profiles")
      .delete()
      .eq("id", profileId);

    if (deleteError) {
      console.error("Error deleting profile:", deleteError);
      return { error: "Failed to delete profile: " + deleteError.message };
    }
  }

  revalidatePath("/admin/instructors");
  revalidateTag("staff"); // Update public staff page
  revalidatePath("/our-team");

  return { success: true };
}

/**
 * Send password reset email to an instructor.
 */
export async function sendPasswordResetAction(profileId) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
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

/**
 * Update an instructor's district assignments.
 * Replaces all existing assignments with the provided list.
 */
export async function updateInstructorDistrictsAction(profileId, districtIds) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  const adminClient = createAdminClient();

  // Delete existing district assignments
  const { error: deleteError } = await adminClient
    .from("instructor_districts")
    .delete()
    .eq("profile_id", profileId);

  if (deleteError) {
    console.error("Error deleting existing districts:", deleteError);
    return { error: "Failed to update districts" };
  }

  // Insert new district assignments
  if (districtIds && districtIds.length > 0) {
    const insertData = districtIds.map((districtId) => ({
      profile_id: profileId,
      district_id: districtId,
    }));

    const { error: insertError } = await adminClient
      .from("instructor_districts")
      .insert(insertData);

    if (insertError) {
      console.error("Error inserting districts:", insertError);
      return { error: "Failed to update districts" };
    }
  }

  revalidatePath(`/admin/instructors/${profileId}`);
  revalidatePath("/admin/instructors");
  revalidatePath("/admin/schedule");

  return { success: true };
}

/**
 * Get all districts for selection.
 */
export async function getDistrictsAction() {
  const supabase = await createClient();

  // Verify caller is authenticated
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Unauthorized", districts: [] };
  }

  const { data: districts, error } = await supabase
    .from("districts")
    .select("id, name, color")
    .order("name");

  if (error) {
    console.error("Error fetching districts:", error);
    return { error: "Failed to fetch districts", districts: [] };
  }

  return { districts: districts || [] };
}

/**
 * Generate invite code in format SYD-XXXX-XXXX
 */
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No I, O, 0, 1 to avoid confusion
  let code = "SYD-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  code += "-";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Create an instructor profile before they have an account.
 * This creates a profile with status 'not_invited' that can be shown on the staff page.
 * Returns the new profile ID.
 */
export async function createUnlinkedInstructorAction({
  fullName,
  displayName,
  title,
  bio,
  staffSection = "instructor",
  showOnStaffPage = true,
}) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Validate required fields
  const trimmedName = (fullName || "").trim();
  if (!trimmedName) {
    return { error: "Name is required" };
  }

  const adminClient = createAdminClient();

  // Create the profile with no user_id (unlinked)
  const { data: newProfile, error: insertError } = await adminClient
    .from("profiles")
    .insert({
      full_name: trimmedName,
      display_name: displayName?.trim() || null,
      title: title?.trim() || null,
      bio: bio?.trim() || null,
      role: "instructor",
      status: "not_invited",
      staff_section: staffSection,
      show_on_staff_page: showOnStaffPage,
      staff_sort_order: 999, // Put at end by default
      user_id: null, // Not linked to any auth user yet
    })
    .select("id")
    .single();

  if (insertError) {
    console.error("Error creating unlinked profile:", insertError);
    return { error: "Failed to create instructor: " + insertError.message };
  }

  revalidatePath("/admin/instructors");
  revalidateTag("staff");
  revalidatePath("/our-team");

  return { success: true, profileId: newProfile.id };
}

/**
 * Send an invite email to an unlinked instructor.
 * Creates an invite code tied to their profile with 30-day expiry.
 */
export async function sendInviteEmailAction(profileId, email) {
  const supabase = await createClient();

  // Verify caller is admin
  const auth = await verifyAdmin(supabase);
  if (!auth.isAdmin) {
    return { error: auth.error };
  }

  // Validate email
  const trimmedEmail = (email || "").trim().toLowerCase();
  if (!trimmedEmail || !trimmedEmail.includes("@")) {
    return { error: "Valid email is required" };
  }

  const adminClient = createAdminClient();

  // Get the profile to verify it exists and is not_invited
  const { data: profile, error: profileError } = await adminClient
    .from("profiles")
    .select("id, full_name, status, user_id")
    .eq("id", profileId)
    .single();

  if (profileError || !profile) {
    return { error: "Profile not found" };
  }

  if (profile.user_id) {
    return { error: "This instructor already has an account" };
  }

  // Check for existing unused invite for this profile
  const { data: existingInvite } = await adminClient
    .from("invite_codes")
    .select("id, code")
    .eq("profile_id", profileId)
    .is("used_by", null)
    .single();

  let inviteCode;

  if (existingInvite) {
    // Reuse existing invite code, update email and expiry
    inviteCode = existingInvite.code;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await adminClient
      .from("invite_codes")
      .update({
        sent_to: trimmedEmail,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      })
      .eq("id", existingInvite.id);
  } else {
    // Create new invite code
    inviteCode = generateInviteCode();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    const { error: inviteError } = await adminClient
      .from("invite_codes")
      .insert({
        code: inviteCode,
        role: "instructor",
        profile_id: profileId,
        sent_to: trimmedEmail,
        sent_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
      });

    if (inviteError) {
      console.error("Error creating invite code:", inviteError);
      return { error: "Failed to create invite code" };
    }
  }

  // Send the email
  try {
    await sendProfileInviteEmail({
      to: trimmedEmail,
      code: inviteCode,
      fullName: profile.full_name,
    });
  } catch (emailError) {
    console.error("Failed to send invite email:", emailError);
    return { error: "Failed to send email: " + emailError.message };
  }

  // Update profile status to 'invited'
  await adminClient
    .from("profiles")
    .update({ status: "invited" })
    .eq("id", profileId);

  revalidatePath("/admin/instructors");

  return { success: true, email: trimmedEmail, code: inviteCode };
}

/**
 * Link an existing profile to a newly created auth user.
 * Called during sign-up when using an invite code tied to a profile.
 */
export async function linkProfileToUserAction(inviteCode, authUserId) {
  const adminClient = createAdminClient();

  // Find the invite code
  const { data: invite, error: inviteError } = await adminClient
    .from("invite_codes")
    .select("id, profile_id, used_by, expires_at")
    .eq("code", inviteCode)
    .single();

  if (inviteError || !invite) {
    return { error: "Invalid invite code" };
  }

  if (invite.used_by) {
    return { error: "Invite code already used" };
  }

  // Check expiry
  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return { error: "Invite code has expired" };
  }

  // If invite has a profile_id, link that profile to this user
  if (invite.profile_id) {
    const { error: linkError } = await adminClient
      .from("profiles")
      .update({
        user_id: authUserId,
        status: "active",
      })
      .eq("id", invite.profile_id);

    if (linkError) {
      console.error("Error linking profile:", linkError);
      return { error: "Failed to link profile" };
    }

    // Mark invite as used
    await adminClient
      .from("invite_codes")
      .update({ used_by: authUserId })
      .eq("id", invite.id);

    revalidateTag("staff");
    revalidatePath("/our-team");

    return { success: true, profileId: invite.profile_id, linked: true };
  }

  // No profile_id - this is a regular invite (old flow)
  // Mark as used, caller will create profile normally
  await adminClient
    .from("invite_codes")
    .update({ used_by: authUserId })
    .eq("id", invite.id);

  return { success: true, linked: false };
}
