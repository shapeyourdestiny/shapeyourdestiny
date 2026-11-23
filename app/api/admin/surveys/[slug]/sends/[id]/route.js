import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateSurveySend, deleteSurveySend } from "@/lib/surveys/sends";

export async function PATCH(request, { params }) {
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

  const { id: sendId } = await params;

  try {
    const { schools } = await request.json();

    if (!schools || !Array.isArray(schools) || schools.length === 0) {
      return NextResponse.json({ error: "At least one school is required" }, { status: 400 });
    }

    const send = await updateSurveySend(sendId, { schools });

    return NextResponse.json({ success: true, send });
  } catch (error) {
    console.error("Failed to update survey send:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update survey send" },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
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

  const { id: sendId } = await params;

  try {
    await deleteSurveySend(sendId);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to delete survey send:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete survey send" },
      { status: 500 }
    );
  }
}
