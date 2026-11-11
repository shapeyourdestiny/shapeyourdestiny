/**
 * Session Reviews Library
 * ========================
 * Handles session review logic: computing who qualifies for reviews,
 * fetching review data, and submitting reviews.
 */

import { createClient } from "@/lib/supabase/server";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";
import { SlotStatus } from "@/lib/schedule/session-staff";

const MIN_CLASSES_FOR_REVIEW = 3;
const MIN_CLASSES_TOGETHER_FOR_COWORKER = 2;
const REVIEW_DUE_DAYS = 7;

/**
 * Check if an instructor taught a class on a specific date.
 * Returns true if they were the actual teacher (normal, sub, or one-time).
 */
function didInstructorTeachOnDate(profileId, sessionStaffOnDate, sessionChanges, classId, date) {
  // Check session changes first
  const changesOnDate = sessionChanges.filter(
    (sc) => sc.class_id === classId && sc.session_date === date
  );

  for (const change of changesOnDate) {
    // Instructor is a sub on this date
    if (change.sub_profile_id === profileId) {
      return true;
    }
    // Instructor is out on this date
    if (change.absent_profile_id === profileId) {
      return false;
    }
  }

  // Check if they're a regular instructor
  for (const slot of ["instructor_1", "instructor_2"]) {
    const state = sessionStaffOnDate?.[slot];
    if (state?.actualInstructor?.id === profileId) {
      return true;
    }
    if (state?.regularInstructor?.id === profileId && state.status === SlotStatus.NORMAL) {
      return true;
    }
  }

  return false;
}

/**
 * Compute session statistics for an instructor and a class.
 * Returns info about classes taught, last class date, and co-instructors.
 */
export async function computeSessionStats(supabase, classId, profileId, sessionStart, sessionEnd) {
  // Get the class with school and assignments
  const { data: cls } = await supabase
    .from("classes")
    .select(`
      id,
      days,
      time,
      start_date,
      end_date,
      target_sessions,
      program,
      school_id,
      schools:school_id (
        id,
        name,
        district_id
      )
    `)
    .eq("id", classId)
    .single();

  if (!cls) return null;

  // Get assignments for this class
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      slot_type,
      profile_id,
      profiles:profile_id (id, full_name, avatar_url)
    `)
    .eq("class_id", classId)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  cls.assignments = (assignments || []).map((a) => ({
    slotType: a.slot_type,
    profile: a.profiles,
  }));

  // Get holidays and program off days
  const [{ data: holidays }, { data: programOffDays }] = await Promise.all([
    supabase
      .from("holidays")
      .select("date, name, time_period")
      .gte("date", sessionStart)
      .lte("date", sessionEnd),
    supabase
      .from("program_off_days")
      .select("date, reason, time_period")
      .eq("program", cls.program || "wellness")
      .gte("date", sessionStart)
      .lte("date", sessionEnd),
  ]);

  // Compute actual class occurrences
  const sessionsResult = computeClassOccurrences({
    startDate: sessionStart,
    days: cls.days,
    targetSessions: null, // Use date range
    holidays: holidays || [],
    programOffDays: programOffDays || [],
    rangeEnd: sessionEnd,
    classTime: cls.time,
  });

  // Get session changes for this class in the date range
  const { data: sessionChanges } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      absent_profile_id,
      sub_profile_id,
      absentProfile:profiles!session_changes_absent_profile_id_fkey (id, full_name),
      subProfile:profiles!session_changes_sub_profile_id_fkey (id, full_name)
    `)
    .eq("class_id", classId)
    .gte("session_date", sessionStart)
    .lte("session_date", sessionEnd);

  // Count classes taught by this instructor
  let classesTaught = 0;
  let lastClassDate = null;
  const coworkerCounts = new Map(); // profile_id -> count

  for (const occ of sessionsResult.occurrences) {
    const date = occ.date;

    // Build session staff state for this date
    const sessionStaffOnDate = buildSessionStaffOnDate(cls, sessionChanges || [], date);

    // Check if instructor taught on this date
    if (didInstructorTeachOnDate(profileId, sessionStaffOnDate, sessionChanges || [], classId, date)) {
      classesTaught++;
      lastClassDate = date;

      // Find co-instructors on this date
      for (const slot of ["instructor_1", "instructor_2"]) {
        const state = sessionStaffOnDate[slot];
        const actualInstructorId = state?.actualInstructor?.id;
        if (actualInstructorId && actualInstructorId !== profileId) {
          coworkerCounts.set(
            actualInstructorId,
            (coworkerCounts.get(actualInstructorId) || 0) + 1
          );
        }
      }
    }
  }

  // Build co-workers list (only those with >= MIN_CLASSES_TOGETHER_FOR_COWORKER)
  const coworkers = [];
  for (const [coworkerId, count] of coworkerCounts) {
    if (count >= MIN_CLASSES_TOGETHER_FOR_COWORKER) {
      // Get coworker profile
      const { data: coworkerProfile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .eq("id", coworkerId)
        .single();

      if (coworkerProfile) {
        coworkers.push({
          id: coworkerId,
          full_name: coworkerProfile.full_name,
          avatar_url: coworkerProfile.avatar_url,
          classesTogether: count,
        });
      }
    }
  }

  return {
    classesTaught,
    lastClassDate,
    coworkers,
    school: cls.schools,
    program: cls.program,
    totalSessions: sessionsResult.occurrences.length,
  };
}

/**
 * Build session staff state for a single date.
 */
function buildSessionStaffOnDate(cls, sessionChanges, date) {
  const result = {
    instructor_1: null,
    instructor_2: null,
  };

  for (const slot of ["instructor_1", "instructor_2"]) {
    const regularAssignment = (cls.assignments || []).find((a) => a.slotType === slot);
    const regularInstructor = regularAssignment?.profile || null;

    // Check for session changes on this date for this slot
    const change = sessionChanges.find(
      (sc) => sc.session_date === date && sc.slot_type === slot
    );

    if (change) {
      if (change.sub_profile_id) {
        result[slot] = {
          status: change.absent_profile_id ? SlotStatus.SUB : SlotStatus.ONE_TIME,
          regularInstructor,
          actualInstructor: change.subProfile || { id: change.sub_profile_id },
          absentInstructor: change.absentProfile || null,
        };
      } else if (change.absent_profile_id) {
        result[slot] = {
          status: SlotStatus.NEEDS_SUB,
          regularInstructor,
          actualInstructor: null,
          absentInstructor: change.absentProfile || { id: change.absent_profile_id },
        };
      }
    } else if (regularInstructor) {
      result[slot] = {
        status: SlotStatus.NORMAL,
        regularInstructor,
        actualInstructor: regularInstructor,
        absentInstructor: null,
      };
    } else {
      result[slot] = {
        status: SlotStatus.EMPTY,
        regularInstructor: null,
        actualInstructor: null,
        absentInstructor: null,
      };
    }
  }

  return result;
}

/**
 * Get pending session reviews for the current instructor.
 * Used by inbox and reminder screen.
 */
export async function getMyPendingReviews() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_pending_session_reviews");

  if (error) {
    console.error("Error fetching pending reviews:", error);
    return [];
  }

  return data || [];
}

/**
 * Get a session review by ID for the current instructor.
 */
export async function getMyReview(reviewId) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) return null;

  // Get the review
  const { data: review, error } = await supabase
    .from("session_reviews")
    .select(`
      *,
      classes:class_id (
        id,
        program,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .eq("id", reviewId)
    .eq("profile_id", profile.id)
    .single();

  if (error || !review) return null;

  // Get coworker rows for this review
  const { data: coworkers } = await supabase
    .from("session_review_coworkers")
    .select(`
      id,
      coworker_id,
      classes_together,
      rating,
      comment,
      profiles:coworker_id (
        id,
        full_name,
        avatar_url
      )
    `)
    .eq("review_id", reviewId);

  // Get shout-outs received during this session
  const { data: shoutOuts } = await supabase.rpc("get_session_shoutouts", {
    p_profile_id: profile.id,
    p_class_id: review.class_id,
    p_session_start: review.session_start,
    p_session_end: review.session_end,
  });

  // Count unique teammates during the session
  const stats = await computeSessionStats(
    supabase,
    review.class_id,
    profile.id,
    review.session_start,
    review.session_end
  );

  return {
    ...review,
    profileName: profile.full_name,
    coworkers: coworkers || [],
    shoutOuts: shoutOuts || [],
    teammatesCount: stats?.coworkers.length || 0,
    shoutOutsCount: (shoutOuts || []).length,
  };
}

/**
 * Save a session review draft (auto-save while filling out).
 */
export async function saveReviewDraft(reviewId, data) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) return { error: "Profile not found" };

  // Update the review (only answer fields, must be pending)
  const { error } = await supabase
    .from("session_reviews")
    .update({
      overall: data.overall || null,
      kids_growth: data.kidsGrowth || null,
      support: data.support || null,
      went_well: data.wentWell || null,
      change_next: data.changeNext || null,
      needs: data.needs || null,
    })
    .eq("id", reviewId)
    .eq("profile_id", profile.id)
    .eq("status", "pending");

  if (error) {
    console.error("Error saving review draft:", error);
    return { error: error.message };
  }

  // Update coworker ratings
  if (data.coworkerRatings && Array.isArray(data.coworkerRatings)) {
    for (const cw of data.coworkerRatings) {
      await supabase
        .from("session_review_coworkers")
        .update({
          rating: cw.rating || null,
          comment: cw.comment || null,
        })
        .eq("review_id", reviewId)
        .eq("coworker_id", cw.coworkerId);
    }
  }

  return { success: true };
}

/**
 * Submit a completed session review.
 */
export async function submitReview(reviewId, data) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated" };

  // Get profile ID
  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) return { error: "Profile not found" };

  // Validate required fields
  if (!data.overall || !data.kidsGrowth || !data.support) {
    return { error: "All star ratings are required" };
  }
  if (!data.wentWell || !data.changeNext) {
    return { error: "Please answer what went well and what to change" };
  }

  // Get the review to check coworker ratings
  const { data: review } = await supabase
    .from("session_reviews")
    .select("id")
    .eq("id", reviewId)
    .eq("profile_id", profile.id)
    .eq("status", "pending")
    .single();

  if (!review) {
    return { error: "Review not found or already submitted" };
  }

  // Check all coworker ratings are provided
  const { data: coworkers } = await supabase
    .from("session_review_coworkers")
    .select("id, coworker_id")
    .eq("review_id", reviewId);

  if (coworkers && coworkers.length > 0) {
    const providedRatings = new Set(
      (data.coworkerRatings || [])
        .filter((cw) => cw.rating)
        .map((cw) => cw.coworkerId)
    );

    for (const cw of coworkers) {
      if (!providedRatings.has(cw.coworker_id)) {
        return { error: "Please rate all co-instructors" };
      }
    }
  }

  // Save all data and mark as submitted
  const { error: updateError } = await supabase
    .from("session_reviews")
    .update({
      overall: data.overall,
      kids_growth: data.kidsGrowth,
      support: data.support,
      went_well: data.wentWell,
      change_next: data.changeNext,
      needs: data.needs || null,
      status: "submitted",
      submitted_at: new Date().toISOString(),
    })
    .eq("id", reviewId)
    .eq("profile_id", profile.id)
    .eq("status", "pending");

  if (updateError) {
    console.error("Error submitting review:", updateError);
    return { error: updateError.message };
  }

  // Update coworker ratings
  if (data.coworkerRatings && Array.isArray(data.coworkerRatings)) {
    for (const cw of data.coworkerRatings) {
      await supabase
        .from("session_review_coworkers")
        .update({
          rating: cw.rating,
          comment: cw.comment || null,
        })
        .eq("review_id", reviewId)
        .eq("coworker_id", cw.coworkerId);
    }
  }

  return { success: true };
}

/**
 * Get the count of pending reviews for the current instructor.
 */
export async function getPendingReviewCount() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  if (!profile) return 0;

  const { count } = await supabase
    .from("session_reviews")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", profile.id)
    .eq("status", "pending");

  return count || 0;
}

/**
 * Get all session reviews for an instructor (admin view).
 */
export async function getSessionReviewsForInstructor(profileId, limit = 20) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("session_reviews")
    .select(`
      id,
      session_start,
      session_end,
      classes_taught,
      overall,
      kids_growth,
      support,
      went_well,
      change_next,
      needs,
      due_date,
      status,
      submitted_at,
      classes:class_id (
        id,
        program,
        schools:school_id (
          id,
          name
        )
      ),
      coworkers:session_review_coworkers (
        id,
        coworker_id,
        classes_together,
        rating,
        comment,
        profiles:coworker_id (
          id,
          full_name
        )
      )
    `)
    .eq("profile_id", profileId)
    .order("session_end", { ascending: false })
    .limit(limit);

  if (error) {
    // Table might not exist yet
    if (!error.message?.includes("does not exist")) {
      console.error("Error fetching session reviews:", error);
    }
    return [];
  }

  return data || [];
}

// Export constants for use elsewhere
export { MIN_CLASSES_FOR_REVIEW, MIN_CLASSES_TOGETHER_FOR_COWORKER, REVIEW_DUE_DAYS };
