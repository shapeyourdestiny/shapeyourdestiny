import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Get team events for a date range (admin use)
 * @param {string} startDate - Start date (YYYY-MM-DD)
 * @param {string} endDate - End date (YYYY-MM-DD)
 */
export async function getTeamEventsForWeek(startDate, endDate) {
  const supabase = await createClient();

  const { data, error } = await supabase
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
      audience,
      status,
      sequence,
      created_by,
      created_at,
      edited_at,
      people:team_event_people (
        profile_id,
        rsvp,
        rsvp_reason,
        rsvp_at,
        attended,
        marked_at,
        profile:profile_id (
          id,
          full_name,
          avatar_url
        )
      )
    `)
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date")
    .order("start_time");

  if (error) {
    console.error("Error fetching team events:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a single team event by ID with all people
 * @param {string} eventId - Event UUID
 */
export async function getTeamEventById(eventId) {
  const supabase = await createClient();

  const { data, error } = await supabase
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
      audience,
      status,
      sequence,
      created_by,
      created_at,
      edited_at,
      creator:created_by (
        id,
        full_name
      ),
      people:team_event_people (
        profile_id,
        rsvp,
        rsvp_reason,
        rsvp_at,
        attended,
        marked_at,
        profile:profile_id (
          id,
          full_name,
          avatar_url,
          email
        )
      )
    `)
    .eq("id", eventId)
    .single();

  if (error) {
    console.error("Error fetching team event:", error);
    return null;
  }

  return data;
}

/**
 * Get team events for an instructor (using RPC function)
 * @param {string} profileId - Profile UUID (optional, uses current user if not provided)
 * @param {string} startDate - Optional start date filter
 * @param {string} endDate - Optional end date filter
 */
export async function getTeamEventsForInstructor(profileId = null, startDate = null, endDate = null) {
  const supabase = await createClient();

  // If profileId is provided, use admin client to fetch
  if (profileId) {
    const adminSupabase = createAdminClient();
    const { data, error } = await adminSupabase
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
        status,
        team_event_people!inner (
          rsvp,
          rsvp_reason,
          rsvp_at
        )
      `)
      .eq("team_event_people.profile_id", profileId)
      .gte("event_date", startDate || "1900-01-01")
      .lte("event_date", endDate || "2100-12-31")
      .order("event_date")
      .order("start_time");

    if (error) {
      console.error("Error fetching team events for instructor:", error);
      return [];
    }

    // Flatten the nested structure
    return (data || []).map((event) => ({
      ...event,
      rsvp: event.team_event_people[0]?.rsvp || null,
      rsvp_reason: event.team_event_people[0]?.rsvp_reason || null,
      rsvp_at: event.team_event_people[0]?.rsvp_at || null,
      team_event_people: undefined,
    }));
  }

  // Use the RPC function for current user
  const { data, error } = await supabase.rpc("my_team_events", {
    p_start_date: startDate,
    p_end_date: endDate,
  });

  if (error) {
    console.error("Error fetching my team events:", error);
    return [];
  }

  return data || [];
}

/**
 * Get upcoming team events for an instructor's inbox
 * Returns events with pending RSVP or upcoming events they haven't seen
 */
export async function getTeamEventsForInbox(profileId) {
  const adminSupabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await adminSupabase
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
      required,
      status,
      created_at,
      team_event_people!inner (
        rsvp,
        rsvp_at
      )
    `)
    .eq("team_event_people.profile_id", profileId)
    .eq("status", "scheduled")
    .gte("event_date", today)
    .order("event_date")
    .order("start_time");

  if (error) {
    console.error("Error fetching team events for inbox:", error);
    return [];
  }

  // Flatten and return
  return (data || []).map((event) => ({
    ...event,
    rsvp: event.team_event_people[0]?.rsvp || null,
    rsvp_at: event.team_event_people[0]?.rsvp_at || null,
    team_event_people: undefined,
  }));
}

/**
 * Get paid team events for a payroll period
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 */
export async function getPaidTeamEventsForPeriod(startDate, endDate) {
  const adminSupabase = createAdminClient();

  const { data, error } = await adminSupabase
    .from("team_events")
    .select(`
      id,
      type,
      title,
      event_date,
      start_time,
      end_time,
      paid,
      pay_classes,
      status,
      people:team_event_people (
        profile_id,
        attended,
        marked_at,
        profile:profile_id (
          id,
          full_name
        )
      )
    `)
    .eq("paid", true)
    .eq("status", "scheduled")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .order("event_date");

  if (error) {
    console.error("Error fetching paid team events:", error);
    return [];
  }

  return data || [];
}

/**
 * Get team events with unmarked attendance (for payroll blocker)
 * @param {string} startDate - Period start date
 * @param {string} endDate - Period end date
 */
export async function getEventsWithUnmarkedAttendance(startDate, endDate) {
  const adminSupabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await adminSupabase
    .from("team_events")
    .select(`
      id,
      type,
      title,
      event_date,
      people:team_event_people (
        profile_id,
        attended
      )
    `)
    .eq("paid", true)
    .eq("status", "scheduled")
    .gte("event_date", startDate)
    .lte("event_date", endDate)
    .lt("event_date", today);

  if (error) {
    console.error("Error checking unmarked attendance:", error);
    return [];
  }

  // Filter to events where at least one person has attended = null
  return (data || []).filter((event) =>
    event.people.some((p) => p.attended === null)
  );
}

/**
 * Get declined required events for admin inbox
 */
export async function getDeclinedRequiredEvents() {
  const adminSupabase = createAdminClient();
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await adminSupabase
    .from("team_event_people")
    .select(`
      event_id,
      profile_id,
      rsvp,
      rsvp_reason,
      rsvp_at,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      ),
      event:event_id (
        id,
        type,
        title,
        event_date,
        start_time,
        required,
        status
      )
    `)
    .eq("rsvp", "no")
    .eq("event.required", true)
    .eq("event.status", "scheduled")
    .gte("event.event_date", today)
    .order("rsvp_at", { ascending: false });

  if (error) {
    console.error("Error fetching declined required events:", error);
    return [];
  }

  return data || [];
}

/**
 * Get all active instructors for event audience
 */
export async function getActiveInstructors() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url, email")
    .in("role", ["instructor", "admin"])
    .eq("status", "active")
    .order("full_name");

  if (error) {
    console.error("Error fetching active instructors:", error);
    return [];
  }

  return data || [];
}
