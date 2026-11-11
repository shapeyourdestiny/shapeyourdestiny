"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

/**
 * Create a new team event
 * @param {Object} data - Event data
 */
export async function createTeamEvent(data) {
  const supabase = await createClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  // Get admin profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized" };
  }

  const adminSupabase = createAdminClient();

  // Create the event
  const { data: event, error: eventError } = await adminSupabase
    .from("team_events")
    .insert({
      type: data.type,
      title: data.title,
      event_date: data.eventDate,
      start_time: data.startTime,
      end_time: data.endTime,
      location: data.location || null,
      details: data.details || null,
      paid: data.paid || false,
      pay_classes: data.paid ? (data.payClasses || null) : null,
      required: data.required !== false,
      audience: data.audience || { type: "all" },
      created_by: profile.id,
    })
    .select()
    .single();

  if (eventError) {
    console.error("Error creating team event:", eventError);
    return { error: eventError.message };
  }

  // Determine who to invite based on audience
  let profileIds = [];
  if (data.audience?.type === "all") {
    const { data: instructors } = await adminSupabase
      .from("profiles")
      .select("id")
      .in("role", ["instructor", "admin"])
      .eq("status", "active");
    profileIds = (instructors || []).map((p) => p.id);
  } else if (data.audience?.type === "specific" && data.audience.profileIds) {
    profileIds = data.audience.profileIds;
  }

  // Create team_event_people rows
  if (profileIds.length > 0) {
    const peopleRows = profileIds.map((profileId) => ({
      event_id: event.id,
      profile_id: profileId,
    }));

    const { error: peopleError } = await adminSupabase
      .from("team_event_people")
      .insert(peopleRows);

    if (peopleError) {
      console.error("Error adding people to event:", peopleError);
    }
  }

  // Send email notifications if requested
  if (data.sendEmail !== false) {
    try {
      await sendTeamEventEmails(event.id);
    } catch (e) {
      console.error("Error sending team event emails:", e);
    }
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/dashboard");

  return { success: true, event };
}

/**
 * Update an existing team event
 * @param {string} eventId - Event UUID
 * @param {Object} data - Fields to update
 */
export async function updateTeamEvent(eventId, data) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized" };
  }

  const adminSupabase = createAdminClient();

  // Get current event for sequence increment
  const { data: currentEvent } = await adminSupabase
    .from("team_events")
    .select("sequence")
    .eq("id", eventId)
    .single();

  if (!currentEvent) {
    return { error: "Event not found" };
  }

  const updateData = {
    edited_at: new Date().toISOString(),
    sequence: currentEvent.sequence + 1,
  };

  if (data.type !== undefined) updateData.type = data.type;
  if (data.title !== undefined) updateData.title = data.title;
  if (data.eventDate !== undefined) updateData.event_date = data.eventDate;
  if (data.startTime !== undefined) updateData.start_time = data.startTime;
  if (data.endTime !== undefined) updateData.end_time = data.endTime;
  if (data.location !== undefined) updateData.location = data.location;
  if (data.details !== undefined) updateData.details = data.details;
  if (data.paid !== undefined) {
    updateData.paid = data.paid;
    updateData.pay_classes = data.paid ? (data.payClasses || null) : null;
  }
  if (data.required !== undefined) updateData.required = data.required;

  const { data: event, error } = await adminSupabase
    .from("team_events")
    .update(updateData)
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    console.error("Error updating team event:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/dashboard");

  return { success: true, event };
}

/**
 * Cancel a team event
 * @param {string} eventId - Event UUID
 */
export async function cancelTeamEvent(eventId) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized" };
  }

  const adminSupabase = createAdminClient();

  // Get current event for sequence increment
  const { data: currentEvent } = await adminSupabase
    .from("team_events")
    .select("sequence")
    .eq("id", eventId)
    .single();

  if (!currentEvent) {
    return { error: "Event not found" };
  }

  const { data: event, error } = await adminSupabase
    .from("team_events")
    .update({
      status: "cancelled",
      edited_at: new Date().toISOString(),
      sequence: currentEvent.sequence + 1,
    })
    .eq("id", eventId)
    .select()
    .single();

  if (error) {
    console.error("Error cancelling team event:", error);
    return { error: error.message };
  }

  revalidatePath("/admin/schedule");
  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/dashboard");

  return { success: true, event };
}

/**
 * Duplicate a team event
 * @param {string} eventId - Event UUID to duplicate
 * @param {string} newDate - Optional new date for the duplicate
 */
export async function duplicateTeamEvent(eventId, newDate = null) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized" };
  }

  const adminSupabase = createAdminClient();

  // Get the original event with people
  const { data: original } = await adminSupabase
    .from("team_events")
    .select(`
      type,
      title,
      event_date,
      start_time,
      end_time,
      location,
      details,
      paid,
      pay_classes,
      required,
      audience,
      people:team_event_people (
        profile_id
      )
    `)
    .eq("id", eventId)
    .single();

  if (!original) {
    return { error: "Event not found" };
  }

  // Create the duplicate
  const { data: newEvent, error: eventError } = await adminSupabase
    .from("team_events")
    .insert({
      type: original.type,
      title: original.title,
      event_date: newDate || original.event_date,
      start_time: original.start_time,
      end_time: original.end_time,
      location: original.location,
      details: original.details,
      paid: original.paid,
      pay_classes: original.pay_classes,
      required: original.required,
      audience: original.audience,
      created_by: profile.id,
    })
    .select()
    .single();

  if (eventError) {
    console.error("Error duplicating team event:", eventError);
    return { error: eventError.message };
  }

  // Copy the people
  if (original.people && original.people.length > 0) {
    const peopleRows = original.people.map((p) => ({
      event_id: newEvent.id,
      profile_id: p.profile_id,
    }));

    await adminSupabase.from("team_event_people").insert(peopleRows);
  }

  revalidatePath("/admin/schedule");

  return { success: true, event: newEvent };
}

/**
 * Update RSVP for current instructor
 * @param {string} eventId - Event UUID
 * @param {string} rsvp - "yes" or "no"
 * @param {string} reason - Required reason if declining required event
 */
export async function updateRSVP(eventId, rsvp, reason = null) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) {
    return { error: "Profile not found" };
  }

  // Get the event to check if it's required
  const { data: event } = await supabase
    .from("team_events")
    .select("id, title, event_date, required, start_time")
    .eq("id", eventId)
    .single();

  if (!event) {
    return { error: "Event not found" };
  }

  // Check if event has already started
  const now = new Date();
  const eventDateTime = new Date(`${event.event_date}T${event.start_time}`);
  if (now >= eventDateTime) {
    return { error: "Cannot RSVP after event has started" };
  }

  // Require reason for declining required events
  if (rsvp === "no" && event.required && !reason?.trim()) {
    return { error: "Please provide a reason for declining" };
  }

  const { error } = await supabase
    .from("team_event_people")
    .update({
      rsvp,
      rsvp_reason: rsvp === "no" ? (reason?.trim() || null) : null,
      rsvp_at: new Date().toISOString(),
    })
    .eq("event_id", eventId)
    .eq("profile_id", profile.id);

  if (error) {
    console.error("Error updating RSVP:", error);
    return { error: error.message };
  }

  // If declining a required event, create admin inbox item
  if (rsvp === "no" && event.required) {
    try {
      await createAdminInboxItem({
        type: "team_event_declined",
        profileId: profile.id,
        profileName: profile.full_name,
        eventId: event.id,
        eventTitle: event.title,
        eventDate: event.event_date,
        reason: reason?.trim(),
      });
    } catch (e) {
      console.error("Error creating admin inbox item:", e);
    }
  }

  revalidatePath("/instructor/inbox");
  revalidatePath("/instructor/dashboard");
  revalidatePath("/admin/schedule");
  revalidatePath("/admin/inbox");

  return { success: true };
}

/**
 * Mark attendance for a team event (admin only)
 * @param {string} eventId - Event UUID
 * @param {Object} attendanceMap - { profileId: boolean, ... }
 */
export async function markAttendance(eventId, attendanceMap) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Not authenticated" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return { error: "Not authorized" };
  }

  const adminSupabase = createAdminClient();
  const now = new Date().toISOString();

  // Update each person's attendance
  const updates = Object.entries(attendanceMap).map(([profileId, attended]) =>
    adminSupabase
      .from("team_event_people")
      .update({
        attended,
        marked_at: now,
      })
      .eq("event_id", eventId)
      .eq("profile_id", profileId)
  );

  await Promise.all(updates);

  revalidatePath("/admin/schedule");
  revalidatePath("/admin/payroll");

  return { success: true };
}

/**
 * Send email notifications for a team event
 */
async function sendTeamEventEmails(eventId) {
  const adminSupabase = createAdminClient();

  const { data: event } = await adminSupabase
    .from("team_events")
    .select(`
      id,
      type,
      title,
      event_date,
      start_time,
      end_time,
      location,
      details,
      paid,
      pay_classes,
      required,
      people:team_event_people (
        profile:profile_id (
          id,
          full_name,
          email
        )
      )
    `)
    .eq("id", eventId)
    .single();

  if (!event || !event.people?.length) return;

  const { sendTeamEventEmail } = await import("@/lib/email");

  for (const person of event.people) {
    if (!person.profile?.email) continue;

    try {
      await sendTeamEventEmail({
        to: person.profile.email,
        firstName: person.profile.full_name?.split(" ")[0] || "there",
        event: {
          type: event.type,
          title: event.title,
          eventDate: event.event_date,
          startTime: event.start_time,
          endTime: event.end_time,
          location: event.location,
          details: event.details,
          paid: event.paid,
          payClasses: event.pay_classes,
          required: event.required,
        },
      });
    } catch (e) {
      console.error(`Error sending email to ${person.profile.email}:`, e);
    }
  }
}

/**
 * Create an admin inbox item for declined required event
 */
async function createAdminInboxItem({ type, profileId, profileName, eventId, eventTitle, eventDate, reason }) {
  // Admin inbox items are stored in a different way - we'll handle this in the admin inbox queries
  // For now, the declined events are fetched directly from team_event_people
  // This function is a placeholder for future expansion if needed
}
