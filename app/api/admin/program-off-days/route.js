import { createClient } from "@/lib/supabase/server";

// GET - Fetch program off days, optionally filtered by program
export async function GET(request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  // Parse query params
  const { searchParams } = new URL(request.url);
  const program = searchParams.get("program");

  // Build query
  let query = supabase
    .from("program_off_days")
    .select("id, program, date, reason, created_at")
    .order("date", { ascending: true });

  if (program) {
    query = query.eq("program", program);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching program off days:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

// POST - Create a new program off day
export async function POST(request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { program, date, reason } = await request.json();

  if (!program || !date || !reason) {
    return Response.json({ error: "Program, date, and reason are required" }, { status: 400 });
  }

  if (!["wellness", "soccer"].includes(program)) {
    return Response.json({ error: "Invalid program" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("program_off_days")
    .insert({ program, date, reason: reason.trim() })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return Response.json({ error: "An off day already exists for this program on this date" }, { status: 400 });
    }
    console.error("Error creating program off day:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json(data);
}

// DELETE - Delete a program off day
export async function DELETE(request) {
  const supabase = await createClient();

  // Verify admin
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return Response.json({ error: "ID is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("program_off_days")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("Error deleting program off day:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
