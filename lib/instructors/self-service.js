"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath, revalidateTag } from "next/cache";

/**
 * Get the current instructor's profile
 * @returns {Promise<Object|null>}
 */
export async function getMyProfile() {
  const supabase = await createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  // Try to fetch profile with certification and staff page columns
  let profile;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select(`
      id, full_name, role, status, created_at,
      cpr_expiration, food_handler_expiration,
      display_name, title, bio, headshot_path,
      staff_quote, show_on_staff_page
    `)
    .eq("id", user.id)
    .single();

  // If columns don't exist, fall back to basic query
  const isColumnError = profileError && (
    profileError.message?.includes("column") ||
    profileError.code === "42703"
  );

  if (isColumnError) {
    const { data: basicProfile, error: basicError } = await supabase
      .from("profiles")
      .select("id, full_name, role, status, created_at")
      .eq("id", user.id)
      .single();

    if (basicError) {
      console.error("Error fetching profile:", basicError);
      return null;
    }

    profile = {
      ...basicProfile,
      cpr_expiration: null,
      food_handler_expiration: null,
      display_name: null,
      title: null,
      bio: null,
      headshot_path: null,
      staff_quote: null,
      show_on_staff_page: false,
    };
  } else if (profileError) {
    console.error("Error fetching profile:", profileError);
    return null;
  } else {
    profile = profileData;
  }

  // Generate signed URL for headshot if exists
  const adminClient = createAdminClient();
  let headshotUrl = null;
  if (profile.headshot_path) {
    const { data: signedData } = await adminClient.storage
      .from("staff-headshots")
      .createSignedUrl(profile.headshot_path, 300); // 5 minutes
    headshotUrl = signedData?.signedUrl || null;
  }

  // Get session count (class assignments)
  const { count: sessionCount, error: countError } = await supabase
    .from("class_assignments")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", user.id);

  if (countError) {
    console.error("Error counting sessions:", countError);
  }

  // Get distinct districts
  const { data: instructorDistricts, error: districtError } = await supabase
    .from("instructor_districts")
    .select("district_id")
    .eq("profile_id", user.id);

  if (districtError) {
    console.error("Error fetching districts:", districtError);
  }

  const districtCount = instructorDistricts?.length || 0;

  return {
    ...profile,
    email: user.email,
    sessionCount: sessionCount || 0,
    districtCount,
    headshotUrl,
  };
}

/**
 * Update an instructor's own staff page profile fields
 * @param {string} profileId - The instructor's profile ID
 * @param {Object} updates - The fields to update
 * @returns {{ success: boolean, error?: string }}
 */
export async function updateMyStaffProfile(profileId, updates) {
  const supabase = await createClient();

  // Verify current user is updating their own profile
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" };
  }

  if (user.id !== profileId) {
    return { error: "You can only update your own profile" };
  }

  const allowedFields = ["display_name", "title", "bio", "staff_quote"];

  const updateData = {};
  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      // Convert empty strings to null
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

  revalidatePath("/instructor/profile");
  revalidateTag("staff");

  return { success: true };
}

/**
 * Upload or replace instructor's own headshot
 * @param {string} profileId - The instructor's profile ID
 * @param {FormData} formData - Form data with "headshot" file
 * @returns {{ success: boolean, path?: string, error?: string }}
 */
export async function uploadMyHeadshot(profileId, formData) {
  const supabase = await createClient();

  // Verify current user is updating their own profile
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" };
  }

  if (user.id !== profileId) {
    return { error: "You can only update your own photo" };
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
    return { error: "Failed to save photo" };
  }

  revalidatePath("/instructor/profile");
  revalidateTag("staff");

  return { success: true, path: filename };
}

/**
 * Remove instructor's own headshot
 * @param {string} profileId - The instructor's profile ID
 * @returns {{ success: boolean, error?: string }}
 */
export async function removeMyHeadshot(profileId) {
  const supabase = await createClient();

  // Verify current user is updating their own profile
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized" };
  }

  if (user.id !== profileId) {
    return { error: "You can only update your own photo" };
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
    return { error: "Failed to remove photo" };
  }

  revalidatePath("/instructor/profile");
  revalidateTag("staff");

  return { success: true };
}
