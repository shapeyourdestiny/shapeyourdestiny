import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSurveySend, getSendByDistrictId } from "@/lib/surveys/sends";
import { getSurvey } from "@/lib/surveys";

export async function POST(request, { params }) {
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

  const { slug } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  try {
    const { districtId, schools } = await request.json();

    if (!districtId) {
      return NextResponse.json({ error: "District is required" }, { status: 400 });
    }

    if (!schools || !Array.isArray(schools) || schools.length === 0) {
      return NextResponse.json({ error: "At least one school is required" }, { status: 400 });
    }

    // Check if a send already exists for this district
    const existing = await getSendByDistrictId(slug, districtId);
    if (existing) {
      return NextResponse.json(
        { error: "A link for this district already exists" },
        { status: 400 }
      );
    }

    // Get district name for the link slug
    const { data: district } = await supabase
      .from("districts")
      .select("name")
      .eq("id", districtId)
      .single();

    if (!district) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    const send = await createSurveySend({
      surveySlug: slug,
      districtId,
      districtName: district.name,
      schools,
    });

    return NextResponse.json({ success: true, send });
  } catch (error) {
    console.error("Failed to create survey send:", error);
    return NextResponse.json(
      { error: error.message || "Failed to create survey send" },
      { status: 500 }
    );
  }
}
