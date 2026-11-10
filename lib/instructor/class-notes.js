import { createClient } from "@/lib/supabase/server";

/**
 * Get a class note for a specific instructor, class, and session date.
 */
export async function getClassNote(profileId, classId, sessionDate) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_notes")
    .select("*")
    .eq("profile_id", profileId)
    .eq("class_id", classId)
    .eq("session_date", sessionDate)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Error fetching class note:", error);
    return null;
  }

  return data;
}

/**
 * Get all class notes for an instructor within a date range.
 */
export async function getClassNotes(profileId, startDate, endDate) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_notes")
    .select(`
      *,
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .eq("profile_id", profileId)
    .gte("session_date", startDate)
    .lte("session_date", endDate)
    .order("session_date", { ascending: false });

  if (error) {
    console.error("Error fetching class notes:", error);
    return [];
  }

  return data || [];
}

/**
 * Get class notes for a specific class (for admin ClassPanel).
 */
export async function getClassNotesForClass(classId, limit = 10) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_notes")
    .select(`
      *,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq("class_id", classId)
    .order("session_date", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Error fetching class notes for class:", error);
    return [];
  }

  return data || [];
}

/**
 * Get class notes for an instructor (for admin NotesHistory).
 */
export async function getClassNotesForInstructor(profileId) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("class_notes")
    .select(`
      *,
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .eq("profile_id", profileId)
    .order("session_date", { ascending: false });

  if (error) {
    console.error("Error fetching class notes for instructor:", error);
    return [];
  }

  return data || [];
}

/**
 * Get notes that need admin attention for admin inbox.
 * Returns notes with any star rating ≤2 or needs_supplies=true.
 */
export async function getToughClassNotes(sinceDate = null) {
  const supabase = await createClient();

  // Default to last 7 days
  if (!sinceDate) {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    sinceDate = d.toISOString().split("T")[0];
  }

  const { data, error } = await supabase
    .from("class_notes")
    .select(`
      *,
      profile:profile_id (
        id,
        full_name,
        avatar_url
      ),
      classes:class_id (
        id,
        program,
        time,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .or("overall.lte.2,attention.lte.2,behavior.lte.2,needs_supplies.eq.true")
    .gte("created_at", sinceDate)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching class notes needing attention:", error);
    return [];
  }

  return data || [];
}

/**
 * Get 30-day averages for a class.
 */
export async function getClassAverages(classId) {
  const supabase = await createClient();

  // Get notes from last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sinceDate = thirtyDaysAgo.toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("class_notes")
    .select("overall, attention, behavior")
    .eq("class_id", classId)
    .gte("session_date", sinceDate);

  if (error) {
    console.error("Error fetching class averages:", error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const count = data.length;
  const overallSum = data.reduce((sum, n) => sum + (n.overall || 0), 0);
  const attentionValues = data.filter((n) => n.attention != null);
  const behaviorValues = data.filter((n) => n.behavior != null);

  return {
    count,
    overall: overallSum / count,
    attention: attentionValues.length > 0
      ? attentionValues.reduce((sum, n) => sum + n.attention, 0) / attentionValues.length
      : null,
    behavior: behaviorValues.length > 0
      ? behaviorValues.reduce((sum, n) => sum + n.behavior, 0) / behaviorValues.length
      : null,
  };
}
