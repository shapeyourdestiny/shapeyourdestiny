import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();

  // Insert a test row
  const { data: inserted, error: insertError } = await supabase
    .from("ping")
    .insert({ message: "connection test" })
    .select()
    .single();

  if (insertError) {
    return Response.json(
      { error: "Insert failed", details: insertError.message },
      { status: 500 }
    );
  }

  // Read it back by ID to confirm round-trip works
  const { data: fetched, error: fetchError } = await supabase
    .from("ping")
    .select("*")
    .eq("id", inserted.id)
    .single();

  if (fetchError) {
    return Response.json(
      { error: "Fetch failed", details: fetchError.message },
      { status: 500 }
    );
  }

  return Response.json({
    success: true,
    row: fetched,
  });
}
