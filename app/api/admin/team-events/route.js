import { createClient } from "@/lib/supabase/server";
import { getTeamEventsForWeek, getPublicRsvpCounts } from "@/lib/team-events/queries";
import { NextResponse } from "next/server";

export async function GET(request) {
  const supabase = await createClient();

  // Check admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get date range from query params
  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");

  if (!startDate || !endDate) {
    return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
  }

  try {
    const events = await getTeamEventsForWeek(startDate, endDate);

    // Get public RSVP counts for events with public_rsvp enabled
    const publicRsvpEventIds = events
      .filter((e) => e.public_rsvp)
      .map((e) => e.id);

    let publicRsvpCounts = {};
    if (publicRsvpEventIds.length > 0) {
      publicRsvpCounts = await getPublicRsvpCounts(publicRsvpEventIds);
    }

    // Attach counts to events
    const eventsWithCounts = events.map((e) => {
      if (e.public_rsvp && publicRsvpCounts[e.id]) {
        return {
          ...e,
          publicRsvpCounts: publicRsvpCounts[e.id],
        };
      }
      return e;
    });

    return NextResponse.json(eventsWithCounts);
  } catch (error) {
    console.error("Error fetching team events:", error);
    return NextResponse.json({ error: "Failed to fetch team events" }, { status: 500 });
  }
}
