import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getInstructorSessions, getHolidaysInRange } from "@/lib/schedule/instructor-queries";
import { getCoverageRequestsInRange } from "@/lib/coverage/queries";

export async function GET(request) {
  const supabase = await createClient();

  // Check authentication
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify user is an instructor
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "instructor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!start || !end) {
    return NextResponse.json({ error: "Missing start or end date" }, { status: 400 });
  }

  // Validate date format (YYYY-MM-DD)
  const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
  if (!dateRegex.test(start) || !dateRegex.test(end)) {
    return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
  }

  try {
    const [sessions, holidays, coverageRequests] = await Promise.all([
      getInstructorSessions(user.id, start, end),
      getHolidaysInRange(start, end),
      getCoverageRequestsInRange(start, end).catch(() => []),
    ]);

    // Build a map of coverage statuses for sessions
    const coverageStatuses = {};
    for (const req of coverageRequests) {
      const key = `${req.classId}-${req.date}`;
      coverageStatuses[key] = {
        hasCoverageRequest: true,
        status: req.status,
        isMyRequest: req.requester?.id === user.id,
        isCoveredByMe: req.claimer?.id === user.id,
        coverageId: req.id,
      };
    }

    return NextResponse.json({ sessions, holidays, coverageStatuses });
  } catch (err) {
    console.error("Error fetching schedule:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
