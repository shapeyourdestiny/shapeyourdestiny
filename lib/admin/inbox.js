import { createClient } from "@/lib/supabase/server";

/**
 * Get pending shout-outs for admin review.
 */
export async function getPendingShoutOuts() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("shout_outs")
    .select(`
      id,
      tag,
      message,
      created_at,
      context_class_id,
      context_date,
      fromProfile:from_profile_id (
        id,
        full_name,
        avatar_url
      ),
      toProfile:to_profile_id (
        id,
        full_name,
        avatar_url
      ),
      contextClass:context_class_id (
        id,
        time,
        schools:school_id (
          name
        )
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Error fetching pending shout-outs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get pending time off requests for admin review.
 */
export async function getPendingTimeOffRequests() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("time_off_requests")
    .select(`
      id,
      start_date,
      end_date,
      reason,
      notes,
      created_at,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    // Table might not exist yet
    if (!error.message?.includes("does not exist")) {
      console.error("Error fetching time off requests:", error);
    }
    return [];
  }

  return data || [];
}

/**
 * Get instructor replies to shared notes that admin hasn't marked as done.
 */
export async function getInstructorReplies() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_notes")
    .select(`
      id,
      type,
      title,
      note_date,
      instructor_comment,
      instructor_commented_at,
      acknowledged_at,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .not("instructor_comment", "is", null)
    .is("admin_marked_done_at", null)
    .not("shared_at", "is", null)
    .order("instructor_commented_at", { ascending: true });

  if (error) {
    console.error("Error fetching instructor replies:", error);
    return [];
  }

  return data || [];
}

/**
 * Get admin inbox summary data.
 */
export async function getAdminInbox() {
  const [pendingShoutOuts, pendingTimeOff, instructorReplies] = await Promise.all([
    getPendingShoutOuts(),
    getPendingTimeOffRequests(),
    getInstructorReplies(),
  ]);

  return {
    pendingShoutOuts,
    pendingTimeOff,
    instructorReplies,
    totalPending: pendingShoutOuts.length + pendingTimeOff.length + instructorReplies.length,
  };
}
