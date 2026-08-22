import { createClient } from "@/lib/supabase/server";
import { getScheduleData } from "@/lib/schedule/queries";
import { NextResponse } from "next/server";

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
  return NextResponse.json(scheduleData);
}
