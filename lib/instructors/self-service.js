"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Update an instructor's certification expiration date
 * @param {string} profileId - The instructor's profile ID
 * @param {string} certType - Either 'cpr' or 'food_handler'
 * @param {string|null} expirationDate - The expiration date (YYYY-MM-DD) or null to clear
 * @returns {{ success: boolean, error?: string }}
 */
export async function updateInstructorCertification(profileId, certType, expirationDate) {
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
    return { error: "You can only update your own certifications" };
  }

  // Validate cert type
  if (certType !== "cpr" && certType !== "food_handler") {
    return { error: "Invalid certification type" };
  }

  // Build update data
  const columnName = certType === "cpr" ? "cpr_expiration" : "food_handler_expiration";
  const updateData = {
    [columnName]: expirationDate || null,
  };

  // Update the profile using admin client to bypass RLS
  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from("profiles")
    .update(updateData)
    .eq("id", profileId);

  if (updateError) {
    console.error("Error updating certification:", updateError);
    return { error: "Failed to update certification. Please try again." };
  }

  // Revalidate paths that display this data
  revalidatePath("/instructor/profile");
  revalidatePath(`/admin/instructors/${profileId}`);

  return { success: true };
}

/**
 * Get the current instructor's profile with certifications and stats
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

  // Try to fetch profile with certification columns
  let profile;
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .select("id, full_name, role, status, created_at, cpr_expiration, food_handler_expiration")
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
    };
  } else if (profileError) {
    console.error("Error fetching profile:", profileError);
    return null;
  } else {
    profile = profileData;
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
  };
}
