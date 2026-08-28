import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOpenCoverageRequests, getMyCoverageRequests, getCoverageRequestsInRange } from "@/lib/coverage/queries";
import { getInstructorSessions } from "@/lib/schedule/instructor-queries";
import CoverageBoard from "./CoverageBoard";

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export const metadata = {
  title: "Coverage Board | Shape Your Destiny",
  description: "Pick up sessions when teammates need coverage.",
};

export default async function CoveragePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/instructor-login");
  }

  // Calculate date range for upcoming sessions (today + 90 days)
  const today = formatDate(new Date());
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + 90);
  const endDate = formatDate(futureDate);

  // Fetch coverage data and instructor's sessions
  let openRequests = [];
  let myRequests = { requested: [], claimed: [] };
  let mySessions = [];
  let existingCoverageRequests = [];

  try {
    [openRequests, myRequests, mySessions, existingCoverageRequests] = await Promise.all([
      getOpenCoverageRequests(user.id),
      getMyCoverageRequests(user.id),
      getInstructorSessions(user.id, today, endDate),
      getCoverageRequestsInRange(today, endDate).catch(() => []),
    ]);
  } catch (e) {
    console.error("Error fetching coverage data:", e);
  }

  // Build a set of sessions that already have coverage requests (open or claimed)
  const sessionsWithCoverage = new Set();
  for (const req of existingCoverageRequests) {
    sessionsWithCoverage.add(`${req.classId}-${req.date}`);
  }

  // Filter out sessions that already have coverage requests
  const availableSessionsForPosting = mySessions.filter((session) => {
    const key = `${session.classId}-${session.date}`;
    return !sessionsWithCoverage.has(key);
  });

  return (
    <CoverageBoard
      openRequests={openRequests}
      myRequests={myRequests}
      profileId={profile.id}
      mySessions={availableSessionsForPosting}
    />
  );
}
