import { createClient } from "@/lib/supabase/server";
import { getScheduleData } from "@/lib/schedule/queries";
import { getClassProgress } from "@/lib/schedule/sessions";
import { NextResponse } from "next/server";

function formatDateLA(date) {
  const la = new Date(date.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const y = la.getFullYear();
  const m = String(la.getMonth() + 1).padStart(2, "0");
  const d = String(la.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export async function GET() {
  const supabase = await createClient();

  // Check admin role
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const scheduleData = await getScheduleData();
  const today = formatDateLA(new Date());

  // Compute session progress for each class
  const progressMap = {};

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
        // Use stored end_date if available, otherwise compute from target_sessions
        let endDate = cls.end_date || null;
        let status = "running";

        if (cls.start_date && cls.days?.length > 0) {
          try {
            const progress = await getClassProgress(classData);
            sessionsDone = progress.sessionsDone;
            totalSessions = progress.totalSessions;
            // Only use computed endDate if no stored end_date
            if (!cls.end_date) {
              endDate = progress.endDate;
            }

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

        progressMap[cls.id] = {
          sessionsDone,
          totalSessions,
          endDate,
          status,
        };
      }
    }
  }

  return NextResponse.json({ scheduleData, progressMap, today });
}
