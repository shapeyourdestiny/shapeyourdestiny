import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSchoolsForDistrict } from "@/lib/surveys/sends";

export async function GET(request, { params }) {
  const supabase = await createClient();

  // Verify user is admin
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) {
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

  const { id: districtId } = await params;

  try {
    const schools = await getSchoolsForDistrict(districtId);
    return NextResponse.json({ schools });
  } catch (error) {
    console.error("Failed to fetch schools for district:", error);
    return NextResponse.json(
      { error: "Failed to fetch schools" },
      { status: 500 }
    );
  }
}
