import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  getPeriodForDate,
  getNextPeriod,
  getPreviousPeriod,
  getTodayLA,
} from "@/lib/payroll/schedule.js";
import {
  getPeriodView,
  getPayrollHistory,
  getDefaultPeriod,
  getPayrollSettings,
} from "@/lib/payroll/compute.js";
import PayrollClient from "./PayrollClient";

export const metadata = {
  title: "Payroll | Admin",
  description: "Review and approve instructor payroll",
};

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

export default async function PayrollPage({ searchParams }) {
  const supabase = await createClient();

  // Verify admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Get settings
  const settings = await getPayrollSettings();
  const effectiveSettings = { ...DEFAULT_SETTINGS, ...settings };

  // Support ?today= override in development
  let today = getTodayLA();
  const params = await searchParams;
  if (process.env.NODE_ENV === "development" && params?.today) {
    today = params.today;
  }

  // Determine which period to show
  let periodStartDate = params?.period;
  let period;

  if (periodStartDate) {
    period = getPeriodForDate(periodStartDate, effectiveSettings);
  } else {
    const defaultInfo = await getDefaultPeriod();
    period = defaultInfo.period;
  }

  if (!period) {
    // Fall back to current period
    period = getPeriodForDate(today, effectiveSettings);
  }

  // Get period data
  const periodData = await getPeriodView(period, today);

  // Get navigation info
  const prevPeriod = getPreviousPeriod(period, effectiveSettings);
  const nextPeriod = getNextPeriod(period, effectiveSettings);
  const isPrevValid = prevPeriod && prevPeriod.startDate >= effectiveSettings.anchorDate;
  const isNextValid = nextPeriod && nextPeriod.startDate <= today;

  // Get history
  const history = await getPayrollHistory(20);

  // Count periods needing approval
  const { count: periodsNeedingApproval } = await supabase
    .from("payroll_periods")
    .select("*", { count: "exact", head: true })
    .lt("end_date", today)
    .eq("status", "open");

  return (
    <PayrollClient
      today={today}
      period={period}
      periodData={periodData}
      prevPeriod={isPrevValid ? prevPeriod : null}
      nextPeriod={isNextValid ? nextPeriod : null}
      history={history}
      settings={effectiveSettings}
      periodsNeedingApproval={periodsNeedingApproval || 0}
    />
  );
}
