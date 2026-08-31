import { createClient } from "@/lib/supabase/server";
import {
  getNextSession,
  getInstructorSessions,
  getHolidaysInRange,
} from "@/lib/schedule/instructor-queries";
import { getCoverageRequestsInRange } from "@/lib/coverage/queries";
import styles from "./page.module.css";
import InstructorSchedule from "./InstructorSchedule";

export const metadata = {
  title: "My Schedule | Shape Your Destiny",
  description: "View your teaching schedule for Shape Your Destiny wellness program.",
};

// Helper to format date as YYYY-MM-DD
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Get Sunday of the week containing a date
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - day);
  return d;
}

export default async function InstructorDashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  // Calculate current week range (Sun-Sat)
  const now = new Date();
  const weekStart = getWeekStart(now);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const startDate = formatDate(weekStart);
  const endDate = formatDate(weekEnd);

  // Fetch initial data in parallel
  let nextSession, sessions, holidays, coverageRequests;
  try {
    [nextSession, sessions, holidays, coverageRequests] = await Promise.all([
      getNextSession(user.id),
      getInstructorSessions(user.id, startDate, endDate),
      getHolidaysInRange(startDate, endDate),
      getCoverageRequestsInRange(startDate, endDate).catch(() => []),
    ]);
  } catch (e) {
    console.error("Error fetching dashboard data:", e);
    nextSession = null;
    sessions = [];
    holidays = [];
    coverageRequests = [];
  }

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

  return (
    <div className={styles.page}>
      <h1 className={styles.pageTitle}>My Schedule</h1>

      <InstructorSchedule
        initialNextSession={nextSession}
        initialSessions={sessions}
        initialHolidays={holidays}
        initialCoverageStatuses={coverageStatuses}
      />
    </div>
  );
}
