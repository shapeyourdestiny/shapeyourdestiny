import { createClient } from "@/lib/supabase/server";
import {
  getPeriodForDate,
  getPreviousPeriod,
  getTodayLA,
  formatPeriodRangeShort,
  addDays,
} from "@/lib/payroll/schedule.js";

/**
 * Get unread count for a specific profile.
 * This is the single source of truth for unread badge counts.
 * Returns: { unreadUpdates, unreadShoutOuts, total }
 */
export async function getUnreadCount() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) {
    return { unreadUpdates: 0, unreadShoutOuts: 0, total: 0 };
  }

  // Fetch all data in parallel
  const [
    { data: sharedNotes },
    { data: announcements },
    { data: receivedShoutOuts },
    { data: subbingSessions },
    { data: pendingReviews },
    reads,
  ] = await Promise.all([
    supabase.rpc("my_shared_notes"),
    supabase.rpc("my_announcements"),
    supabase.rpc("my_received_shout_outs"),
    getMySubbingSessionsForCount(supabase, profileId),
    supabase.rpc("my_pending_session_reviews"),
    getMyInboxReadsInternal(supabase, profileId),
  ]);

  // Count unread updates (excluding needsYou items like disciplinary notes)
  let unreadUpdates = 0;

  // Announcements
  (announcements || []).forEach((a) => {
    if (!reads[`announcement:${a.id}`]) {
      unreadUpdates++;
    }
  });

  // Subbing sessions
  (subbingSessions || []).forEach((s) => {
    if (!reads[`sub:${s.id}`]) {
      unreadUpdates++;
    }
  });

  // Reviews (shared notes that are type "review" and have first_viewed_at)
  (sharedNotes || []).filter((n) => n.type === "review").forEach((n) => {
    if (!n.first_viewed_at) {
      unreadUpdates++;
    }
  });

  // Pending session reviews (always count as unread until submitted)
  unreadUpdates += (pendingReviews || []).length;

  // Count unread shout-outs
  let unreadShoutOuts = 0;

  // Received shout-outs
  (receivedShoutOuts || []).forEach((s) => {
    if (!reads[`shoutout:${s.id}`]) {
      unreadShoutOuts++;
    }
  });

  // Recognition notes
  (sharedNotes || []).filter((n) => n.type === "recognition").forEach((n) => {
    if (!n.first_viewed_at) {
      unreadShoutOuts++;
    }
  });

  return {
    unreadUpdates,
    unreadShoutOuts,
    total: unreadUpdates + unreadShoutOuts,
  };
}

/**
 * Internal helper to get subbing sessions for count.
 */
async function getMySubbingSessionsForCount(supabase, profileId) {
  const today = getTodayLA();
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data } = await supabase
    .from("session_changes")
    .select("id")
    .eq("sub_profile_id", profileId)
    .gte("session_date", today)
    .gte("created_at", fourteenDaysAgo.toISOString());

  return { data: data || [] };
}

/**
 * Internal helper to get inbox reads.
 */
async function getMyInboxReadsInternal(supabase, profileId) {
  const { data } = await supabase
    .from("inbox_reads")
    .select("item_type, item_id")
    .eq("profile_id", profileId);

  const reads = {};
  (data || []).forEach((r) => {
    reads[`${r.item_type}:${r.item_id}`] = true;
  });
  return reads;
}

/**
 * Get unread inbox counts for nav badge.
 * Returns total unread count (updates + shout-outs).
 */
export async function getInboxBadgeCount() {
  const { total } = await getUnreadCount();
  return total;
}

/**
 * Get the current instructor's profile ID
 */
async function getMyProfileId(supabase) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .single();

  return profile?.id || null;
}

/**
 * Get shared notes for the current instructor.
 * Uses the SECURITY DEFINER function my_shared_notes().
 */
export async function getMySharedNotes() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_shared_notes");

  if (error) {
    console.error("Error fetching shared notes:", error);
    return [];
  }

  return data || [];
}

/**
 * Get received shout-outs for the current instructor.
 * Uses the SECURITY DEFINER function my_received_shout_outs().
 */
export async function getMyReceivedShoutOuts() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_received_shout_outs");

  if (error) {
    console.error("Error fetching received shout-outs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get sent shout-outs for the current instructor.
 * Uses the SECURITY DEFINER function my_sent_shout_outs().
 */
export async function getMySentShoutOuts() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_sent_shout_outs");

  if (error) {
    console.error("Error fetching sent shout-outs:", error);
    return [];
  }

  return data || [];
}

/**
 * Get announcements for the current instructor.
 * Uses the SECURITY DEFINER function my_announcements().
 */
export async function getMyAnnouncements() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_announcements");

  if (error) {
    console.error("Error fetching announcements:", error);
    return [];
  }

  // Add isPinned computed field
  const today = getTodayLA();
  return (data || []).map(a => ({
    ...a,
    isPinned: a.pinned_until && a.pinned_until >= today,
  }));
}

/**
 * Get inbox read states for the current instructor.
 */
export async function getMyInboxReads() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) return {};

  const { data, error } = await supabase
    .from("inbox_reads")
    .select("item_type, item_id, read_at")
    .eq("profile_id", profileId);

  if (error) {
    console.error("Error fetching inbox reads:", error);
    return {};
  }

  // Convert to a lookup object
  const reads = {};
  (data || []).forEach((r) => {
    reads[`${r.item_type}:${r.item_id}`] = r.read_at;
  });

  return reads;
}

/**
 * Get subbing sessions (where instructor is a sub) for inbox display.
 * Returns sessions from today onwards, created/changed in last 14 days.
 */
export async function getMySubbingSessions() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);
  const today = getTodayLA();

  if (!profileId) return [];

  // Get sessions where this instructor is the sub
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const { data, error } = await supabase
    .from("session_changes")
    .select(`
      id,
      session_date,
      created_at,
      absent_profile_id,
      absentProfile:absent_profile_id (
        id,
        full_name
      ),
      classes:class_id (
        id,
        time,
        schools:school_id (
          id,
          name
        )
      )
    `)
    .eq("sub_profile_id", profileId)
    .gte("session_date", today)
    .gte("created_at", fourteenDaysAgo.toISOString())
    .order("session_date", { ascending: true });

  if (error) {
    console.error("Error fetching subbing sessions:", error);
    return [];
  }

  return data || [];
}

/**
 * Get payroll check notifications for the current instructor.
 * Returns pending checks (need to confirm) and resolved issues.
 */
export async function getMyPayrollCheckItems() {
  const supabase = await createClient();
  const profileId = await getMyProfileId(supabase);

  if (!profileId) return { pendingCheck: null, resolvedIssues: [] };

  const today = getTodayLA();

  // Default payroll settings
  const settings = {
    anchorDate: "2026-09-05",
    periodDays: 14,
    dueOffsetDays: 7,
    paydayOffsetDays: 14,
  };

  // Get check settings for deadline
  const { data: checkSettings } = await supabase
    .from("payroll_check_settings")
    .select("confirm_offset_days")
    .eq("id", 1)
    .single();

  const confirmOffsetDays = checkSettings?.confirm_offset_days || 3;

  // Get current and previous period
  const currentPeriod = getPeriodForDate(today, settings);
  const previousPeriod = currentPeriod ? getPreviousPeriod(currentPeriod, settings) : null;

  let pendingCheck = null;

  // Check if previous period needs confirmation
  if (previousPeriod && previousPeriod.endDate < today) {
    const deadline = addDays(previousPeriod.endDate, confirmOffsetDays);

    if (today <= deadline) {
      // Check if already confirmed/flagged
      const { data: existingCheck } = await supabase
        .from("payroll_checks")
        .select("id")
        .eq("profile_id", profileId)
        .eq("period_start", previousPeriod.startDate)
        .single();

      if (!existingCheck) {
        // Check if has sessions
        const { data: assignments } = await supabase
          .from("class_assignments")
          .select("id")
          .eq("profile_id", profileId)
          .in("slot_type", ["instructor_1", "instructor_2"])
          .limit(1);

        if (assignments && assignments.length > 0) {
          pendingCheck = {
            period: previousPeriod,
            deadline,
            periodRange: formatPeriodRangeShort(previousPeriod.startDate, previousPeriod.endDate),
          };
        }
      }
    }
  }

  // Get recently resolved issues (last 30 days)
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: resolvedIssues } = await supabase
    .from("payroll_check_issues")
    .select(`
      id,
      resolution_note,
      resolved_at,
      check:check_id (
        period_start,
        period_end
      )
    `)
    .eq("status", "resolved")
    .gte("resolved_at", thirtyDaysAgo.toISOString())
    .in("check_id", (
      await supabase
        .from("payroll_checks")
        .select("id")
        .eq("profile_id", profileId)
    ).data?.map(c => c.id) || [])
    .order("resolved_at", { ascending: false });

  return {
    pendingCheck,
    resolvedIssues: (resolvedIssues || []).map(issue => ({
      ...issue,
      periodRange: issue.check
        ? formatPeriodRangeShort(issue.check.period_start, issue.check.period_end)
        : null,
    })),
  };
}

/**
 * Get pending session reviews for the current instructor.
 */
export async function getMyPendingSessionReviews() {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("my_pending_session_reviews");

  if (error) {
    console.error("Error fetching pending session reviews:", error);
    return [];
  }

  return data || [];
}

/**
 * Get complete inbox data for the instructor.
 */
export async function getInstructorInbox() {
  const [
    sharedNotes,
    receivedShoutOuts,
    announcements,
    subbingSessions,
    payrollCheckItems,
    pendingSessionReviews,
    reads,
  ] = await Promise.all([
    getMySharedNotes(),
    getMyReceivedShoutOuts(),
    getMyAnnouncements(),
    getMySubbingSessions(),
    getMyPayrollCheckItems(),
    getMyPendingSessionReviews(),
    getMyInboxReads(),
  ]);

  // Build Updates items
  const updates = [];

  // Unacknowledged disciplinary notes (needs you)
  const needsAck = sharedNotes.filter(
    (n) => n.type === "disciplinary" && !n.acknowledged_at
  );
  needsAck.forEach((n) => {
    updates.push({
      id: `note:${n.id}`,
      type: "needs_ack",
      noteType: n.type,
      noteId: n.id,
      title: n.title,
      step: n.step,
      sharedAt: n.shared_at,
      isRead: !!reads[`note:${n.id}`],
      needsYou: true,
    });
  });

  // Subbing sessions
  subbingSessions.forEach((s) => {
    const firstName = s.absentProfile?.full_name?.split(" ")[0] || "someone";
    updates.push({
      id: `sub:${s.id}`,
      type: "subbing",
      sessionChangeId: s.id,
      schoolName: s.classes?.schools?.name,
      sessionDate: s.session_date,
      time: s.classes?.time,
      forName: firstName,
      classId: s.classes?.id,
      createdAt: s.created_at,
      isRead: !!reads[`sub:${s.id}`],
    });
  });

  // Shared reviews
  const sharedReviews = sharedNotes.filter((n) => n.type === "review");
  sharedReviews.forEach((n) => {
    updates.push({
      id: `note:${n.id}`,
      type: "review",
      noteId: n.id,
      title: n.title,
      sharedAt: n.shared_at,
      acknowledgedAt: n.acknowledged_at,
      isRead: !!n.first_viewed_at,
    });
  });

  // Announcements
  announcements.forEach((a) => {
    updates.push({
      id: `announcement:${a.id}`,
      type: "announcement",
      announcementId: a.id,
      title: a.title,
      body: a.body,
      createdByName: a.created_by_name,
      createdAt: a.created_at,
      isPinned: a.isPinned,
      pinnedUntil: a.pinned_until,
      editedAt: a.edited_at,
      isRead: !!reads[`announcement:${a.id}`],
    });
  });

  // Payroll check - needs confirmation
  if (payrollCheckItems.pendingCheck) {
    const pc = payrollCheckItems.pendingCheck;
    updates.push({
      id: `payrollcheck:${pc.period.startDate}`,
      type: "payroll_check",
      periodStart: pc.period.startDate,
      periodEnd: pc.period.endDate,
      periodRange: pc.periodRange,
      deadline: pc.deadline,
      createdAt: pc.period.endDate, // Use period end as "created" date for sorting
      isRead: !!reads[`payrollcheck:${pc.period.startDate}`],
    });
  }

  // Resolved payroll issues
  payrollCheckItems.resolvedIssues.forEach((issue) => {
    updates.push({
      id: `payrollissue:${issue.id}`,
      type: "payroll_issue_resolved",
      issueId: issue.id,
      periodRange: issue.periodRange,
      resolutionNote: issue.resolution_note,
      resolvedAt: issue.resolved_at,
      isRead: !!reads[`payrollissue:${issue.id}`],
    });
  });

  // Pending session reviews (shown at top of Updates, always "unread" until submitted)
  pendingSessionReviews.forEach((review) => {
    const today = getTodayLA();
    const isOverdue = review.due_date < today;
    updates.push({
      id: `sessionreview:${review.id}`,
      type: "session_review",
      reviewId: review.id,
      schoolName: review.school_name,
      program: review.program,
      classesTaught: review.classes_taught,
      sessionStart: review.session_start,
      sessionEnd: review.session_end,
      dueDate: review.due_date,
      isOverdue,
      createdAt: review.created_at,
      isRead: false, // Always show as unread until submitted
      needsYou: true, // Show in "Needs you" section at top
    });
  });

  // Sort updates by date (newest first), but keep needs_you at top and pinned second
  updates.sort((a, b) => {
    // needs_you always first
    if (a.needsYou && !b.needsYou) return -1;
    if (!a.needsYou && b.needsYou) return 1;
    // pinned announcements second
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    // then by date
    const aDate = a.sharedAt || a.createdAt || a.decidedAt || "";
    const bDate = b.sharedAt || b.createdAt || b.decidedAt || "";
    return bDate.localeCompare(aDate);
  });

  // Build Shout-outs items
  const shoutOuts = [];

  // Received shout-outs
  receivedShoutOuts.forEach((s) => {
    shoutOuts.push({
      id: `shoutout:${s.id}`,
      type: "shoutout",
      shoutOutId: s.id,
      fromFirstName: s.from_first_name,
      fromAvatarUrl: s.from_avatar_url,
      tag: s.tag,
      message: s.message,
      reviewedAt: s.reviewed_at,
      isRead: !!reads[`shoutout:${s.id}`],
    });
  });

  // Shared recognition notes
  const recognitionNotes = sharedNotes.filter((n) => n.type === "recognition");
  recognitionNotes.forEach((n) => {
    // Don't show if this is from a shout-out that's already in the list
    if (n.shout_out_from_name) {
      // This is a recognition note created from a shout-out
      shoutOuts.push({
        id: `note:${n.id}`,
        type: "recognition",
        noteId: n.id,
        title: n.title,
        body: n.body,
        fromName: n.shout_out_from_name,
        tag: n.shout_out_tag,
        sharedAt: n.shared_at,
        isRead: !!n.first_viewed_at,
      });
    } else {
      shoutOuts.push({
        id: `note:${n.id}`,
        type: "recognition",
        noteId: n.id,
        title: n.title,
        body: n.body,
        sharedAt: n.shared_at,
        isRead: !!n.first_viewed_at,
      });
    }
  });

  // Sort shout-outs by date
  shoutOuts.sort((a, b) => {
    const aDate = a.reviewedAt || a.sharedAt || "";
    const bDate = b.reviewedAt || b.sharedAt || "";
    return bDate.localeCompare(aDate);
  });

  // Count unread (session reviews always count since they're in needsYou)
  const unreadUpdates = updates.filter((u) => !u.isRead && !u.needsYou).length;
  const unreadShoutOuts = shoutOuts.filter((s) => !s.isRead).length;
  // Add pending session reviews to total unread count
  const pendingReviewCount = pendingSessionReviews.length;

  return {
    updates,
    shoutOuts,
    unreadUpdates: unreadUpdates + pendingReviewCount,
    unreadShoutOuts,
    sharedNotes,
    pendingSessionReviews,
  };
}
