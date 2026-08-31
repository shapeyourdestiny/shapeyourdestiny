import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import AdminCoverage from "./AdminCoverage";

export const metadata = {
  title: "Coverage | Shape Your Destiny Admin",
  description: "Manage coverage requests and view trends.",
};

async function getCoverageData() {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const today = new Date().toISOString().split("T")[0];

  // Get stats
  const urgentDate = new Date();
  urgentDate.setDate(urgentDate.getDate() + 3);
  const urgentDateStr = urgentDate.toISOString().split("T")[0];

  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartStr = monthStart.toISOString().split("T")[0];

  const [urgentRes, openRes, coveredRes] = await Promise.all([
    supabase
      .from("coverage_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("date", today)
      .lte("date", urgentDateStr),
    supabase
      .from("coverage_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "open")
      .gte("date", today),
    supabase
      .from("coverage_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "claimed")
      .gte("date", monthStartStr),
  ]);

  const stats = {
    urgent: urgentRes.count || 0,
    open: openRes.count || 0,
    coveredThisMonth: coveredRes.count || 0,
  };

  // Get requests
  const { data: requestsData } = await supabase
    .from("coverage_requests")
    .select(`
      id,
      class_id,
      date,
      status,
      note,
      created_at,
      requested_by,
      claimed_by,
      claimed_at,
      classes:class_id (
        id,
        time,
        program,
        schools:school_id (
          id,
          name
        )
      ),
      requester:requested_by (
        id,
        full_name
      ),
      claimer:claimed_by (
        id,
        full_name
      )
    `)
    .gte("date", today)
    .neq("status", "cancelled")
    .order("date", { ascending: true });

  const requests = (requestsData || []).map((req) => ({
    id: req.id,
    classId: req.class_id,
    date: req.date,
    status: req.status,
    note: req.note,
    createdAt: req.created_at,
    time: req.classes?.time,
    school: req.classes?.schools
      ? { id: req.classes.schools.id, name: req.classes.schools.name }
      : null,
    program: req.classes?.program
      ? { name: req.classes.program === "wellness" ? "Youth Wellness" : "Soccer" }
      : null,
    requester: req.requester
      ? { id: req.requester.id, name: req.requester.full_name }
      : null,
    claimer: req.claimer
      ? { id: req.claimer.id, name: req.claimer.full_name }
      : null,
    claimedAt: req.claimed_at,
    isUrgent: req.status === "open" && req.date <= urgentDateStr,
  }));

  // Get instructors (simplified - no status filter in case column doesn't exist)
  const { data: instructorsData, error: instructorsError } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .order("full_name");

  if (instructorsError) {
    console.error("Error fetching instructors:", instructorsError);
  }

  const instructors = (instructorsData || [])
    .filter((p) => p.role === "instructor")
    .map((p) => ({
      id: p.id,
      name: p.full_name,
      districts: [],
    }));

  // Get districts for the post modal
  const { data: districtsData } = await supabase
    .from("districts")
    .select("id, name, color")
    .order("name");

  const districts = districtsData || [];

  return { stats, requests, instructors, districts };
}

export default async function CoveragePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  // Verify admin role
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Fetch coverage data
  let stats = { urgent: 0, open: 0, coveredThisMonth: 0 };
  let requests = [];
  let instructors = [];
  let districts = [];

  try {
    const data = await getCoverageData();
    stats = data.stats;
    requests = data.requests;
    instructors = data.instructors;
    districts = data.districts;
  } catch (error) {
    console.error("Error fetching coverage data:", error);
  }

  // Default values for trends (can be fetched later client-side)
  const trends90 = { fillRate: 0, avgTimeToCover: 0, totalRequests: 0, totalCovered: 0 };
  const chartData = [];
  const frequentRequesters90 = [];
  const reliableCoverers90 = [];

  return (
    <AdminCoverage
      initialStats={stats}
      initialFrequentAlert={null}
      initialRequests={requests}
      instructors={instructors}
      districts={districts}
      initialTrends={trends90}
      initialChartData={chartData}
      initialFrequentRequesters={frequentRequesters90}
      initialReliableCoverers={reliableCoverers90}
    />
  );
}
