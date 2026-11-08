"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { sendAnnouncementEmail } from "@/lib/email";

/**
 * Verify the user is an admin and return their profile.
 */
async function verifyAdmin(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") return null;
  return profile;
}

/**
 * Get recipients for an audience.
 * Returns array of { id, email, full_name }.
 */
async function getAudienceRecipients(supabase, audience) {
  const audienceType = audience?.type;
  let query = supabase
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "instructor")
    .eq("status", "active");

  if (audienceType === "all") {
    // All active instructors - no additional filter
  } else if (audienceType === "program") {
    // Get instructors in a specific program
    const { data: assignments } = await supabase
      .from("class_assignments")
      .select(`
        profile_id,
        classes!inner (program, start_date)
      `)
      .eq("classes.program", audience.program)
      .not("classes.start_date", "is", null);

    const profileIds = [...new Set((assignments || []).map(a => a.profile_id))];
    if (profileIds.length === 0) return [];
    query = query.in("id", profileIds);
  } else if (audienceType === "district") {
    // Get instructors in specific districts
    const districtIds = audience.district_ids || [];
    if (districtIds.length === 0) return [];

    const { data: instructorDistricts } = await supabase
      .from("instructor_districts")
      .select("profile_id")
      .in("district_id", districtIds);

    const profileIds = [...new Set((instructorDistricts || []).map(id => id.profile_id))];
    if (profileIds.length === 0) return [];
    query = query.in("id", profileIds);
  } else if (audienceType === "school") {
    // Get instructors at specific schools
    const schoolIds = audience.school_ids || [];
    if (schoolIds.length === 0) return [];

    const { data: assignments } = await supabase
      .from("class_assignments")
      .select(`
        profile_id,
        classes!inner (school_id, start_date)
      `)
      .in("classes.school_id", schoolIds)
      .not("classes.start_date", "is", null);

    const profileIds = [...new Set((assignments || []).map(a => a.profile_id))];
    if (profileIds.length === 0) return [];
    query = query.in("id", profileIds);
  } else if (audienceType === "people") {
    // Specific people
    const profileIds = audience.profile_ids || [];
    if (profileIds.length === 0) return [];
    query = query.in("id", profileIds);
  } else {
    return [];
  }

  const { data, error } = await query;
  if (error) {
    console.error("Error fetching audience recipients:", error);
    return [];
  }

  return data || [];
}

/**
 * Get recipient count for an audience (for live preview).
 */
export async function getAnnouncementRecipientCount(audience) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized", count: 0 };
  }

  const { data, error } = await supabase.rpc("get_announcement_recipient_count", {
    p_audience: audience,
  });

  if (error) {
    console.error("Error getting recipient count:", error);
    return { error: "Failed to get count", count: 0 };
  }

  return { count: data || 0 };
}

/**
 * Save or update an announcement draft.
 */
export async function saveAnnouncementDraft(data) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { id, title, body, audience, sendEmail, pinnedUntil } = data;

  const announcementData = {
    title: title?.trim() || "",
    body: body?.trim() || "",
    audience: audience || { type: "all" },
    send_email: sendEmail || false,
    pinned_until: pinnedUntil || null,
    status: "draft",
  };

  if (id) {
    // Update existing draft
    const { error } = await supabase
      .from("announcements")
      .update(announcementData)
      .eq("id", id)
      .eq("status", "draft");

    if (error) {
      console.error("Error updating draft:", error);
      return { error: "Failed to save draft" };
    }

    revalidatePath("/admin/updates");
    return { success: true, id };
  } else {
    // Create new draft
    announcementData.created_by = admin.id;

    const { data: newAnnouncement, error } = await supabase
      .from("announcements")
      .insert(announcementData)
      .select("id")
      .single();

    if (error) {
      console.error("Error creating draft:", error);
      return { error: "Failed to create draft" };
    }

    revalidatePath("/admin/updates");
    return { success: true, id: newAnnouncement.id };
  }
}

/**
 * Send an announcement immediately.
 * Idempotent - safe to call multiple times.
 */
export async function sendAnnouncement(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Get the announcement
  const { data: announcement, error: fetchError } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !announcement) {
    return { error: "Announcement not found" };
  }

  // If already sent, return success (idempotent)
  if (announcement.status === "sent") {
    return { success: true, alreadySent: true };
  }

  const now = new Date().toISOString();

  // Update status to sent
  const { error: updateError } = await supabase
    .from("announcements")
    .update({
      status: "sent",
      sent_at: now,
      send_at: null, // Clear scheduled time
    })
    .eq("id", id);

  if (updateError) {
    console.error("Error sending announcement:", updateError);
    return { error: "Failed to send announcement" };
  }

  // Send emails if requested
  if (announcement.send_email && !announcement.emailed_at) {
    const recipients = await getAudienceRecipients(supabase, announcement.audience);
    const senderName = admin.full_name?.split(" ")[0] || "Admin";

    for (const recipient of recipients) {
      if (recipient.email) {
        try {
          await sendAnnouncementEmail({
            to: recipient.email,
            title: announcement.title,
            body: announcement.body,
            senderName,
          });
        } catch (e) {
          console.error(`Failed to email ${recipient.email}:`, e);
        }
      }
    }

    // Mark as emailed
    await supabase
      .from("announcements")
      .update({ emailed_at: now })
      .eq("id", id);
  }

  revalidatePath("/admin/updates");
  revalidatePath("/instructor/inbox");

  return { success: true };
}

/**
 * Schedule an announcement for later.
 */
export async function scheduleAnnouncement(id, sendAt) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Validate sendAt is in the future
  const sendAtDate = new Date(sendAt);
  if (sendAtDate <= new Date()) {
    return { error: "Schedule time must be in the future" };
  }

  const { error } = await supabase
    .from("announcements")
    .update({
      status: "scheduled",
      send_at: sendAt,
    })
    .eq("id", id)
    .in("status", ["draft", "scheduled"]);

  if (error) {
    console.error("Error scheduling announcement:", error);
    return { error: "Failed to schedule announcement" };
  }

  revalidatePath("/admin/updates");

  return { success: true };
}

/**
 * Edit a sent announcement.
 * Sets edited_at timestamp.
 */
export async function editAnnouncement(id, data) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { title, body, pinnedUntil } = data;
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("announcements")
    .update({
      title: title?.trim(),
      body: body?.trim(),
      pinned_until: pinnedUntil || null,
      edited_at: now,
    })
    .eq("id", id)
    .eq("status", "sent");

  if (error) {
    console.error("Error editing announcement:", error);
    return { error: "Failed to edit announcement" };
  }

  revalidatePath("/admin/updates");
  revalidatePath("/instructor/inbox");

  return { success: true };
}

/**
 * Archive a sent announcement (soft delete).
 */
export async function archiveAnnouncement(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const now = new Date().toISOString();

  const { error } = await supabase
    .from("announcements")
    .update({ archived_at: now })
    .eq("id", id);

  if (error) {
    console.error("Error archiving announcement:", error);
    return { error: "Failed to archive announcement" };
  }

  revalidatePath("/admin/updates");
  revalidatePath("/instructor/inbox");

  return { success: true };
}

/**
 * Delete a draft announcement (hard delete).
 * Only works for drafts.
 */
export async function deleteAnnouncementDraft(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("announcements")
    .delete()
    .eq("id", id)
    .eq("status", "draft");

  if (error) {
    console.error("Error deleting draft:", error);
    return { error: "Failed to delete draft" };
  }

  revalidatePath("/admin/updates");

  return { success: true };
}

/**
 * Send reminder email to unread recipients.
 * Limited to once per day per announcement.
 */
export async function remindUnread(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Get the announcement
  const { data: announcement, error: fetchError } = await supabase
    .from("announcements")
    .select("*")
    .eq("id", id)
    .eq("status", "sent")
    .single();

  if (fetchError || !announcement) {
    return { error: "Announcement not found" };
  }

  // Check if already reminded today
  const today = new Date().toISOString().split("T")[0];
  if (announcement.last_reminded_at === today) {
    return { error: "Already sent a reminder today" };
  }

  // Get all recipients
  const recipients = await getAudienceRecipients(supabase, announcement.audience);

  // Get who has read it
  const { data: reads } = await supabase
    .from("inbox_reads")
    .select("profile_id")
    .eq("item_type", "announcement")
    .eq("item_id", id);

  const readProfileIds = new Set((reads || []).map(r => r.profile_id));

  // Filter to unread recipients
  const unreadRecipients = recipients.filter(r => !readProfileIds.has(r.id) && r.email);

  if (unreadRecipients.length === 0) {
    return { error: "Everyone has read this announcement" };
  }

  // Send reminder emails
  const senderName = admin.full_name?.split(" ")[0] || "Admin";
  let emailsSent = 0;

  for (const recipient of unreadRecipients) {
    try {
      await sendAnnouncementEmail({
        to: recipient.email,
        title: `Reminder: ${announcement.title}`,
        body: announcement.body,
        senderName,
      });
      emailsSent++;
    } catch (e) {
      console.error(`Failed to email ${recipient.email}:`, e);
    }
  }

  // Update last_reminded_at
  await supabase
    .from("announcements")
    .update({ last_reminded_at: today })
    .eq("id", id);

  revalidatePath("/admin/updates");

  return { success: true, emailsSent, totalUnread: unreadRecipients.length };
}

/**
 * Get read statistics for an announcement.
 */
export async function getAnnouncementReadStats(id) {
  const supabase = await createClient();
  const admin = await verifyAdmin(supabase);
  if (!admin) {
    return { error: "Unauthorized" };
  }

  // Get the announcement
  const { data: announcement, error: fetchError } = await supabase
    .from("announcements")
    .select("audience")
    .eq("id", id)
    .single();

  if (fetchError || !announcement) {
    return { error: "Announcement not found" };
  }

  // Get all recipients
  const recipients = await getAudienceRecipients(supabase, announcement.audience);

  // Get who has read it
  const { data: reads } = await supabase
    .from("inbox_reads")
    .select("profile_id")
    .eq("item_type", "announcement")
    .eq("item_id", id);

  const readProfileIds = new Set((reads || []).map(r => r.profile_id));

  // Calculate stats
  const totalRecipients = recipients.length;
  const readCount = recipients.filter(r => readProfileIds.has(r.id)).length;
  const unreadNames = recipients
    .filter(r => !readProfileIds.has(r.id))
    .map(r => r.full_name?.split(" ")[0] || "Unknown");

  return {
    totalRecipients,
    readCount,
    unreadCount: totalRecipients - readCount,
    unreadNames,
  };
}
