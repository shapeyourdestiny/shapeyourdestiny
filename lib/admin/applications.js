import { createClient } from "@/lib/supabase/server";

/**
 * Get count of new applications that haven't been opened by any admin.
 * Used for the sidebar badge.
 */
export async function getNewApplicationsCount() {
  const supabase = await createClient();

  const { count, error } = await supabase
    .from("instructor_applications")
    .select("*", { count: "exact", head: true })
    .eq("status", "new")
    .is("opened_at", null);

  if (error) {
    // Table might not exist yet
    if (!error.message?.includes("does not exist")) {
      console.error("Error fetching applications count:", error);
    }
    return 0;
  }

  return count || 0;
}

/**
 * Get all applications grouped by status.
 */
export async function getApplications() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_applications")
    .select(`
      id,
      created_at,
      first_name,
      last_name,
      email,
      phone,
      message,
      resume_path,
      resume_name,
      resume_size,
      status,
      opened_at,
      status_changed_at,
      profile_id
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error fetching applications:", error);
    return { new: [], reviewing: [], interview: [], hired: [], not_a_fit: [] };
  }

  // Group by status
  const grouped = {
    new: [],
    reviewing: [],
    interview: [],
    hired: [],
    not_a_fit: [],
  };

  (data || []).forEach((app) => {
    if (grouped[app.status]) {
      grouped[app.status].push(app);
    }
  });

  return grouped;
}

/**
 * Get a single application by ID with notes.
 */
export async function getApplicationById(id) {
  const supabase = await createClient();

  const { data: application, error } = await supabase
    .from("instructor_applications")
    .select(`
      id,
      created_at,
      first_name,
      last_name,
      email,
      phone,
      message,
      resume_path,
      resume_name,
      resume_size,
      status,
      opened_at,
      status_changed_at,
      profile_id
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching application:", error);
    return null;
  }

  // Get notes
  const { data: notes } = await supabase
    .from("instructor_application_notes")
    .select(`
      id,
      body,
      is_system,
      created_at,
      author:author_id (
        id,
        full_name
      )
    `)
    .eq("application_id", id)
    .order("created_at", { ascending: false });

  return {
    ...application,
    notes: notes || [],
  };
}

/**
 * Get hiring settings.
 */
export async function getHiringSettings() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("hiring_settings")
    .select("hiring_open, notify_emails")
    .eq("id", 1)
    .single();

  if (error) {
    // Table might not exist yet
    return { hiring_open: true, notify_emails: [] };
  }

  return data;
}

/**
 * Get new applications for the admin inbox.
 */
export async function getNewApplicationsForInbox() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("instructor_applications")
    .select(`
      id,
      created_at,
      first_name,
      last_name
    `)
    .eq("status", "new")
    .is("opened_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    // Table might not exist yet
    return [];
  }

  return data || [];
}
