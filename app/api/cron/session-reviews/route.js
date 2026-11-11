import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";
import {
  sendSessionReviewEmail,
  sendSessionReviewReminderEmail,
} from "@/lib/email";

const MIN_CLASSES_FOR_REVIEW = 3;
const MIN_CLASSES_TOGETHER_FOR_COWORKER = 2;
const REVIEW_DUE_DAYS = 7;
const LOOKBACK_DAYS = 14; // Only create reviews for sessions ended in the last 14 days

/**
 * Format a Date as YYYY-MM-DD
 */
function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/**
 * Add days to a date string
 */
function addDays(dateStr, days) {
  const date = new Date(dateStr + "T00:00:00");
  date.setDate(date.getDate() + days);
  return formatDate(date);
}

/**
 * Get today's date in YYYY-MM-DD format (Pacific time)
 */
function getTodayLA() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(now);
}

/**
 * Session Reviews Cron Job
 *
 * Runs daily (evening Pacific time) to:
 * 1. Create reviews for sessions that just ended
 * 2. Send initial emails for new reviews
 * 3. Send reminders for pending reviews
 */
export async function GET(request) {
  // Verify cron secret
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const today = getTodayLA();
  const lookbackDate = addDays(today, -LOOKBACK_DAYS);

  const results = {
    reviewsCreated: 0,
    emailsSent: 0,
    remindersSent: 0,
    errors: [],
  };

  try {
    // =========================================================================
    // STEP 1: Find sessions that just ended and need reviews
    // =========================================================================

    // Get classes with end_date that ended within the lookback window
    const { data: endedClasses, error: classesError } = await supabase
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
      .not("end_date", "is", null)
      .lte("end_date", today)
      .gte("end_date", lookbackDate);

    if (classesError) {
      results.errors.push(`Classes query error: ${classesError.message}`);
      return NextResponse.json(results);
    }

    // For each ended class, determine which instructors qualify for a review
    for (const cls of endedClasses || []) {
      try {
        await processEndedClass(supabase, cls, today, results);
      } catch (error) {
        results.errors.push(`Error processing class ${cls.id}: ${error.message}`);
      }
    }

    // =========================================================================
    // STEP 2: Send initial emails for new reviews (emailed_at is null)
    // =========================================================================

    // Group new reviews by profile to send one email per person
    const { data: newReviews } = await supabase
      .from("session_reviews")
      .select(`
        id,
        profile_id,
        class_id,
        session_start,
        session_end,
        classes_taught,
        due_date,
        profiles:profile_id (
          id,
          email,
          full_name,
          notification_settings
        ),
        classes:class_id (
          id,
          program,
          schools:school_id (
            id,
            name
          )
        )
      `)
      .eq("status", "pending")
      .is("emailed_at", null);

    // Group by profile_id
    const reviewsByProfile = new Map();
    for (const review of newReviews || []) {
      if (!review.profiles?.email) continue;
      const key = review.profile_id;
      if (!reviewsByProfile.has(key)) {
        reviewsByProfile.set(key, []);
      }
      reviewsByProfile.get(key).push(review);
    }

    // Send emails
    for (const [profileId, reviews] of reviewsByProfile) {
      const profile = reviews[0].profiles;
      const firstName = profile.full_name?.split(" ")[0] || "there";

      // Get shout-out counts for each review
      const reviewsWithCounts = [];
      for (const review of reviews) {
        const { count } = await supabase
          .from("shout_outs")
          .select("id", { count: "exact", head: true })
          .eq("to_profile_id", profileId)
          .eq("context_class_id", review.class_id)
          .eq("status", "approved")
          .gte("context_date", review.session_start)
          .lte("context_date", review.session_end);

        reviewsWithCounts.push({
          id: review.id,
          schoolName: review.classes?.schools?.name || "Unknown School",
          program: review.classes?.program,
          classesTaught: review.classes_taught,
          sessionStart: review.session_start,
          sessionEnd: review.session_end,
          dueDate: review.due_date,
          shoutOutsCount: count || 0,
        });
      }

      try {
        await sendSessionReviewEmail({
          to: profile.email,
          firstName,
          reviews: reviewsWithCounts,
        });

        // Mark all as emailed
        const reviewIds = reviews.map((r) => r.id);
        await supabase
          .from("session_reviews")
          .update({ emailed_at: new Date().toISOString() })
          .in("id", reviewIds);

        results.emailsSent += reviews.length;
      } catch (error) {
        results.errors.push(`Email error for ${profile.email}: ${error.message}`);
      }
    }

    // =========================================================================
    // STEP 3: Send reminders for pending reviews
    // =========================================================================

    const { data: pendingReviews } = await supabase
      .from("session_reviews")
      .select(`
        id,
        profile_id,
        due_date,
        emailed_at,
        reminders_sent,
        reminded_at,
        profiles:profile_id (
          id,
          email,
          full_name
        ),
        classes:class_id (
          id,
          program,
          schools:school_id (
            id,
            name
          )
        )
      `)
      .eq("status", "pending")
      .not("emailed_at", "is", null);

    for (const review of pendingReviews || []) {
      if (!review.profiles?.email) continue;

      const emailedDate = review.emailed_at?.split("T")[0];
      const dueDate = review.due_date;
      const remindersSent = review.reminders_sent || 0;

      // Calculate reminder triggers
      const threeDaysAfterEmail = addDays(emailedDate, 3);
      const dayAfterDue = addDays(dueDate, 1);

      let shouldRemind = false;
      let isOverdue = false;

      if (remindersSent === 0 && today >= threeDaysAfterEmail && today < dueDate) {
        // First reminder: 3 days after initial email
        shouldRemind = true;
      } else if (remindersSent === 1 && today === dueDate) {
        // Second reminder: on due date
        shouldRemind = true;
      } else if (remindersSent === 2 && today === dayAfterDue) {
        // Third and final reminder: day after due date (overdue)
        shouldRemind = true;
        isOverdue = true;
      }

      if (shouldRemind) {
        try {
          await sendSessionReviewReminderEmail({
            to: review.profiles.email,
            review: {
              id: review.id,
              schoolName: review.classes?.schools?.name || "Unknown School",
              dueDate: review.due_date,
            },
            isOverdue,
          });

          await supabase
            .from("session_reviews")
            .update({
              reminders_sent: remindersSent + 1,
              reminded_at: new Date().toISOString(),
            })
            .eq("id", review.id);

          results.remindersSent++;
        } catch (error) {
          results.errors.push(`Reminder error for ${review.profiles.email}: ${error.message}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      ...results,
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message,
      ...results,
    });
  }
}

/**
 * Process a single ended class to create reviews for qualifying instructors.
 */
async function processEndedClass(supabase, cls, today, results) {
  const sessionStart = cls.start_date;
  const sessionEnd = cls.end_date;

  // Get holidays and program off days for the session period
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

  // Compute all class occurrences in the session
  const sessionsResult = computeClassOccurrences({
    startDate: sessionStart,
    days: cls.days,
    targetSessions: null,
    holidays: holidays || [],
    programOffDays: programOffDays || [],
    rangeEnd: sessionEnd,
    classTime: cls.time,
  });

  const occurrenceDates = sessionsResult.occurrences.map((o) => o.date);

  // Get assignments for this class
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      slot_type,
      profile_id,
      profiles:profile_id (id, full_name, email)
    `)
    .eq("class_id", cls.id)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  // Get session changes for this class in the session period
  const { data: sessionChanges } = await supabase
    .from("session_changes")
    .select(`
      id,
      session_date,
      slot_type,
      absent_profile_id,
      sub_profile_id
    `)
    .eq("class_id", cls.id)
    .gte("session_date", sessionStart)
    .lte("session_date", sessionEnd);

  // Build a map of who taught each date
  // Each date -> array of profile_ids who actually taught
  const taughtByDate = new Map();

  for (const date of occurrenceDates) {
    const teachers = [];

    for (const slot of ["instructor_1", "instructor_2"]) {
      const regularAssignment = (assignments || []).find((a) => a.slot_type === slot);
      const regularProfileId = regularAssignment?.profile_id;

      // Check for session changes on this date
      const change = (sessionChanges || []).find(
        (sc) => sc.session_date === date && sc.slot_type === slot
      );

      if (change) {
        if (change.sub_profile_id) {
          // Sub is teaching
          teachers.push(change.sub_profile_id);
        }
        // If absent with no sub, no one teaches this slot
      } else if (regularProfileId) {
        // Regular instructor is teaching
        teachers.push(regularProfileId);
      }
    }

    taughtByDate.set(date, teachers);
  }

  // Count classes taught per instructor and their co-workers
  const instructorStats = new Map();

  for (const [date, teachers] of taughtByDate) {
    for (const profileId of teachers) {
      if (!instructorStats.has(profileId)) {
        instructorStats.set(profileId, {
          classesTaught: 0,
          lastClassDate: null,
          coworkerCounts: new Map(),
        });
      }

      const stats = instructorStats.get(profileId);
      stats.classesTaught++;
      stats.lastClassDate = date;

      // Track co-workers
      for (const coworkerId of teachers) {
        if (coworkerId !== profileId) {
          stats.coworkerCounts.set(
            coworkerId,
            (stats.coworkerCounts.get(coworkerId) || 0) + 1
          );
        }
      }
    }
  }

  // Create reviews for instructors who taught >= MIN_CLASSES_FOR_REVIEW
  for (const [profileId, stats] of instructorStats) {
    if (stats.classesTaught < MIN_CLASSES_FOR_REVIEW) {
      continue;
    }

    // Check if review already exists
    const { data: existingReview } = await supabase
      .from("session_reviews")
      .select("id")
      .eq("profile_id", profileId)
      .eq("class_id", cls.id)
      .eq("session_end", sessionEnd)
      .single();

    if (existingReview) {
      continue; // Already has a review
    }

    // Calculate due date (last class + 7 days)
    const dueDate = addDays(stats.lastClassDate, REVIEW_DUE_DAYS);

    // Create the review
    const { data: newReview, error: reviewError } = await supabase
      .from("session_reviews")
      .insert({
        profile_id: profileId,
        class_id: cls.id,
        session_start: sessionStart,
        session_end: sessionEnd,
        classes_taught: stats.classesTaught,
        due_date: dueDate,
        status: "pending",
      })
      .select("id")
      .single();

    if (reviewError) {
      results.errors.push(`Review insert error: ${reviewError.message}`);
      continue;
    }

    results.reviewsCreated++;

    // Create coworker rows for instructors they taught with >= MIN_CLASSES_TOGETHER_FOR_COWORKER times
    for (const [coworkerId, count] of stats.coworkerCounts) {
      if (count >= MIN_CLASSES_TOGETHER_FOR_COWORKER) {
        await supabase.from("session_review_coworkers").insert({
          review_id: newReview.id,
          coworker_id: coworkerId,
          classes_together: count,
        });
      }
    }
  }
}
