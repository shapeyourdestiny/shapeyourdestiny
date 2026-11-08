import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildCalendar, buildEventDescription } from "@/lib/calendar/ics";
import { computeClassOccurrences } from "@/lib/schedule/occurrences";
import crypto from "crypto";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://shapeyourdestiny.co";

// Rate limiting: 60 requests per hour per token
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX = 60;

function checkRateLimit(token) {
  const now = Date.now();
  const key = token.slice(0, 16); // Use first 16 chars as key

  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  const entry = rateLimitMap.get(key);

  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + RATE_LIMIT_WINDOW;
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) {
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
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
 * Fetch holidays applicable to a specific school using admin client.
 */
async function getHolidaysForSchool(supabase, districtId, schoolId, startDate, endDate) {
  const { data: holidays, error } = await supabase
    .from("holidays")
    .select("date, name, district_id, school_id, time_period")
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error fetching holidays:", error);
    return [];
  }

  return (holidays || []).filter((h) => {
    if (h.district_id === null && h.school_id === null) return true;
    if (h.district_id === districtId && h.school_id === null) return true;
    if (h.school_id === schoolId) return true;
    return false;
  });
}

/**
 * Fetch program off days using admin client.
 */
async function getProgramOffDays(supabase, program, startDate, endDate) {
  const { data, error } = await supabase
    .from("program_off_days")
    .select("date, reason, time_period")
    .eq("program", program)
    .gte("date", startDate)
    .lte("date", endDate)
    .order("date");

  if (error) {
    console.error("Error fetching program off days:", error);
    return [];
  }

  return data || [];
}

export async function GET(request, context) {
  // Extract token from path (handles both /token and /token.ics)
  const { params } = context;
  const paramsResolved = await params;
  let token = paramsResolved.token;

  // Remove .ics extension if present
  if (token.endsWith(".ics")) {
    token = token.slice(0, -4);
  }

  // Rate limiting
  if (!checkRateLimit(token)) {
    return new NextResponse("Too Many Requests", { status: 429 });
  }

  const supabase = createAdminClient();

  // Look up the feed
  const { data: feed } = await supabase
    .from("calendar_feeds")
    .select("profile_id, token, enabled")
    .eq("token", token)
    .single();

  if (!feed) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Constant-time token comparison
  if (!safeCompare(feed.token, token)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Check if feed is enabled
  if (!feed.enabled) {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Check if profile is active
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, status")
    .eq("id", feed.profile_id)
    .single();

  if (!profile || profile.status === "archived") {
    return new NextResponse("Not Found", { status: 404 });
  }

  // Build date range: 30 days ago to 120 days ahead
  const today = new Date();
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - 30);
  const endDate = new Date(today);
  endDate.setDate(endDate.getDate() + 120);

  const rangeStart = formatDate(startDate);
  const rangeEnd = formatDate(endDate);

  // Get all classes this instructor teaches
  const { data: assignments } = await supabase
    .from("class_assignments")
    .select(`
      id,
      class_id,
      slot_type,
      classes:class_id (
        id,
        days,
        time,
        end_time,
        hours_per_day,
        start_date,
        end_date,
        target_sessions,
        program,
        schools:school_id (
          id,
          name,
          address,
          instructions,
          office_contact,
          office_phone,
          districts:district_id (
            id,
            name
          )
        )
      )
    `)
    .eq("profile_id", feed.profile_id)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  // Get session changes in range
  const { data: sessionChanges } = await supabase
    .from("session_changes")
    .select(`
      id,
      class_id,
      session_date,
      slot_type,
      absent_profile_id,
      sub_profile_id,
      reason,
      absentProfile:profiles!session_changes_absent_profile_id_fkey (id, full_name),
      subProfile:profiles!session_changes_sub_profile_id_fkey (id, full_name)
    `)
    .gte("session_date", rangeStart)
    .lte("session_date", rangeEnd)
    .or(`absent_profile_id.eq.${feed.profile_id},sub_profile_id.eq.${feed.profile_id}`);

  // Get co-teachers for all classes
  const classIds = (assignments || []).map((a) => a.class_id);
  const { data: allAssignments } = await supabase
    .from("class_assignments")
    .select(`
      class_id,
      profile_id,
      profiles:profile_id (id, full_name)
    `)
    .in("class_id", classIds)
    .in("slot_type", ["instructor_1", "instructor_2"]);

  const coTeacherMap = {};
  (allAssignments || []).forEach((a) => {
    if (a.profile_id !== feed.profile_id && a.profiles) {
      coTeacherMap[a.class_id] = a.profiles.full_name;
    }
  });

  // Build a map of absences by class+date
  const absenceMap = new Map();
  const subSessionsMap = new Map();

  (sessionChanges || []).forEach((sc) => {
    const key = `${sc.class_id}|${sc.session_date}`;

    if (sc.absent_profile_id === feed.profile_id) {
      // This instructor is absent
      absenceMap.set(key, sc);
    }

    if (sc.sub_profile_id === feed.profile_id) {
      // This instructor is subbing
      if (!subSessionsMap.has(key)) {
        subSessionsMap.set(key, []);
      }
      subSessionsMap.get(key).push(sc);
    }
  });

  // Build events
  const events = [];

  // Process regular assignments
  for (const assignment of assignments || []) {
    const cls = assignment.classes;
    if (!cls || !cls.days || !cls.schools) continue;

    const school = cls.schools;
    const district = school.districts;

    // Fetch holidays and program off days for this class
    const [holidays, programOffDays] = await Promise.all([
      getHolidaysForSchool(supabase, district?.id, school.id, cls.start_date, rangeEnd),
      getProgramOffDays(supabase, cls.program || "wellness", cls.start_date, rangeEnd),
    ]);

    // Compute sessions for this class
    const sessionsResult = computeClassOccurrences({
      startDate: cls.start_date,
      days: cls.days,
      targetSessions: cls.target_sessions,
      holidays,
      programOffDays,
      classTime: cls.time,
      rangeEnd: cls.target_sessions ? null : rangeEnd,
    });

    // Filter to only occurrences within the requested range
    const occurrences = sessionsResult.occurrences.filter(
      (o) => o.date >= rangeStart && o.date <= rangeEnd
    );

    // Build events for each occurrence
    for (const occ of occurrences) {
      const absenceKey = `${cls.id}|${occ.date}`;

      // Skip if instructor is absent
      if (absenceMap.has(absenceKey)) {
        continue;
      }

      const programName = cls.program === "soccer" ? "Soccer" : "Wellness";

      events.push({
        uid: `${cls.id}-${occ.date.replace(/-/g, "")}@shapeyourdestiny.co`,
        dateStr: occ.date,
        startTime: cls.time,
        endTime: cls.end_time,
        hoursPerDay: cls.hours_per_day || 1,
        summary: `${programName} · ${school.name}`,
        location: school.address || school.name,
        description: buildEventDescription({
          isSubbing: false,
          coveringForName: null,
          coTeacherName: coTeacherMap[cls.id],
          instructions: school.instructions,
          officeContact: school.office_contact,
          officePhone: school.office_phone,
          siteUrl: SITE_URL,
        }),
      });
    }
  }

  // Process sub sessions (classes they're filling in for)
  const subClassIds = [...new Set([...subSessionsMap.keys()].map((k) => k.split("|")[0]))];

  if (subClassIds.length > 0) {
    const { data: subClasses } = await supabase
      .from("classes")
      .select(`
        id,
        days,
        time,
        end_time,
        hours_per_day,
        program,
        schools:school_id (
          id,
          name,
          address,
          instructions,
          office_contact,
          office_phone
        )
      `)
      .in("id", subClassIds);

    const subClassMap = {};
    (subClasses || []).forEach((c) => {
      subClassMap[c.id] = c;
    });

    for (const [key, changes] of subSessionsMap) {
      const [classId, sessionDate] = key.split("|");
      const cls = subClassMap[classId];
      if (!cls || !cls.schools) continue;

      const school = cls.schools;
      const change = changes[0]; // Use first change for covering info

      const programName = cls.program === "soccer" ? "Soccer" : "Wellness";
      const coveringFor = change.absentProfile?.full_name;

      events.push({
        uid: `${classId}-${sessionDate.replace(/-/g, "")}@shapeyourdestiny.co`,
        dateStr: sessionDate,
        startTime: cls.time,
        endTime: cls.end_time,
        hoursPerDay: cls.hours_per_day || 1,
        summary: `Sub: ${programName} · ${school.name}`,
        location: school.address || school.name,
        description: buildEventDescription({
          isSubbing: true,
          coveringForName: coveringFor,
          coTeacherName: null,
          instructions: school.instructions,
          officeContact: school.office_contact,
          officePhone: school.office_phone,
          siteUrl: SITE_URL,
        }),
      });
    }
  }

  // Sort events by date
  events.sort((a, b) => a.dateStr.localeCompare(b.dateStr));

  // Build calendar
  const icsContent = buildCalendar(events);

  // Update last_fetched_at (at most once per hour)
  const lastFetch = feed.last_fetched_at ? new Date(feed.last_fetched_at) : null;
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  if (!lastFetch || lastFetch < oneHourAgo) {
    await supabase
      .from("calendar_feeds")
      .update({ last_fetched_at: now.toISOString() })
      .eq("profile_id", feed.profile_id);
  }

  return new NextResponse(icsContent, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Cache-Control": "private, max-age=900",
      "Content-Disposition": "inline; filename=calendar.ics",
    },
  });
}
