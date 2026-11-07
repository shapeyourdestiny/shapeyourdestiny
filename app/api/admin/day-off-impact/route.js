import { createClient } from "@/lib/supabase/server";
import { previewDayOffImpact, getInstructorsToNotify } from "@/lib/schedule/day-off-impact";

/**
 * POST - Preview the impact of adding a day off
 * Body: { date, scope, timePeriod, districtId?, schoolId?, program?, name }
 */
export async function POST(request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { date, scope, timePeriod, districtId, schoolId, program, name } = body;

  if (!date) {
    return Response.json({ error: "Date is required" }, { status: 400 });
  }

  try {
    const impact = await previewDayOffImpact({
      date,
      scope: scope || "global",
      timePeriod: timePeriod || "all_day",
      districtId,
      schoolId,
      program,
      name,
    });

    // Get instructors to notify
    const instructorsToNotify = getInstructorsToNotify(
      impact.affectedSessions,
      impact.sessionChanges
    );

    return Response.json({
      ...impact,
      instructorsToNotify,
    });
  } catch (error) {
    console.error("Error previewing day off impact:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
