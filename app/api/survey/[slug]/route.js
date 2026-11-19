import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyTurnstileToken } from "@/lib/security/turnstile";
import { hashIP, getClientIP, checkRateLimit } from "@/lib/security/rate-limit";
import { sendSurveyFeedbackNotification } from "@/lib/email";
import soccerFeedbackSurvey, { getQuestionMap, getRequiredQuestionIds } from "@/lib/surveys/soccer-feedback";

const MIN_SUBMIT_TIME_MS = 3000; // 3 seconds
const RATE_LIMIT_COUNT = 5;
const RATE_LIMIT_WINDOW_MINUTES = 60;

// Map of available surveys
const SURVEYS = {
  "soccer-feedback": soccerFeedbackSurvey,
};

export async function POST(request, { params }) {
  const { slug } = await params;
  const survey = SURVEYS[slug];

  if (!survey) {
    return NextResponse.json({ error: "Survey not found" }, { status: 404 });
  }

  // Check if survey is closed
  if (survey.closesAt && new Date() > new Date(survey.closesAt)) {
    return NextResponse.json({ error: "This survey is closed" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const { answers, _plt, _hp, "cf-turnstile-response": turnstileToken } = body;

    // Check honeypot
    if (_hp) {
      return NextResponse.json({ success: true });
    }

    // Check for too-fast submission
    if (_plt) {
      const loadTime = parseInt(_plt, 10);
      const now = Date.now();
      if (now - loadTime < MIN_SUBMIT_TIME_MS) {
        return NextResponse.json({ success: true });
      }
    }

    // Get client IP
    const ip = getClientIP(request);

    // Verify Turnstile token
    const turnstileResult = await verifyTurnstileToken(turnstileToken, ip);
    if (!turnstileResult.success) {
      return NextResponse.json(
        { errors: { turnstile: "Please complete the verification" } },
        { status: 400 }
      );
    }

    // Check rate limit
    const ipHash = hashIP(ip);
    const rateLimit = await checkRateLimit({
      key: `survey:${slug}:${ipHash}`,
      limit: RATE_LIMIT_COUNT,
      windowMinutes: RATE_LIMIT_WINDOW_MINUTES,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Too many submissions. Please try again later." },
        { status: 429 }
      );
    }

    // Validate answers against the survey config
    const questionMap = getQuestionMap(survey);
    const requiredIds = getRequiredQuestionIds(survey);
    const errors = {};
    const cleanedAnswers = {};

    // Check required questions
    for (const id of requiredIds) {
      const q = questionMap[id];
      const value = answers?.[id];

      if (!isQuestionAnswered(q, value)) {
        errors[id] = "Please answer this question";
      }
    }

    // Validate and clean all answers
    for (const [id, value] of Object.entries(answers || {})) {
      const q = questionMap[id];

      // Skip unknown question IDs
      if (!q) continue;

      // Validate by type
      const validationResult = validateAnswer(q, value);
      if (validationResult.error) {
        errors[id] = validationResult.error;
      } else if (validationResult.value !== undefined) {
        cleanedAnswers[id] = validationResult.value;
      }
    }

    if (Object.keys(errors).length > 0) {
      return NextResponse.json({ errors }, { status: 400 });
    }

    // Extract school for filtering (null if "Prefer not to say" or empty)
    const schoolAnswer = cleanedAnswers.school;
    const school = schoolAnswer && schoolAnswer !== "Prefer not to say" ? schoolAnswer : null;

    // Check if anonymous (name is blank)
    const isAnonymous = !cleanedAnswers.name || cleanedAnswers.name.trim() === "";

    // Save to database
    const adminClient = createAdminClient();

    const { error: insertError } = await adminClient
      .from("survey_responses")
      .insert({
        survey_slug: slug,
        answers: cleanedAnswers,
        school,
        is_anonymous: isAnonymous,
      })
      .select("id")
      .single();

    if (insertError) {
      console.error("Failed to save survey response:", insertError);
      return NextResponse.json(
        { error: "Something went wrong. Please try again." },
        { status: 500 }
      );
    }

    // Send admin notification email (don't fail the request if it fails)
    try {
      // Get admin emails from hiring_settings or profiles
      const { data: settings } = await adminClient
        .from("hiring_settings")
        .select("notify_emails")
        .eq("id", 1)
        .single();

      let adminEmails = settings?.notify_emails || [];

      if (adminEmails.length === 0) {
        const { data: admins } = await adminClient
          .from("profiles")
          .select("email")
          .eq("role", "admin")
          .not("email", "is", null);

        adminEmails = (admins || []).map((a) => a.email).filter(Boolean);
      }

      if (adminEmails.length > 0) {
        await sendSurveyFeedbackNotification({
          surveySlug: slug,
          school: school || "Anonymous school",
          overall: cleanedAnswers.overall,
          recommend: cleanedAnswers.recommend,
          attendance: cleanedAnswers.attendance,
          adminEmails,
        });
      }
    } catch (emailError) {
      console.error("Failed to send survey notification email:", emailError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Survey submission error:", error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 }
    );
  }
}

function isQuestionAnswered(q, value) {
  if (value === undefined || value === null || value === "") return false;

  if (q.type === "grid") {
    if (typeof value !== "object") return false;
    return q.rows.every((row) => value[row] !== undefined && value[row] !== null);
  }

  return true;
}

function validateAnswer(q, value) {
  if (value === undefined || value === null || value === "") {
    return { value: undefined };
  }

  switch (q.type) {
    case "dropdown":
    case "choice":
      if (!q.options.includes(value)) {
        return { error: "Please pick one" };
      }
      return { value };

    case "checkboxes":
      if (!Array.isArray(value)) {
        return { error: "Invalid selection" };
      }
      const validOptions = value.filter((v) => q.options.includes(v));
      return { value: validOptions.length > 0 ? validOptions : undefined };

    case "stars":
      const starNum = parseInt(value, 10);
      if (isNaN(starNum) || starNum < 1 || starNum > 5) {
        return { error: "Please rate from 1 to 5" };
      }
      return { value: starNum };

    case "grid":
      if (typeof value !== "object") {
        return { error: "Invalid rating" };
      }
      const cleanedGrid = {};
      for (const row of q.rows) {
        const rowVal = value[row];
        if (rowVal !== undefined && rowVal !== null) {
          const num = parseInt(rowVal, 10);
          if (isNaN(num) || num < 1 || num > 5) {
            return { error: `Please rate "${row}" from 1 to 5` };
          }
          cleanedGrid[row] = num;
        }
      }
      return { value: Object.keys(cleanedGrid).length > 0 ? cleanedGrid : undefined };

    case "scale":
      const scaleNum = parseInt(value, 10);
      if (isNaN(scaleNum) || scaleNum < q.min || scaleNum > q.max) {
        return { error: `Please pick a number from ${q.min} to ${q.max}` };
      }
      return { value: scaleNum };

    case "short":
      const shortText = String(value).trim().slice(0, q.maxLength || 100);
      return { value: shortText || undefined };

    case "long":
      const longText = String(value).trim().slice(0, q.maxLength || 1000);
      return { value: longText || undefined };

    case "consent":
      return { value: value === true };

    default:
      return { value: undefined };
  }
}
