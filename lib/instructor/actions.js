"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

/**
 * Mark a shared note as viewed.
 * Calls the SECURITY DEFINER function mark_shared_note_viewed().
 */
export async function markNoteViewed(noteId) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("mark_shared_note_viewed", {
    p_note_id: noteId,
  });

  if (error) {
    console.error("Error marking note viewed:", error);
    return { error: "Failed to mark as viewed" };
  }

  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/profile");

  return { success: true };
}

/**
 * Acknowledge a shared note with optional comment.
 * Calls the SECURITY DEFINER function acknowledge_shared_note().
 */
export async function acknowledgeNote(noteId, comment = null) {
  const supabase = await createClient();

  const { error } = await supabase.rpc("acknowledge_shared_note", {
    p_note_id: noteId,
    p_comment: comment?.trim() || null,
  });

  if (error) {
    console.error("Error acknowledging note:", error);
    return { error: "Failed to acknowledge" };
  }

  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/profile");
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Mark an inbox item as read.
 */
export async function markInboxRead(itemType, itemId) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  const { error } = await supabase
    .from("inbox_reads")
    .upsert({
      profile_id: profile.id,
      item_type: itemType,
      item_id: itemId,
      read_at: new Date().toISOString(),
    }, {
      onConflict: "profile_id,item_type,item_id",
    });

  if (error) {
    console.error("Error marking inbox read:", error);
    return { error: "Failed to mark as read" };
  }

  revalidatePath("/instructor/inbox");

  return { success: true };
}

/**
 * Mark all inbox items as read for a tab or all tabs.
 * @param {string} tab - "updates", "shoutouts", or "all" (marks both tabs)
 */
export async function markAllRead(tab) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Get inbox data to know what to mark read
  const { getInstructorInbox } = await import("./inbox");
  const inbox = await getInstructorInbox();

  // Get items to mark based on tab
  let items = [];
  if (tab === "all") {
    items = [...inbox.updates, ...inbox.shoutOuts];
  } else if (tab === "updates") {
    items = inbox.updates;
  } else {
    items = inbox.shoutOuts;
  }

  const toMark = items
    .filter((item) => !item.isRead && !item.needsYou)
    .map((item) => {
      const [type, id] = item.id.split(":");
      return { profile_id: profile.id, item_type: type, item_id: id, read_at: new Date().toISOString() };
    });

  if (toMark.length === 0) {
    return { success: true };
  }

  const { error } = await supabase
    .from("inbox_reads")
    .upsert(toMark, { onConflict: "profile_id,item_type,item_id" });

  if (error) {
    console.error("Error marking all read:", error);
    return { error: "Failed to mark all as read" };
  }

  revalidatePath("/instructor/inbox");

  return { success: true, count: toMark.length };
}

/**
 * Get list of active instructors (excluding self) for shout-out recipient selection.
 */
export async function getTeammates() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!myProfile) {
    return { error: "Profile not found" };
  }

  const { data: teammates, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .eq("role", "instructor")
    .eq("status", "active")
    .neq("id", myProfile.id)
    .order("full_name");

  if (error) {
    console.error("Error fetching teammates:", error);
    return { error: "Failed to load teammates" };
  }

  return { teammates: teammates || [] };
}

/**
 * Send a shout-out to a teammate.
 */
export async function sendShoutOut(toProfileId, message, tag = null, contextData = null) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!myProfile) {
    return { error: "Profile not found" };
  }

  if (myProfile.id === toProfileId) {
    return { error: "You can't send a shout-out to yourself" };
  }

  const trimmedMessage = message?.trim();
  if (!trimmedMessage || trimmedMessage.length < 1) {
    return { error: "Message is required" };
  }
  if (trimmedMessage.length > 300) {
    return { error: "Message must be 300 characters or less" };
  }

  const insertData = {
    from_profile_id: myProfile.id,
    to_profile_id: toProfileId,
    message: trimmedMessage,
    tag: tag || null,
    status: "pending",
  };

  if (contextData?.classId) {
    insertData.context_class_id = contextData.classId;
  }
  if (contextData?.date) {
    insertData.context_date = contextData.date;
  }
  if (contextData?.sessionChangeId) {
    insertData.context_session_change_id = contextData.sessionChangeId;
  }

  const { error } = await supabase
    .from("shout_outs")
    .insert(insertData);

  if (error) {
    console.error("Error sending shout-out:", error);
    return { error: "Failed to send shout-out" };
  }

  revalidatePath("/instructor/inbox");
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Dismiss a shout-out nudge for a session.
 */
export async function dismissNudge(sessionChangeId) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: myProfile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!myProfile) {
    return { error: "Profile not found" };
  }

  const { error } = await supabase
    .from("shout_out_nudge_dismissals")
    .upsert({
      profile_id: myProfile.id,
      session_change_id: sessionChangeId,
      dismissed_at: new Date().toISOString(),
    }, {
      onConflict: "profile_id,session_change_id",
    });

  if (error) {
    console.error("Error dismissing nudge:", error);
    return { error: "Failed to dismiss" };
  }

  return { success: true };
}
