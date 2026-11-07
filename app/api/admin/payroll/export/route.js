import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getPeriodForDate } from "@/lib/payroll/schedule.js";
import { getPeriodView, getPayrollSettings } from "@/lib/payroll/compute.js";

const DEFAULT_SETTINGS = {
  anchorDate: "2026-09-05",
  periodDays: 14,
  dueOffsetDays: 7,
  paydayOffsetDays: 14,
};

function formatMoney(amount) {
  if (amount === null || amount === undefined) return "";
  return parseFloat(amount).toFixed(2);
}

function formatDate(dateStr) {
  if (!dateStr) return "";
  return dateStr; // Keep as YYYY-MM-DD for CSV
}

function escapeCSV(value) {
  if (value === null || value === undefined) return "";
  const str = String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export async function GET(request) {
  const supabase = await createClient();

  // Verify admin
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, role, full_name")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Get period from query params
  const { searchParams } = new URL(request.url);
  const periodStart = searchParams.get("period");

  if (!periodStart) {
    return NextResponse.json({ error: "Period required" }, { status: 400 });
  }

  // Get settings and period
  const settings = await getPayrollSettings();
  const effectiveSettings = { ...DEFAULT_SETTINGS, ...settings };
  const period = getPeriodForDate(periodStart, effectiveSettings);

  if (!period) {
    return NextResponse.json({ error: "Invalid period" }, { status: 400 });
  }

  // Get period data
  const periodData = await getPeriodView(period);

  if (periodData.error) {
    return NextResponse.json({ error: periodData.error }, { status: 500 });
  }

  // Build CSV
  const lines = [];

  // Header
  lines.push([
    "Instructor",
    "Classes Taught",
    "Classes Subbed",
    "Total Classes",
    "Rate(s)",
    "Adjustments",
    "Total Pay",
  ].map(escapeCSV).join(","));

  // Summary rows
  for (const instructor of periodData.instructors || []) {
    const taughtClasses = instructor.lines
      .filter((l) => l.source === "taught" && l.paid)
      .reduce((sum, l) => sum + (l.classes || 0), 0);

    const subbedClasses = instructor.lines
      .filter((l) => l.source === "subbed" && l.paid)
      .reduce((sum, l) => sum + (l.classes || 0), 0);

    const adjTotal = instructor.adjustments.reduce(
      (sum, a) => sum + parseFloat(a.amount),
      0
    );

    lines.push([
      instructor.fullName,
      taughtClasses,
      subbedClasses,
      instructor.totalClasses,
      instructor.rates.map((r) => `$${formatMoney(r)}`).join("; "),
      adjTotal !== 0 ? formatMoney(adjTotal) : "",
      formatMoney(instructor.totalAmount),
    ].map(escapeCSV).join(","));
  }

  // Empty line before detail section
  lines.push("");
  lines.push("");

  // Detail header
  lines.push([
    "Instructor",
    "Date",
    "School",
    "Program",
    "Time",
    "Type",
    "Classes",
    "Rate",
    "Amount",
    "Paid",
    "Reason",
  ].map(escapeCSV).join(","));

  // Detail rows
  for (const instructor of periodData.instructors || []) {
    for (const line of instructor.lines) {
      if (line.isUpcoming) continue; // Skip upcoming

      lines.push([
        instructor.fullName,
        formatDate(line.date),
        line.schoolName,
        line.program || "",
        line.time || "",
        line.source,
        line.classes || 1,
        line.rate !== null ? formatMoney(line.rate) : "",
        line.amount !== null ? formatMoney(line.amount) : "",
        line.paid ? "Yes" : "No",
        line.reason || "",
      ].map(escapeCSV).join(","));
    }

    // Add adjustments
    for (const adj of instructor.adjustments) {
      lines.push([
        instructor.fullName,
        "",
        "",
        "",
        "",
        "Adjustment",
        "",
        "",
        formatMoney(adj.amount),
        "Yes",
        adj.label + (adj.note ? ` - ${adj.note}` : ""),
      ].map(escapeCSV).join(","));
    }
  }

  // Log export
  const { data: periodRecord } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("start_date", period.startDate)
    .single();

  if (periodRecord) {
    await supabase.from("payroll_activity").insert({
      period_id: periodRecord.id,
      kind: "export",
      text: "CSV exported",
      actor: profile.full_name,
    });
  }

  // Return CSV
  const csv = lines.join("\n");
  const filename = `payroll-${period.startDate}-to-${period.endDate}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
