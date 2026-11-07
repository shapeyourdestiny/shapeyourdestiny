"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import crypto from "crypto";

/**
 * Generate a secure random token for calendar feed.
 * Returns base64url-encoded 32 bytes.
 */
function generateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Get the current user's profile ID.
 */
async function getMyProfileId(supabase) {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  // Try user_id lookup first
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (profile) return profile.id;

  // Fall back to id lookup
  const { data: profileById } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();

  return profileById?.id || null;
}

/**
 * Get the calendar feed for the current user.
 */
export async function getMyCalendarFeed() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const { data: feed } = await supabase
    .from("calendar_feeds")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  return { feed };
}

/**
 * Enable calendar sync for the current user.
 * Creates a new feed if one doesn't exist.
 */
export async function enableCalendarSync() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  // Check if feed exists
  const { data: existing } = await supabase
    .from("calendar_feeds")
    .select("*")
    .eq("profile_id", profileId)
    .single();

  if (existing) {
    // Re-enable existing feed
    const { error } = await supabase
      .from("calendar_feeds")
      .update({ enabled: true })
      .eq("profile_id", profileId);

    if (error) {
      console.error("Error enabling calendar feed:", error);
      return { error: "Failed to enable sync" };
    }

    revalidatePath("/instructor/profile");
    return { success: true, token: existing.token };
  }

  // Create new feed
  const token = generateToken();

  const { error } = await supabase.from("calendar_feeds").insert({
    profile_id: profileId,
    token,
    enabled: true,
  });

  if (error) {
    console.error("Error creating calendar feed:", error);
    return { error: "Failed to create feed" };
  }

  revalidatePath("/instructor/profile");
  return { success: true, token };
}

/**
 * Disable calendar sync for the current user.
 */
export async function disableCalendarSync() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("calendar_feeds")
    .update({ enabled: false })
    .eq("profile_id", profileId);

  if (error) {
    console.error("Error disabling calendar feed:", error);
    return { error: "Failed to disable sync" };
  }

  revalidatePath("/instructor/profile");
  return { success: true };
}

/**
 * Reset the calendar feed token.
 * Generates a new token and invalidates the old one.
 */
export async function resetCalendarToken() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const token = generateToken();

  const { error } = await supabase
    .from("calendar_feeds")
    .update({
      token,
      rotated_at: new Date().toISOString(),
    })
    .eq("profile_id", profileId);

  if (error) {
    console.error("Error resetting calendar token:", error);
    return { error: "Failed to reset token" };
  }

  revalidatePath("/instructor/profile");
  return { success: true, token };
}

/**
 * Update the calendar app for the current user's feed.
 */
export async function updateCalendarApp(calendarApp) {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { error: "Not authenticated" };
  }

  const { error } = await supabase
    .from("calendar_feeds")
    .update({ calendar_app: calendarApp })
    .eq("profile_id", profileId);

  if (error) {
    console.error("Error updating calendar app:", error);
    return { error: "Failed to update" };
  }

  revalidatePath("/instructor/profile");
  return { success: true };
}
