import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getInstructorDetail } from "@/lib/instructors/queries";
import { getInstructorFile } from "@/lib/instructor-notes/queries";
import { getAttendance } from "@/lib/instructors/attendance";
import InstructorDetail from "./InstructorDetail";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const { id } = await params;
  const instructor = await getInstructorDetail(id);

  if (!instructor) {
    return { title: "Instructor Not Found | Admin" };
  }

  return {
    title: `${instructor.full_name} | Instructors | Admin`,
  };
}

export default async function InstructorDetailPage({ params }) {
  const { id } = await params;
  const supabase = await createClient();

  const [instructor, districtsResult] = await Promise.all([
    getInstructorDetail(id),
    supabase.from("districts").select("id, name, color").order("name"),
  ]);

  if (!instructor) {
    redirect("/admin/instructors");
  }

  const districts = districtsResult?.data || [];

  // Fetch notes data
  let notesData = null;
  try {
    notesData = await getInstructorFile(id, true);
  } catch (err) {
    console.error("Error fetching instructor file:", err);
    // Notes data may not exist if tables haven't been created yet
    notesData = {
      notes: [],
      attendance: [],
      summary: {
        pay: { currentRate: null, effectiveDate: null, previousRate: null },
        attendance: { total: 0, byReason: {}, withoutSub: 0 },
        reviews: { nextReviewDate: null, lastReviewDate: null, averageRating: null, isOverdue: false },
        latestDisciplinary: null,
        openFollowUpCount: 0,
        openFollowUps: [],
        expiringTraining: [],
      },
    };
  }

  // Fetch attendance data
  let attendanceData = null;
  try {
    attendanceData = await getAttendance(id);
  } catch (err) {
    console.error("Error fetching attendance data:", err);
    // Attendance data may not exist if tables haven't been created yet
    attendanceData = {
      daysOut: [],
      stats: {
        totalDaysOut: 0,
        classesScheduled: 0,
        oneInN: null,
        withWeekNotice: 0,
        totalWithNotice: 0,
        sameDayByReason: [],
        classesWithoutSub: 0,
        timesSubbed: 0,
      },
      monthByMonth: Array(12).fill(null),
      byReason: {},
      coveredForOthers: [],
      requests: [],
    };
  }

  // Fetch calendar sync status (without token for privacy)
  let calendarSyncStatus = null;
  try {
    const { data: calendarFeed } = await supabase
      .from("calendar_feeds")
      .select("enabled, calendar_app")
      .eq("profile_id", id)
      .single();
    calendarSyncStatus = calendarFeed;
  } catch {
    // Table may not exist yet
  }

  // Fetch pay rate
  let payRate = null;
  try {
    const { data: payRateData } = await supabase
      .from("instructor_pay_rates")
      .select("rate_per_class")
      .eq("profile_id", id)
      .single();
    payRate = payRateData?.rate_per_class ?? null;
  } catch {
    // Table may not exist yet
  }

  return (
    <Suspense fallback={null}>
      <InstructorDetail
        instructor={instructor}
        districts={districts}
        notesData={notesData}
        attendanceData={attendanceData}
        calendarSyncStatus={calendarSyncStatus}
        payRate={payRate}
      />
    </Suspense>
  );
}
