"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidateTag, revalidatePath } from "next/cache";

/**
 * Verify the caller is an admin.
 */
async function verifyAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Unauthorized", isAdmin: false };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Forbidden", isAdmin: false };
  }

  return { isAdmin: true, userId: user.id };
}

/**
 * Revalidate all staff-related caches.
 */
function revalidateStaffCaches(profileId) {
  revalidateTag("staff");
  revalidatePath("/our-team");
  if (profileId) {
    revalidatePath(`/admin/instructors/${profileId}`);
  }
  revalidatePath("/admin/instructors");
}

/**
 * Update staff page profile fields.
 */
export async function updateStaffProfileAction(profileId, updates) {
  const { isAdmin, error } = await verifyAdmin();
  if (!isAdmin) {
    return { error };
  }

  const allowedFields = [
    "display_name",
    "title",
    "bio",
    "staff_section",
    "staff_sort_order",
    "show_on_staff_page",
    "staff_quote",
  ];

  const updateData = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      // Convert empty strings to null for optional text fields
      if (typeof updates[field] === "string" && updates[field].trim() === "") {
        updateData[field] = null;
      } else {
        updateData[field] = updates[field];
      }
    }
  }

  // Validate bio length
  if (updateData.bio && updateData.bio.length > 280) {
    return { error: "Bio must be 280 characters or less" };
  }

  // Validate staff_section
  if (updateData.staff_section && !["leadership", "instructor"].includes(updateData.staff_section)) {
    return { error: "Invalid section" };
  }

  if (Object.keys(updateData).length === 0) {
    return { error: "No valid fields to update" };
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("profiles")
    .update(updateData)
    .eq("id", profileId);

  if (updateError) {
    console.error("Error updating staff profile:", updateError);
    return { error: "Failed to update profile" };
  }

  revalidateStaffCaches(profileId);
  return { success: true };
}

/**
 * Upload or replace staff headshot.
 * Accepts a File object (from FormData).
 */
export async function uploadHeadshotAction(profileId, formData) {
  const { isAdmin, error } = await verifyAdmin();
  if (!isAdmin) {
    return { error };
  }

  const file = formData.get("headshot");
  if (!file || !(file instanceof File)) {
    return { error: "No file provided" };
  }

  // Validate file type
  const allowedTypes = ["image/jpeg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    return { error: "File must be JPEG, PNG, or WebP" };
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { error: "File must be under 5MB" };
  }

  const adminClient = createAdminClient();

  // Get current headshot path to delete old file
  const { data: profile } = await adminClient
    .from("profiles")
    .select("headshot_path")
    .eq("id", profileId)
    .single();

  // Delete old headshot if exists
  if (profile?.headshot_path) {
    await adminClient.storage
      .from("staff-headshots")
      .remove([profile.headshot_path]);
  }

  // Generate unique filename
  const ext = file.name.split(".").pop() || "jpg";
  const filename = `${profileId}-${Date.now()}.${ext}`;

  // Upload new file
  const { error: uploadError } = await adminClient.storage
    .from("staff-headshots")
    .upload(filename, file, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    console.error("Error uploading headshot:", uploadError);
    return { error: "Failed to upload image" };
  }

  // Update profile with new path
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ headshot_path: filename })
    .eq("id", profileId);

  if (updateError) {
    console.error("Error updating headshot path:", updateError);
    // Try to clean up uploaded file
    await adminClient.storage.from("staff-headshots").remove([filename]);
    return { error: "Failed to save headshot" };
  }

  revalidateStaffCaches(profileId);
  return { success: true, path: filename };
}

/**
 * Remove staff headshot.
 */
export async function removeHeadshotAction(profileId) {
  const { isAdmin, error } = await verifyAdmin();
  if (!isAdmin) {
    return { error };
  }

  const adminClient = createAdminClient();

  // Get current headshot path
  const { data: profile } = await adminClient
    .from("profiles")
    .select("headshot_path")
    .eq("id", profileId)
    .single();

  if (!profile?.headshot_path) {
    return { success: true }; // Nothing to remove
  }

  // Delete from storage
  await adminClient.storage
    .from("staff-headshots")
    .remove([profile.headshot_path]);

  // Clear path in profile
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ headshot_path: null })
    .eq("id", profileId);

  if (updateError) {
    console.error("Error clearing headshot path:", updateError);
    return { error: "Failed to remove headshot" };
  }

  revalidateStaffCaches(profileId);
  return { success: true };
}

/**
 * Toggle show_on_staff_page for a profile.
 */
export async function toggleStaffVisibilityAction(profileId, visible) {
  const { isAdmin, error } = await verifyAdmin();
  if (!isAdmin) {
    return { error };
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("profiles")
    .update({ show_on_staff_page: visible })
    .eq("id", profileId);

  if (updateError) {
    console.error("Error toggling visibility:", updateError);
    return { error: "Failed to update visibility" };
  }

  revalidateStaffCaches(profileId);
  return { success: true };
}

/**
 * Batch update sort order for multiple staff members.
 * Takes an array of { id, sort_order } objects.
 */
export async function updateStaffSortOrderAction(updates) {
  const { isAdmin, error } = await verifyAdmin();
  if (!isAdmin) {
    return { error };
  }

  if (!Array.isArray(updates) || updates.length === 0) {
    return { error: "No updates provided" };
  }

  const adminClient = createAdminClient();

  // Update each profile's sort order
  for (const { id, sort_order } of updates) {
    const { error: updateError } = await adminClient
      .from("profiles")
      .update({ staff_sort_order: sort_order })
      .eq("id", id);

    if (updateError) {
      console.error("Error updating sort order:", updateError);
      return { error: "Failed to update sort order" };
    }
  }

  revalidateStaffCaches(null);
  return { success: true };
}
