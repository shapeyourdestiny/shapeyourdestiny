import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPeriodForDate,
  getPreviousPeriod,
  getTodayLA,
} from "@/lib/payroll/schedule.js";
import {
  getPeriodSessions,
  needsCheck,
  getPayrollCheck,
  getPeriodNote,
  getBreakInfo,
  getFirstClassDate,
  getNextScheduledSession,
  getCheckDeadline,
  getInstructorSchools,
  getAllSchools,
} from "@/lib/payroll/checks.js";
import PastClassesClient from "./PastClassesClient";

export const metadata = {
  title: "Past Classes | Shape Your Destiny",
  description: "View your teaching history and confirm classes for payroll.",
};

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

export default async function PastClassesPage({ searchParams }) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect("/instructor-login");
  }

  // Get profile
  let profile = null;
  const { data: profileByUserId } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("user_id", user.id)
    .single();

  if (profileByUserId) {
    profile = profileByUserId;
  } else {
    const { data: profileById } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("id", user.id)
      .single();
    profile = profileById;
  }

  if (!profile) {
    redirect("/instructor-login");
  }

  // Allow dev override for testing: ?today=YYYY-MM-DD
  const params = await searchParams;
  let today = getTodayLA();
  if (process.env.NODE_ENV === "development" && params?.today) {
    today = params.today;
  }

  // Get current period
  const currentPeriod = getPeriodForDate(today, DEFAULT_SETTINGS);

  // Parse period from URL or use current
  let selectedPeriodStart = params?.period || currentPeriod?.startDate;
  let period = getPeriodForDate(selectedPeriodStart, DEFAULT_SETTINGS);

  // If no valid period, use current
  if (!period) {
    period = currentPeriod;
    selectedPeriodStart = currentPeriod?.startDate;
  }

  // Get first class date for navigation limits
  const firstClassDate = await getFirstClassDate(profile.id);
  const minPeriodStart = firstClassDate
    ? getPeriodForDate(firstClassDate, DEFAULT_SETTINGS)?.startDate
    : DEFAULT_SETTINGS.anchorDate;

  // Get check settings
  const deadline = await getCheckDeadline(period.endDate);

  // Get sessions for this period
  const sessions = await getPeriodSessions(profile.id, period, today);

  // Calculate counts
  const taughtCount = sessions.filter((s) => s.type === "taught").length;
  const subbedCount = sessions.filter((s) => s.type === "subbed").length;
  const offCount = sessions.filter((s) => s.type === "off").length;
  const upcomingCount = sessions.filter((s) => s.type === "upcoming").length;

  const isPeriodEnded = period.endDate < today;
  const isCurrentPeriod = period.startDate === currentPeriod?.startDate;
  const isEmpty = taughtCount === 0 && subbedCount === 0 && offCount === 0;

  // Check if needs confirmation
  const needsConfirmation = await needsCheck(profile.id, period, today);

  // Get existing check
  const payrollCheck = await getPayrollCheck(profile.id, period.startDate);

  // Get period note
  const periodNote = await getPeriodNote(period.startDate);

  // Get break info for empty periods
  let breakInfo = null;
  let nextSession = null;
  if (isEmpty && isPeriodEnded) {
    breakInfo = await getBreakInfo(profile.id, period);
    nextSession = await getNextScheduledSession(profile.id, period.endDate);
  }

  // Get last period with classes (for empty state)
  let lastPeriodWithClasses = null;
  if (isEmpty) {
    let checkPeriod = getPreviousPeriod(period, DEFAULT_SETTINGS);
    let attempts = 0;
    while (checkPeriod && attempts < 12) {
      const checkSessions = await getPeriodSessions(profile.id, checkPeriod, today);
      const checkHasWork = checkSessions.some((s) => s.type === "taught" || s.type === "subbed");
      if (checkHasWork) {
        lastPeriodWithClasses = {
          ...checkPeriod,
          taughtCount: checkSessions.filter((s) => s.type === "taught").length,
          subbedCount: checkSessions.filter((s) => s.type === "subbed").length,
          payday: checkPeriod.payday,
        };
        break;
      }
      checkPeriod = getPreviousPeriod(checkPeriod, DEFAULT_SETTINGS);
      attempts++;
    }
  }

  // Get schools for the "Something's off" form
  const instructorSchools = await getInstructorSchools(profile.id);
  const allSchools = await getAllSchools();

  return (
    <PastClassesClient
      today={today}
      period={period}
      minPeriodStart={minPeriodStart}
      sessions={sessions}
      taughtCount={taughtCount}
      subbedCount={subbedCount}
      offCount={offCount}
      upcomingCount={upcomingCount}
      isPeriodEnded={isPeriodEnded}
      isCurrentPeriod={isCurrentPeriod}
      isEmpty={isEmpty}
      needsConfirmation={needsConfirmation}
      payrollCheck={payrollCheck}
      periodNote={periodNote}
      breakInfo={breakInfo}
      nextSession={nextSession}
      lastPeriodWithClasses={lastPeriodWithClasses}
      deadline={deadline}
      instructorSchools={instructorSchools}
      allSchools={allSchools}
      payrollSettings={DEFAULT_SETTINGS}
    />
  );
}
