import { createClient } from "@/lib/supabase/server";

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get all open coverage requests (for the Coverage Board).
 * Excludes requests made by the current user.
 * Returns requests sorted by date (soonest first).
 */
export async function getOpenCoverageRequests(profileId) {
  const supabase = await createClient();
  const today = formatDate(new Date());

  const { data, error } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      requested_by,
      posted_by,
      note,
      created_at,
      classes:class_id (
        id,
        time,
        days,
        program,
        schools:school_id (
          id,
          name,
          address,
          districts:district_id (
            id,
            name,
            color
          )
        )
      ),
      requester:requested_by (
        id,
        full_name
      ),
      poster:posted_by (
        id,
        full_name
      )
    `)
    .eq("status", "open")
    .neq("requested_by", profileId)
    .gte("date", today)
    .order("date", { ascending: true });

  if (error) {
    console.error("Error fetching open coverage requests:", error);
    return [];
  }

  return (data || []).map((req) => ({
    id: req.id,
    classId: req.class_id,
    date: req.date,
    note: req.note,
    createdAt: req.created_at,
    time: req.classes?.time,
    school: req.classes?.schools
      ? {
          id: req.classes.schools.id,
          name: req.classes.schools.name,
          address: req.classes.schools.address,
        }
      : null,
    district: req.classes?.schools?.districts
      ? {
          id: req.classes.schools.districts.id,
          name: req.classes.schools.districts.name,
          color: req.classes.schools.districts.color,
        }
      : null,
    program: req.classes?.program
      ? {
          name: req.classes.program === "wellness" ? "Youth Wellness" : "Soccer",
        }
      : null,
    requester: req.requester
      ? {
          id: req.requester.id,
          name: req.requester.full_name,
        }
      : null,
    postedBy: req.poster
      ? {
          id: req.poster.id,
          name: req.poster.full_name,
        }
      : null,
  }));
}

/**
 * Get coverage requests for the current user.
 * Returns both open and claimed requests (excluding cancelled).
 */
export async function getMyCoverageRequests(profileId) {
  const supabase = await createClient();
  const today = formatDate(new Date());

  // Get coverage posted FOR me (where I'm the one who's out)
  const { data: coveredForMe, error: forMeError } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      note,
      created_at,
      claimed_by,
      claimed_at,
      posted_by,
      classes:class_id (
        id,
        time,
        schools:school_id (
          id,
          name
        )
      ),
      claimer:claimed_by (
        id,
        full_name
      ),
      poster:posted_by (
        id,
        full_name
      )
    `)
    .eq("requested_by", profileId)
    .neq("status", "cancelled")
    .gte("date", today)
    .order("date", { ascending: true });

  if (forMeError) {
    console.error("Error fetching coverage for me:", forMeError);
  }

  // Get requests I claimed (that are still upcoming)
  const { data: claimedByMe, error: claimedError } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      note,
      created_at,
      requested_by,
      claimed_at,
      classes:class_id (
        id,
        time,
        schools:school_id (
          id,
          name,
          address
        )
      ),
      requester:requested_by (
        id,
        full_name
      )
    `)
    .eq("claimed_by", profileId)
    .eq("status", "claimed")
    .gte("date", today)
    .order("date", { ascending: true });

  if (claimedError) {
    console.error("Error fetching claims by me:", claimedError);
  }

  return {
    // Coverage posted FOR the instructor (they're the one who's out)
    coveredForYou: (coveredForMe || []).map((req) => ({
      id: req.id,
      classId: req.class_id,
      date: req.date,
      status: req.status,
      note: req.note,
      createdAt: req.created_at,
      time: req.classes?.time,
      school: req.classes?.schools
        ? {
            id: req.classes.schools.id,
            name: req.classes.schools.name,
          }
        : null,
      claimer: req.claimer
        ? {
            id: req.claimer.id,
            name: req.claimer.full_name,
          }
        : null,
      postedBy: req.poster
        ? {
            id: req.poster.id,
            name: req.poster.full_name,
          }
        : null,
      claimedAt: req.claimed_at,
    })),
    // Sessions this instructor is covering for someone else
    claimed: (claimedByMe || []).map((req) => ({
      id: req.id,
      classId: req.class_id,
      date: req.date,
      note: req.note,
      createdAt: req.created_at,
      time: req.classes?.time,
      school: req.classes?.schools
        ? {
            id: req.classes.schools.id,
            name: req.classes.schools.name,
            address: req.classes.schools.address,
          }
        : null,
      requester: req.requester
        ? {
            id: req.requester.id,
            name: req.requester.full_name,
          }
        : null,
      claimedAt: req.claimed_at,
    })),
  };
}

/**
 * Get count of open coverage requests (for badge display).
 * Excludes requests made by the current user.
 */
export async function getOpenCoverageCount(profileId) {
  const supabase = await createClient();
  const today = formatDate(new Date());

  const { count, error } = await supabase
    .from("coverage_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .neq("requested_by", profileId)
    .gte("date", today);

  if (error) {
    console.error("Error fetching open coverage count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get all open coverage count (for admin badge).
 */
export async function getAdminCoverageCount() {
  const supabase = await createClient();
  const today = formatDate(new Date());

  const { count, error } = await supabase
    .from("coverage_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .gte("date", today);

  if (error) {
    console.error("Error fetching admin coverage count:", error);
    return 0;
  }

  return count || 0;
}

/**
 * Get all coverage requests within a date range (for admin schedule view).
 */
export async function getCoverageRequestsInRange(startDate, endDate) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      requested_by,
      claimed_by,
      requester:requested_by (
        id,
        full_name
      ),
      claimer:claimed_by (
        id,
        full_name
      )
    `)
    .gte("date", startDate)
    .lte("date", endDate)
    .in("status", ["open", "claimed"]);

  if (error) {
    console.error("Error fetching coverage requests in range:", error);
    return [];
  }

  return (data || []).map((req) => ({
    id: req.id,
    classId: req.class_id,
    date: req.date,
    status: req.status,
    requester: req.requester
      ? { id: req.requester.id, name: req.requester.full_name }
      : null,
    claimer: req.claimer
      ? { id: req.claimer.id, name: req.claimer.full_name }
      : null,
  }));
}
