import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getTodayLA, formatPeriodRangeShort, addDays } from "@/lib/payroll/schedule.js";
import { sendPayrollReminderEmail } from "@/lib/email";

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";

// Default payroll settings
const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

/**
 * Cron route for payroll reminders.
 * Runs daily to check if reminders should be sent.
 *
 * Reminder triggers (configurable in settings):
 * - period_ended: When a period ends and needs approval
 * - days_before_due: X days before due date
 * - due_date: On the due date itself
 */
export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = getTodayLA();

  // Get payroll settings
  const { data: settingsData } = await supabase
    .from("payroll_settings")
    .select("*")
    .eq("id", 1)
    .single();

  const settings = { ...DEFAULT_SETTINGS, ...settingsData };
  const reminderEmails = settings.reminder_emails || [];
  const reminders = settings.reminders || {};

  if (reminderEmails.length === 0) {
    return NextResponse.json({ message: "No reminder emails configured" });
  }

  // Get periods needing approval
  const { data: openPeriods } = await supabase
    .from("payroll_periods")
    .select("*")
    .lt("end_date", today)
    .eq("status", "open")
    .order("start_date", { ascending: true });

  if (!openPeriods || openPeriods.length === 0) {
    return NextResponse.json({ message: "No periods need approval" });
  }

  // Check which reminders should fire today
  const emailsSent = [];

  for (const period of openPeriods) {
    const periodEndPlusOne = addDays(period.end_date, 1);
    const daysUntilDue = Math.ceil(
      (new Date(period.due_date) - new Date(today)) / (1000 * 60 * 60 * 24)
    );

    let shouldSend = false;
    let reason = null;

    // Check reminder triggers
    if (reminders.period_ended && today === periodEndPlusOne) {
      shouldSend = true;
      reason = "period_ended";
    } else if (reminders.days_before_due && daysUntilDue === reminders.days_before_due) {
      shouldSend = true;
      reason = `${reminders.days_before_due}_days_before_due`;
    } else if (reminders.due_date && today === period.due_date) {
      shouldSend = true;
      reason = "due_date";
    }

    // Default: send on period end + 1 day if no reminders configured
    if (Object.keys(reminders).length === 0 && today === periodEndPlusOne) {
      shouldSend = true;
      reason = "default_period_ended";
    }

    if (shouldSend) {
      try {
        await sendPayrollReminderEmail({
          to: reminderEmails,
          periodRange: formatPeriodRangeShort(period.start_date, period.end_date),
          dueDate: period.due_date,
          payday: period.payday,
          periodsCount: openPeriods.length,
          payrollUrl: `${BASE_URL}/admin/payroll`,
        });

        emailsSent.push({
          period: period.start_date,
          reason,
        });

        // Log the reminder
        await supabase.from("payroll_activity").insert({
          period_id: period.id,
          kind: "reminder",
          text: `Reminder email sent (${reason})`,
          actor: "System",
        });

        // Only send one email per cron run (includes all periods)
        break;
      } catch (error) {
        console.error("Failed to send payroll reminder:", error);
      }
    }
  }

  return NextResponse.json({
    message: emailsSent.length > 0 ? "Reminders sent" : "No reminders triggered today",
    emailsSent,
    periodsNeedingApproval: openPeriods.length,
  });
}
