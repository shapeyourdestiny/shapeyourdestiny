import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getScheduleData } from "@/lib/schedule/queries";
import { getClassProgress } from "@/lib/schedule/sessions";
import ProgramsClient from "./ProgramsClient";

export const metadata = {
  title: "Programs | Admin | Shape Your Destiny",
};

/**
 * Format a date as YYYY-MM-DD in America/Los_Angeles timezone
 */
function formatDateLA(date) {
  const la = new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = la.getFullYear();
  const m = String(la.getMonth() + 1).padStart(2, "0");
  const d = String(la.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default async function AdminProgramsPage() {
  const supabase = await createClient();

  // Check admin role
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

  // Fetch schedule data
  const scheduleData = await getScheduleData();
  const today = formatDateLA(new Date());

  // Compute session progress for each class
  const classesWithProgress = [];

  for (const district of scheduleData.districts) {
    for (const school of district.schools || []) {
      for (const cls of school.classes || []) {
        const classData = {
          startDate: cls.start_date,
          days: cls.days || [],
          targetSessions: cls.target_sessions,
          program: cls.program || "wellness",
          districtId: district.id,
          schoolId: school.id,
        };

        let sessionsDone = 0;
        let totalSessions = null;
        let endDate = null;
        let status = "running";

        if (cls.start_date && cls.days?.length > 0) {
          try {
            const progress = await getClassProgress(classData);
            sessionsDone = progress.sessionsDone;
            totalSessions = progress.totalSessions;
            endDate = progress.endDate;

            // Determine status
            if (cls.start_date > today) {
              status = "starts_soon";
            } else if (totalSessions && endDate && endDate < today) {
              status = "ended";
            } else {
              status = "running";
            }
          } catch (e) {
            console.error("Error computing progress for class:", cls.id, e);
          }
        }

        classesWithProgress.push({
          classId: cls.id,
          sessionsDone,
          totalSessions,
          endDate,
          status,
        });
      }
    }
  }

  // Build a map for quick lookup
  const progressMap = {};
  for (const cp of classesWithProgress) {
    progressMap[cp.classId] = cp;
  }

  return (
    <ProgramsClient
      initialData={scheduleData}
      progressMap={progressMap}
      today={today}
    />
  );
}
