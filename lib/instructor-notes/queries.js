import { createClient } from "@/lib/supabase/server";

/**
 * Get the current school year start date (Aug 1 in LA time).
 * School year runs Aug 1 - Jul 31.
 */
function getSchoolYearStart() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  const year = laDate.getMonth() >= 7 ? laDate.getFullYear() : laDate.getFullYear() - 1;
  return `${year}-08-01`;
}

/**
 * Format a date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Get today's date as YYYY-MM-DD in America/Los_Angeles timezone
 */
function getTodayLA() {
  const now = new Date();
  const laDate = new Date(now.toLocaleString("en-US", { timeZone: "America/Los_Angeles" }));
  return formatDate(laDate);
}

/**
 * Get the complete instructor file for the Notes & History tab.
 * Returns notes, attendance history, and summary data.
 * @param {string} profileId - The instructor's profile ID
 * @param {boolean} includeArchived - Whether to include archived notes
 */
export async function getInstructorFile(profileId, includeArchived = false) {
  const supabase = await createClient();
  const today = getTodayLA();
  const schoolYearStart = getSchoolYearStart();

  // -----------------------------------------------------------------------------
  // 1. Fetch notes with author info and files
  // -----------------------------------------------------------------------------
  let notesQuery = supabase
    .from("instructor_notes")
    .select(`
      id,
      type,
      title,
      note_date,
      body,
      details,
      follow_up_date,
      follow_up_done_at,
      follow_up_note,
      archived_at,
      archived_by,
      created_at,
      created_by,
      updated_at,
      author:created_by (
        id,
        full_name
      ),
      archiver:archived_by (
        id,
        full_name
      ),
      files:instructor_note_files (
        id,
        storage_path,
        file_name,
        file_size,
        mime_type
      )
    `)
    .eq("profile_id", profileId)
    .order("note_date", { ascending: false });

  if (!includeArchived) {
    notesQuery = notesQuery.is("archived_at", null);
  }

  const { data: notes, error: notesError } = await notesQuery;

  if (notesError) {
    console.error("Error fetching instructor notes:", notesError);
  }

  // -----------------------------------------------------------------------------
  // 2. Fetch attendance records from session_changes
  // -----------------------------------------------------------------------------
  const { data: attendance, error: attendanceError } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      reason,
      sub_profile_id,
      created_at,
      subProfile:sub_profile_id (
        id,
        full_name
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
    .eq("absent_profile_id", profileId)
    .order("session_date", { ascending: false });

  if (attendanceError) {
    console.error("Error fetching attendance:", attendanceError);
  }

  // -----------------------------------------------------------------------------
  // 3. Fetch current pay rate from instructor_pay_rates
  // -----------------------------------------------------------------------------
  const { data: payRate } = await supabase
    .from("instructor_pay_rates")
    .select("rate_per_class, updated_at")
    .eq("profile_id", profileId)
    .single();

  // Also check for latest pay note to get effective date and previous rate
  const latestPayNote = (notes || []).find((n) => n.type === "pay" && !n.archived_at);
  let payInfo = {
    currentRate: payRate?.rate_per_class || null,
    effectiveDate: payRate?.updated_at || null,
    previousRate: null,
  };

  if (latestPayNote?.details) {
    payInfo = {
      currentRate: latestPayNote.details.rate_to || payRate?.rate_per_class || null,
      effectiveDate: latestPayNote.note_date || payRate?.updated_at,
      previousRate: latestPayNote.details.rate_from || null,
    };
  }

  // -----------------------------------------------------------------------------
  // 4. Calculate attendance summary for current school year
  // -----------------------------------------------------------------------------
  const thisYearAttendance = (attendance || []).filter(
    (a) => a.session_date >= schoolYearStart
  );

  const attendanceSummary = {
    total: thisYearAttendance.length,
    byReason: {},
    withoutSub: 0,
  };

  thisYearAttendance.forEach((a) => {
    const reason = a.reason || "other";
    attendanceSummary.byReason[reason] = (attendanceSummary.byReason[reason] || 0) + 1;
    if (!a.sub_profile_id) {
      attendanceSummary.withoutSub++;
    }
  });

  // -----------------------------------------------------------------------------
  // 5. Calculate review summary
  // -----------------------------------------------------------------------------
  const reviewNotes = (notes || []).filter((n) => n.type === "review" && !n.archived_at);
  let reviewSummary = {
    nextReviewDate: null,
    lastReviewDate: null,
    averageRating: null,
    isOverdue: false,
  };

  if (reviewNotes.length > 0) {
    const latestReview = reviewNotes[0];
    reviewSummary.lastReviewDate = latestReview.note_date;
    reviewSummary.nextReviewDate = latestReview.details?.next_review_date || null;
    reviewSummary.isOverdue = reviewSummary.nextReviewDate && reviewSummary.nextReviewDate < today;

    // Calculate average of all ratings
    const ratings = [];
    reviewNotes.forEach((r) => {
      if (r.details?.ratings) {
        const ratingValues = Object.values(r.details.ratings).filter((v) => typeof v === "number");
        ratings.push(...ratingValues);
      }
    });
    if (ratings.length > 0) {
      reviewSummary.averageRating = ratings.reduce((a, b) => a + b, 0) / ratings.length;
    }
  }

  // -----------------------------------------------------------------------------
  // 6. Get latest disciplinary step
  // -----------------------------------------------------------------------------
  const disciplinaryNotes = (notes || []).filter(
    (n) => n.type === "disciplinary" && !n.archived_at
  );
  let latestDisciplinary = null;

  if (disciplinaryNotes.length > 0) {
    const latest = disciplinaryNotes[0];
    latestDisciplinary = {
      step: latest.details?.step || null,
      date: latest.note_date,
      topic: latest.details?.about || null,
    };
  }

  // -----------------------------------------------------------------------------
  // 7. Count open follow-ups
  // -----------------------------------------------------------------------------
  const openFollowUps = (notes || []).filter(
    (n) => n.follow_up_date && !n.follow_up_done_at && !n.archived_at
  );

  // -----------------------------------------------------------------------------
  // 8. Get training expiring within 90 days
  // -----------------------------------------------------------------------------
  const ninetyDaysFromNow = new Date();
  ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
  const expiryThreshold = formatDate(ninetyDaysFromNow);

  const expiringTraining = (notes || [])
    .filter((n) => {
      if (n.type !== "training" || n.archived_at) return false;
      const expiresDate = n.details?.expires_date;
      return expiresDate && expiresDate <= expiryThreshold && expiresDate >= today;
    })
    .map((n) => ({
      id: n.id,
      title: n.title,
      expiresDate: n.details?.expires_date,
    }));

  // -----------------------------------------------------------------------------
  // Return complete instructor file
  // -----------------------------------------------------------------------------
  return {
    notes: notes || [],
    attendance: attendance || [],
    summary: {
      pay: payInfo,
      attendance: attendanceSummary,
      reviews: reviewSummary,
      latestDisciplinary,
      openFollowUpCount: openFollowUps.length,
      openFollowUps: openFollowUps.map((n) => ({
        id: n.id,
        title: n.title,
        followUpDate: n.follow_up_date,
      })),
      expiringTraining,
    },
  };
}

/**
 * Get version history for a specific note.
 * @param {string} noteId - The note ID
 */
export async function getNoteVersions(noteId) {
  const supabase = await createClient();

  const { data: versions, error } = await supabase
    .from("instructor_note_versions")
    .select(`
      id,
      type,
      title,
      note_date,
      body,
      details,
      follow_up_date,
      follow_up_done_at,
      follow_up_note,
      version_at,
      version_by,
      editor:version_by (
        id,
        full_name
      )
    `)
    .eq("note_id", noteId)
    .order("version_at", { ascending: false });

  if (error) {
    console.error("Error fetching note versions:", error);
    return [];
  }

  return versions || [];
}
