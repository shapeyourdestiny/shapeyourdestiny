import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendAnnouncementEmail } from "@/lib/email";

/**
 * Cron route for scheduled announcements.
 * Runs every 15 minutes to send any scheduled announcements.
 */
export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // Find scheduled announcements that should be sent
  const { data: announcements, error } = await supabase
    .from("announcements")
    .select(`
      id,
      title,
      body,
      audience,
      send_email,
      created_by,
      creator:created_by (full_name)
    `)
    .eq("status", "scheduled")
    .lte("send_at", now)
    .is("archived_at", null);

  if (error) {
    console.error("Error fetching scheduled announcements:", error);
    return NextResponse.json({ error: "Database error" }, { status: 500 });
  }

  if (!announcements || announcements.length === 0) {
    return NextResponse.json({ message: "No announcements to send" });
  }

  const results = [];

  for (const announcement of announcements) {
    try {
      // Update status to sent
      const { error: updateError } = await supabase
        .from("announcements")
        .update({
          status: "sent",
          sent_at: now,
          send_at: null,
        })
        .eq("id", announcement.id);

      if (updateError) {
        console.error(`Error updating announcement ${announcement.id}:`, updateError);
        results.push({ id: announcement.id, status: "error", error: updateError.message });
        continue;
      }

      // Send emails if requested
      if (announcement.send_email) {
        const recipients = await getAudienceRecipients(supabase, announcement.audience);
        const senderName = announcement.creator?.full_name?.split(" ")[0] || "Admin";

        let emailsSent = 0;
        for (const recipient of recipients) {
          if (recipient.email) {
            try {
              await sendAnnouncementEmail({
                to: recipient.email,
                title: announcement.title,
                body: announcement.body,
                senderName,
              });
              emailsSent++;
            } catch (e) {
              console.error(`Failed to email ${recipient.email}:`, e);
            }
          }
        }

        // Mark as emailed
        await supabase
          .from("announcements")
          .update({ emailed_at: now })
          .eq("id", announcement.id);

        results.push({ id: announcement.id, status: "sent", emailsSent });
      } else {
        results.push({ id: announcement.id, status: "sent" });
      }
    } catch (e) {
      console.error(`Error processing announcement ${announcement.id}:`, e);
      results.push({ id: announcement.id, status: "error", error: e.message });
    }
  }

  return NextResponse.json({
    message: `Processed ${announcements.length} announcements`,
    results,
  });
}

/**
 * Get recipients for an audience using admin client.
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
  } else if (audienceType === "school") {
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
