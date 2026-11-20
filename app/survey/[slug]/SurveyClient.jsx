"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import Image from "next/image";
import Link from "next/link";
import Turnstile from "@/components/Turnstile";
import styles from "./survey.module.css";

const STORAGE_KEY_PREFIX = "survey_";
const AUTO_ADVANCE_DELAY = 350;

// Star labels for display
const STAR_LABELS = ["Not great", "Okay", "Good", "Great", "Amazing!"];

// Build steps from survey config
function buildSteps(survey) {
  const steps = [];
  let stepIndex = 0;

  for (let sIdx = 0; sIdx < survey.sections.length; sIdx++) {
    const section = survey.sections[sIdx];
    const questions = section.questions;

    // Check if this is the first section and all questions are optional (About You pattern)
    const isFirstSection = sIdx === 0;
    const allOptional = questions.every((q) => !q.required);

    if (isFirstSection && allOptional) {
      // Group all questions in the first optional section
      steps.push({
        type: "about",
        sectionTitle: section.title,
        sectionHelp: section.help,
        questions: questions,
        stepNumber: ++stepIndex,
      });
    } else {
      // Process questions individually
      for (let qIdx = 0; qIdx < questions.length; qIdx++) {
        const q = questions[qIdx];

        // Skip share_ok - it goes on the final step
        if (q.type === "consent") continue;

        // Check if this question should be grouped with the next one
        // (parent_requests + bring_next pattern)
        const nextQ = questions[qIdx + 1];
        if (q.id === "parent_requests" && nextQ?.id === "bring_next") {
          steps.push({
            type: "grouped",
            sectionTitle: section.title,
            questions: [q, nextQ],
            stepNumber: ++stepIndex,
          });
          qIdx++; // Skip the next question since we included it
          continue;
        }

        // Long answer questions get their own step
        if (q.type === "long") {
          steps.push({
            type: "long",
            sectionTitle: section.title,
            question: q,
            stepNumber: ++stepIndex,
          });
          continue;
        }

        // All other questions
        steps.push({
          type: q.type,
          sectionTitle: section.title,
          question: q,
          stepNumber: ++stepIndex,
        });
      }
    }
  }

  // Add final "ready to send" step
  steps.push({
    type: "final",
    stepNumber: ++stepIndex,
  });

  return steps;
}

// Count total questions for welcome screen
function countTotalQuestions(survey) {
  let count = 0;
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type !== "consent") count++;
    }
  }
  return count;
}

// Find consent question
function findConsentQuestion(survey) {
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.type === "consent") return q;
    }
  }
  return null;
}

// Helper to load saved state from sessionStorage
function loadSavedState(storageKey) {
  if (typeof window === "undefined") return null;
  try {
    const saved = sessionStorage.getItem(storageKey);
    if (saved) {
      return JSON.parse(saved);
    }
  } catch {
    // Ignore storage errors
  }
  return null;
}

export default function SurveyClient({ survey, isClosed, isDraft }) {
  // Storage key for this survey
  const storageKey = `${STORAGE_KEY_PREFIX}${survey.slug}`;

  // Core state - initialize from sessionStorage if available
  const [currentStep, setCurrentStep] = useState(() => {
    const saved = loadSavedState(storageKey);
    return saved?.step ?? 0;
  });
  const [answers, setAnswers] = useState(() => {
    const saved = loadSavedState(storageKey);
    return saved?.answers ?? {};
  });
  const [otherText, setOtherText] = useState(() => {
    const saved = loadSavedState(storageKey);
    return saved?.otherText ?? {};
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pageLoadTime] = useState(() => Date.now());
  const [turnstileToken, setTurnstileToken] = useState("");
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = back
  const [isAnimating, setIsAnimating] = useState(false);

  // Refs
  const questionTitleRef = useRef(null);
  const honeypotRef = useRef(null);

  // Build steps from config
  const steps = useMemo(() => buildSteps(survey), [survey]);
  const totalQuestions = useMemo(() => countTotalQuestions(survey), [survey]);
  const consentQuestion = useMemo(() => findConsentQuestion(survey), [survey]);

  // Save state to sessionStorage
  useEffect(() => {
    if (submitted) {
      try {
        sessionStorage.removeItem(storageKey);
      } catch {
        // Ignore
      }
      return;
    }
    try {
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ step: currentStep, answers, otherText })
      );
    } catch {
      // Ignore storage errors
    }
  }, [currentStep, answers, otherText, storageKey, submitted]);

  // Handle browser back button
  useEffect(() => {
    const handlePopState = (e) => {
      const step = e.state?.step;
      if (typeof step === "number") {
        setDirection(-1);
        setCurrentStep(step);
      }
    };

    window.addEventListener("popstate", handlePopState);

    // Set initial history state
    if (currentStep === 0 && !window.history.state?.step) {
      window.history.replaceState({ step: 0 }, "");
    }

    return () => window.removeEventListener("popstate", handlePopState);
  }, [currentStep]);

  // Navigate to a step
  const goToStep = useCallback(
    (newStep, pushHistory = true) => {
      if (isAnimating) return;
      setDirection(newStep > currentStep ? 1 : -1);
      setIsAnimating(true);

      if (pushHistory && newStep !== currentStep) {
        window.history.pushState({ step: newStep }, "");
      }

      setTimeout(() => {
        setCurrentStep(newStep);
        setIsAnimating(false);
        setErrors({});

        // Focus on question title for accessibility
        setTimeout(() => {
          questionTitleRef.current?.focus();
        }, 50);
      }, 50);
    },
    [currentStep, isAnimating]
  );

  // Go to next step
  const goNext = useCallback(() => {
    if (currentStep < steps.length) {
      goToStep(currentStep + 1);
    }
  }, [currentStep, steps.length, goToStep]);

  // Go to previous step
  const goBack = useCallback(() => {
    if (currentStep > 0) {
      goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  // Check if a question is answered
  const isQuestionAnswered = useCallback((q, value) => {
    if (value === undefined || value === null || value === "") return false;
    if (q.type === "grid") {
      if (typeof value !== "object") return false;
      return q.rows.every((row) => value[row] !== undefined && value[row] !== null);
    }
    return true;
  }, []);

  // Validate current step
  const validateCurrentStep = useCallback(() => {
    if (currentStep === 0) return true; // Welcome screen

    const step = steps[currentStep - 1];
    if (!step) return true;

    const newErrors = {};

    if (step.type === "about") {
      // About step - all optional, always valid
      return true;
    }

    if (step.type === "grouped") {
      // Grouped questions - check required ones
      for (const q of step.questions) {
        if (q.required && !isQuestionAnswered(q, answers[q.id])) {
          newErrors[q.id] = "Please answer this question";
        }
      }
    } else if (step.type === "final") {
      // Final step - check all required from entire survey
      for (const section of survey.sections) {
        for (const q of section.questions) {
          if (q.required && !isQuestionAnswered(q, answers[q.id])) {
            newErrors[q.id] = "Please answer this question";
          }
        }
      }
    } else if (step.question) {
      const q = step.question;
      if (q.required && !isQuestionAnswered(q, answers[q.id])) {
        newErrors[q.id] = "Please pick one";
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return false;
    }

    return true;
  }, [currentStep, steps, answers, isQuestionAnswered, survey.sections]);

  // Handle next button click
  const handleNext = useCallback(() => {
    if (validateCurrentStep()) {
      goNext();
    }
  }, [validateCurrentStep, goNext]);

  // Check if current step can be skipped
  const canSkip = useCallback(() => {
    if (currentStep === 0) return false;
    const step = steps[currentStep - 1];
    if (!step) return false;

    if (step.type === "about") return true;
    if (step.type === "grouped") {
      return step.questions.every((q) => !q.required);
    }
    if (step.type === "final") return false;
    if (step.question) return !step.question.required;
    return false;
  }, [currentStep, steps]);

  // Check if current step is answered (for Next button state)
  const isCurrentStepAnswered = useCallback(() => {
    if (currentStep === 0) return true;
    const step = steps[currentStep - 1];
    if (!step) return true;

    if (step.type === "about") return true;
    if (step.type === "grouped") {
      return step.questions.some((q) => q.required && isQuestionAnswered(q, answers[q.id])) ||
        step.questions.every((q) => !q.required);
    }
    if (step.type === "final") {
      // Check all required
      for (const section of survey.sections) {
        for (const q of section.questions) {
          if (q.required && !isQuestionAnswered(q, answers[q.id])) {
            return false;
          }
        }
      }
      return true;
    }
    if (step.question) {
      return !step.question.required || isQuestionAnswered(step.question, answers[step.question.id]);
    }
    return true;
  }, [currentStep, steps, answers, isQuestionAnswered, survey.sections]);

  // Update an answer
  const updateAnswer = useCallback(
    (questionId, value, autoAdvance = false) => {
      setAnswers((prev) => ({ ...prev, [questionId]: value }));
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });

      if (autoAdvance) {
        setTimeout(() => {
          if (validateCurrentStep()) {
            goNext();
          }
        }, AUTO_ADVANCE_DELAY);
      }
    },
    [goNext, validateCurrentStep]
  );

  // Update grid answer
  const updateGridAnswer = useCallback((questionId, row, value) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...(prev[questionId] || {}),
        [row]: value,
      },
    }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[questionId];
      return newErrors;
    });
  }, []);

  // Toggle checkbox
  const toggleCheckbox = useCallback((questionId, option) => {
    setAnswers((prev) => {
      const current = prev[questionId] || [];
      if (current.includes(option)) {
        return { ...prev, [questionId]: current.filter((o) => o !== option) };
      }
      return { ...prev, [questionId]: [...current, option] };
    });
  }, []);

  // Update other text
  const updateOtherText = useCallback((questionId, text) => {
    setOtherText((prev) => ({ ...prev, [questionId]: text }));
  }, []);

  // Build final answers
  const buildFinalAnswers = useCallback(() => {
    const finalAnswers = { ...answers };

    for (const section of survey.sections) {
      for (const q of section.questions) {
        if (q.hasOtherText && otherText[q.id]) {
          if (q.type === "choice" && answers[q.id] === "Other") {
            finalAnswers[q.id] = `Other: ${otherText[q.id]}`;
          } else if (q.type === "checkboxes" && Array.isArray(answers[q.id]) && answers[q.id].includes("Other")) {
            finalAnswers[`${q.id}_other`] = otherText[q.id];
          }
        }
      }
    }

    return finalAnswers;
  }, [answers, otherText, survey.sections]);

  // Handle submit
  const handleSubmit = useCallback(async () => {
    if (!validateCurrentStep()) return;

    setSubmitting(true);
    setErrors({});

    try {
      const response = await fetch(`/api/survey/${survey.slug}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: buildFinalAnswers(),
          _plt: pageLoadTime,
          _hp: honeypotRef.current?.value || "",
          "cf-turnstile-response": turnstileToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.errors) {
          setErrors(data.errors);
        } else if (data.error) {
          setErrors({ form: data.error });
        }
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      window.history.replaceState({ step: "done" }, "");
    } catch (error) {
      console.error("Submit error:", error);
      setErrors({ form: "Something went wrong. Please try again." });
      setSubmitting(false);
    }
  }, [validateCurrentStep, survey.slug, buildFinalAnswers, pageLoadTime, turnstileToken]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle keys when in text inputs
      const target = e.target;
      const isTextInput =
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable;

      if (isTextInput && e.key !== "Escape") {
        // Allow Shift+Enter to advance from text inputs
        if (e.key === "Enter" && e.shiftKey) {
          e.preventDefault();
          handleNext();
        }
        return;
      }

      const step = currentStep > 0 ? steps[currentStep - 1] : null;

      switch (e.key) {
        case "Enter":
          e.preventDefault();
          if (currentStep === 0) {
            goNext();
          } else if (step?.type === "final") {
            handleSubmit();
          } else {
            handleNext();
          }
          break;

        case "Escape":
        case "Backspace":
          if (currentStep > 0 && !isTextInput) {
            e.preventDefault();
            goBack();
          }
          break;

        case "a":
        case "A":
        case "b":
        case "B":
        case "c":
        case "C":
        case "d":
        case "D":
        case "e":
        case "E":
        case "f":
        case "F":
          if (step?.type === "choice" && step.question) {
            const idx = e.key.toLowerCase().charCodeAt(0) - 97;
            const options = step.question.options;
            if (idx < options.length) {
              e.preventDefault();
              updateAnswer(step.question.id, options[idx], true);
            }
          }
          break;

        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
          if (step?.type === "stars" && step.question) {
            e.preventDefault();
            updateAnswer(step.question.id, parseInt(e.key), true);
          }
          break;

        case "0":
        case "6":
        case "7":
        case "8":
        case "9":
          if (step?.type === "scale" && step.question) {
            e.preventDefault();
            updateAnswer(step.question.id, parseInt(e.key), true);
          }
          break;

        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [currentStep, steps, goNext, goBack, handleNext, handleSubmit, updateAnswer]);

  // Determine current screen type
  const screenType = useMemo(() => {
    if (currentStep === 0) return "welcome";
    if (submitted) return "thankyou";
    return "question";
  }, [currentStep, submitted]);

  // Get current step data
  const stepData = currentStep > 0 && currentStep <= steps.length ? steps[currentStep - 1] : null;

  // Get the big line text for left panel
  const getBigLineText = () => {
    if (screenType === "welcome") return "Help us make next season even better";
    if (screenType === "thankyou") return "You just made next season better.";
    return "Every answer helps our coaches grow.";
  };

  // Render closed/draft states
  if (isDraft) {
    return (
      <div className={styles.surveyContainer}>
        <div className={styles.leftPanel}>
          <div className={styles.photoWrapper}>
            <Image
              src="/Images/soccer-manykids.JPG.webp"
              alt="Kids playing soccer at school"
              fill
              sizes="(min-width: 900px) 46vw, 100vw"
              className={styles.photo}
              priority
            />
            <div className={styles.photoOverlay} />
          </div>
          <div className={styles.leftContent}>
            <Image
              src="/Images/footer_logo_gold.png"
              alt="Shape Your Destiny"
              width={120}
              height={28}
              className={styles.logo}
            />
          </div>
        </div>
        <div className={styles.rightPanel}>
          <div className={styles.closedCard}>
            <div className={styles.closedIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <p>This survey isn&apos;t open yet.</p>
          </div>
        </div>
      </div>
    );
  }

  if (isClosed) {
    return (
      <div className={styles.surveyContainer}>
        <div className={styles.leftPanel}>
          <div className={styles.photoWrapper}>
            <Image
              src="/Images/soccer-manykids.JPG.webp"
              alt="Kids playing soccer at school"
              fill
              sizes="(min-width: 900px) 46vw, 100vw"
              className={styles.photo}
              priority
            />
            <div className={styles.photoOverlay} />
          </div>
          <div className={styles.leftContent}>
            <Image
              src="/Images/footer_logo_gold.png"
              alt="Shape Your Destiny"
              width={120}
              height={28}
              className={styles.logo}
            />
          </div>
        </div>
        <div className={styles.rightPanel}>
          <div className={styles.closedCard}>
            <div className={styles.closedIcon}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
            </div>
            <p>This survey is closed. Thank you!</p>
          </div>
        </div>
      </div>
    );
  }

  // Thank you screen
  if (submitted) {
    return (
      <ThankYouScreen
        getBigLineText={getBigLineText}
      />
    );
  }

  // Welcome screen
  if (currentStep === 0) {
    return (
      <WelcomeScreen
        totalQuestions={totalQuestions}
        onStart={() => goToStep(1)}
        getBigLineText={getBigLineText}
      />
    );
  }

  // Question screens
  return (
    <div className={styles.surveyContainer}>
      {/* Honeypot */}
      <input
        ref={honeypotRef}
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        className={styles.honeypot}
      />

      {/* Left Panel */}
      <div className={styles.leftPanel} data-screen="question">
        <div className={styles.photoWrapper}>
          <Image
            src="/Images/soccer-two-kids-upright.webp"
            alt="Kids playing soccer at school"
            fill
            sizes="(min-width: 900px) 46vw, 100vw"
            className={styles.photo}
          />
          <div className={styles.photoOverlay} />
        </div>
        <div className={styles.leftContent}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/Images/footer_logo_gold.png"
              alt="Shape Your Destiny"
              width={120}
              height={28}
              className={styles.logo}
            />
          </Link>
          <div className={styles.leftBottom}>
            <span className={styles.glassPill}>INTRAMURAL SOCCER</span>
            <h2 className={styles.bigLine}>{getBigLineText()}</h2>
            <p className={styles.subLine}>Your answers go straight to the Shape Your Destiny team.</p>
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className={styles.rightPanel}>
        {/* Top Bar */}
        <div className={styles.topBar}>
          <button
            type="button"
            className={styles.backBtn}
            onClick={goBack}
            aria-label="Go back"
          >
            ‹
          </button>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${(currentStep / steps.length) * 100}%` }}
            />
          </div>
          <span className={styles.stepCounter}>
            {currentStep} of {steps.length}
          </span>
        </div>

        {/* Step Content */}
        <div
          className={`${styles.stepContent} ${direction > 0 ? styles.slideInRight : styles.slideInLeft}`}
          key={currentStep}
        >
          {stepData && (
            <QuestionStep
              step={stepData}
              answers={answers}
              otherText={otherText}
              errors={errors}
              updateAnswer={updateAnswer}
              updateGridAnswer={updateGridAnswer}
              toggleCheckbox={toggleCheckbox}
              updateOtherText={updateOtherText}
              questionTitleRef={questionTitleRef}
              consentQuestion={consentQuestion}
              submitting={submitting}
              onSubmit={handleSubmit}
              setTurnstileToken={setTurnstileToken}
            />
          )}
        </div>

        {/* Bottom Bar */}
        {stepData?.type !== "final" && (
          <div className={styles.bottomBar}>
            <div className={styles.bottomHint}>
              {stepData?.type === "choice" && "Press A, B, C or D"}
              {stepData?.type === "stars" && "Press 1 to 5"}
              {stepData?.type === "scale" && "Press 0 to 9"}
              {!["choice", "stars", "scale"].includes(stepData?.type) && "Press Enter ↵ to continue"}
            </div>
            <div className={styles.bottomActions}>
              {canSkip() && (
                <button
                  type="button"
                  className={styles.skipBtn}
                  onClick={goNext}
                >
                  Skip
                </button>
              )}
              <button
                type="button"
                className={`${styles.nextBtn} ${!isCurrentStepAnswered() ? styles.nextBtnFaded : ""}`}
                onClick={handleNext}
              >
                Next →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Welcome Screen Component
function WelcomeScreen({ totalQuestions, onStart, getBigLineText }) {
  return (
    <div className={styles.surveyContainer}>
      <div className={styles.leftPanel} data-screen="welcome">
        <div className={styles.photoWrapper}>
          <Image
            src="/Images/soccer-manykids.JPG.webp"
            alt="Kids playing soccer at school"
            fill
            sizes="(min-width: 900px) 46vw, 100vw"
            className={styles.photo}
            priority
          />
          <div className={styles.photoOverlay} />
        </div>
        <div className={styles.leftContent}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/Images/footer_logo_gold.png"
              alt="Shape Your Destiny"
              width={120}
              height={28}
              className={styles.logo}
            />
          </Link>
          <div className={styles.leftBottom}>
            <span className={styles.glassPill}>INTRAMURAL SOCCER</span>
            <h2 className={styles.bigLine}>{getBigLineText()}</h2>
            <p className={styles.subLine}>Your answers go straight to the Shape Your Destiny team.</p>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.welcomeContent}>
          <span className={styles.tealLabel}>FOR OUR PARTNER SCHOOLS</span>
          <h1 className={styles.welcomeTitle}>Thanks for an amazing season!</h1>
          <p className={styles.welcomeText}>
            You see our program every week. Tell us how it&apos;s going for your students, and help us make next season even better.
          </p>

          <div className={styles.infoPills}>
            <div className={styles.infoPill}>
              <span className={styles.infoPillIcon}>⏱</span>
              <span>About 3 minutes</span>
            </div>
            <div className={styles.infoPill}>
              <span className={styles.infoPillIcon}>📋</span>
              <span>{totalQuestions} quick questions</span>
            </div>
            <div className={styles.infoPill}>
              <span className={styles.infoPillIcon}>🔒</span>
              <span>Anonymous is fine</span>
            </div>
          </div>

          <div className={styles.welcomeActions}>
            <button
              type="button"
              className={styles.startBtn}
              onClick={onStart}
            >
              Let&apos;s go →
            </button>
            <span className={styles.enterHint}>or press Enter ↵</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Thank You Screen Component
function ThankYouScreen({ getBigLineText }) {
  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    const url = "https://www.shapeyourdestiny.co";
    const title = "Shape Your Destiny";
    const text = "Check out Shape Your Destiny - an amazing program for kids!";

    if (navigator.share) {
      try {
        await navigator.share({ title, text, url });
      } catch {
        // User cancelled or error, fall back to copy
        copyToClipboard(url);
      }
    } else {
      copyToClipboard(url);
    }
  };

  const copyToClipboard = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = url;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className={styles.surveyContainer}>
      <div className={styles.leftPanel} data-screen="thankyou">
        <div className={styles.photoWrapper}>
          <Image
            src="/Images/soccer-manykids.JPG.webp"
            alt="Kids playing soccer at school"
            fill
            sizes="(min-width: 900px) 46vw, 100vw"
            className={styles.photo}
          />
          <div className={styles.photoOverlay} />
        </div>
        <div className={styles.leftContent}>
          <Link href="/" className={styles.logoLink}>
            <Image
              src="/Images/footer_logo_gold.png"
              alt="Shape Your Destiny"
              width={120}
              height={28}
              className={styles.logo}
            />
          </Link>
          <div className={styles.leftBottom}>
            <span className={styles.glassPill}>INTRAMURAL SOCCER</span>
            <h2 className={styles.bigLine}>{getBigLineText()}</h2>
            <p className={styles.subLine}>Your answers go straight to the Shape Your Destiny team.</p>
          </div>
        </div>
      </div>

      <div className={styles.rightPanel}>
        <div className={styles.thankYouContent}>
          <div className={styles.checkCircle}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h1 className={styles.thankYouTitle}>Thank you!</h1>
          <p className={styles.thankYouText}>
            Your feedback is on its way to our team. It helps us plan next season for your students.
          </p>

          <div className={styles.shareCard}>
            <p className={styles.shareTitle}>Know another school that would love this?</p>
            <p className={styles.shareText}>We&apos;d be honored if you passed our name along.</p>
            <button
              type="button"
              className={styles.shareBtn}
              onClick={handleShare}
            >
              {copied ? "Link copied!" : "Share Shape Your Destiny"}
            </button>
          </div>

          <a href="https://www.shapeyourdestiny.co" className={styles.visitLink}>
            Visit our website ›
          </a>
        </div>
      </div>
    </div>
  );
}

// Question Step Component
function QuestionStep({
  step,
  answers,
  otherText,
  errors,
  updateAnswer,
  updateGridAnswer,
  toggleCheckbox,
  updateOtherText,
  questionTitleRef,
  consentQuestion,
  submitting,
  onSubmit,
  setTurnstileToken,
}) {
  // Final step - recap and submit
  if (step.type === "final") {
    return (
      <FinalStep
        answers={answers}
        consentQuestion={consentQuestion}
        updateAnswer={updateAnswer}
        errors={errors}
        submitting={submitting}
        onSubmit={onSubmit}
        questionTitleRef={questionTitleRef}
        setTurnstileToken={setTurnstileToken}
      />
    );
  }

  // About step - grouped intro questions
  if (step.type === "about") {
    return (
      <AboutStep
        step={step}
        answers={answers}
        otherText={otherText}
        updateAnswer={updateAnswer}
        updateOtherText={updateOtherText}
        questionTitleRef={questionTitleRef}
      />
    );
  }

  // Grouped questions step
  if (step.type === "grouped") {
    return (
      <GroupedStep
        step={step}
        answers={answers}
        otherText={otherText}
        errors={errors}
        updateAnswer={updateAnswer}
        toggleCheckbox={toggleCheckbox}
        updateOtherText={updateOtherText}
        questionTitleRef={questionTitleRef}
      />
    );
  }

  // Single question step
  const q = step.question;

  return (
    <div className={styles.questionWrapper}>
      <div className={styles.sectionTag}>
        <span className={styles.stepTile}>{step.stepNumber}</span>
        <span className={styles.sectionName}>{step.sectionTitle}</span>
      </div>

      <h2
        ref={questionTitleRef}
        className={styles.questionTitle}
        tabIndex={-1}
      >
        {q.label}
      </h2>

      {q.help && <p className={styles.questionHelp}>{q.help}</p>}

      <div className={styles.questionField}>
        <QuestionField
          question={q}
          value={answers[q.id]}
          otherText={otherText[q.id] || ""}
          updateAnswer={updateAnswer}
          updateGridAnswer={updateGridAnswer}
          toggleCheckbox={toggleCheckbox}
          updateOtherText={updateOtherText}
        />
      </div>

      {errors[q.id] && (
        <p className={styles.fieldError}>{errors[q.id]}</p>
      )}
    </div>
  );
}

// About Step Component
function AboutStep({ step, answers, otherText, updateAnswer, updateOtherText, questionTitleRef }) {
  const schoolQ = step.questions.find((q) => q.id === "school");
  const roleQ = step.questions.find((q) => q.id === "role");
  const nameQ = step.questions.find((q) => q.id === "name");

  return (
    <div className={styles.questionWrapper}>
      <div className={styles.sectionTag}>
        <span className={styles.stepTile}>{step.stepNumber}</span>
        <span className={styles.sectionName}>{step.sectionTitle}</span>
      </div>

      <h2
        ref={questionTitleRef}
        className={styles.questionTitle}
        tabIndex={-1}
      >
        First, a little about you
      </h2>

      {step.sectionHelp && (
        <p className={styles.questionHelp}>{step.sectionHelp}</p>
      )}

      <div className={styles.aboutFields}>
        {schoolQ && (
          <div className={styles.aboutField}>
            <label className={styles.aboutLabel}>{schoolQ.label}</label>
            <SearchableDropdown
              options={schoolQ.options}
              value={answers[schoolQ.id] || ""}
              onChange={(v) => updateAnswer(schoolQ.id, v)}
              placeholder="Select or search..."
            />
          </div>
        )}

        {roleQ && (
          <div className={styles.aboutField}>
            <label className={styles.aboutLabel}>{roleQ.label}</label>
            <div className={styles.roleChips}>
              {roleQ.options.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.roleChip} ${answers[roleQ.id] === opt ? styles.roleChipActive : ""}`}
                  onClick={() => updateAnswer(roleQ.id, opt)}
                >
                  {opt}
                </button>
              ))}
            </div>
            {roleQ.hasOtherText && answers[roleQ.id] === "Other" && (
              <input
                type="text"
                className={styles.otherInput}
                placeholder="Please specify..."
                value={otherText[roleQ.id] || ""}
                onChange={(e) => updateOtherText(roleQ.id, e.target.value)}
                maxLength={100}
              />
            )}
          </div>
        )}

        {nameQ && (
          <div className={styles.aboutField}>
            <label className={styles.aboutLabel}>{nameQ.label}</label>
            <input
              type="text"
              className={styles.nameInput}
              value={answers[nameQ.id] || ""}
              onChange={(e) => updateAnswer(nameQ.id, e.target.value)}
              placeholder=""
              maxLength={nameQ.maxLength || 100}
            />
            <span className={styles.nameHint}>Optional. Leave blank to stay anonymous.</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Grouped Step Component (parent_requests + bring_next)
function GroupedStep({ step, answers, otherText, errors, updateAnswer, toggleCheckbox, updateOtherText, questionTitleRef }) {
  return (
    <div className={styles.questionWrapper}>
      <div className={styles.sectionTag}>
        <span className={styles.stepTile}>{step.stepNumber}</span>
        <span className={styles.sectionName}>{step.sectionTitle}</span>
      </div>

      {step.questions.map((q, idx) => (
        <div key={q.id} className={styles.groupedQuestion}>
          <h2
            ref={idx === 0 ? questionTitleRef : null}
            className={styles.questionTitle}
            tabIndex={idx === 0 ? -1 : undefined}
          >
            {q.label}
          </h2>

          {q.help && <p className={styles.questionHelp}>{q.help}</p>}

          <div className={styles.questionField}>
            <QuestionField
              question={q}
              value={answers[q.id]}
              otherText={otherText[q.id] || ""}
              updateAnswer={updateAnswer}
              toggleCheckbox={toggleCheckbox}
              updateOtherText={updateOtherText}
            />
          </div>

          {errors[q.id] && (
            <p className={styles.fieldError}>{errors[q.id]}</p>
          )}
        </div>
      ))}
    </div>
  );
}

// Final Step Component
function FinalStep({ answers, consentQuestion, updateAnswer, errors, submitting, onSubmit, questionTitleRef, setTurnstileToken }) {
  // Get recap values
  const overall = answers.overall;
  const attendance = answers.attendance;
  const recommend = answers.recommend;
  const school = answers.school && answers.school !== "Prefer not to say" ? answers.school : "Anonymous";

  return (
    <div className={styles.questionWrapper}>
      <h2
        ref={questionTitleRef}
        className={styles.questionTitle}
        tabIndex={-1}
      >
        Looks great. Ready to send?
      </h2>

      <div className={styles.recapGrid}>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Overall</span>
          <span className={styles.recapValue}>
            {overall ? (
              <span className={styles.recapStars}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <svg key={s} viewBox="0 0 24 24" fill={s <= overall ? "#F2A93B" : "#C9D4EE"}>
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                  </svg>
                ))}
              </span>
            ) : "—"}
          </span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Attendance</span>
          <span className={styles.recapValue}>{attendance || "—"}</span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>Would recommend</span>
          <span className={styles.recapValue}>
            {recommend !== undefined ? `${recommend} out of 10` : "—"}
          </span>
        </div>
        <div className={styles.recapItem}>
          <span className={styles.recapLabel}>School</span>
          <span className={styles.recapValue}>{school}</span>
        </div>
      </div>

      {consentQuestion && (
        <label className={styles.consentCard}>
          <input
            type="checkbox"
            checked={answers[consentQuestion.id] || false}
            onChange={(e) => updateAnswer(consentQuestion.id, e.target.checked)}
          />
          <span className={styles.consentText}>{consentQuestion.label}</span>
        </label>
      )}

      {errors.form && (
        <p className={styles.formError}>{errors.form}</p>
      )}

      {errors.turnstile && (
        <p className={styles.fieldError}>{errors.turnstile}</p>
      )}

      <div className={styles.turnstileWrapper}>
        <Turnstile onVerify={setTurnstileToken} />
      </div>

      <button
        type="button"
        className={styles.submitBtn}
        onClick={onSubmit}
        disabled={submitting}
      >
        {submitting ? "Sending..." : "Send feedback"}
      </button>
    </div>
  );
}

// Question Field Component
function QuestionField({ question, value, otherText, updateAnswer, updateGridAnswer, toggleCheckbox, updateOtherText }) {
  const q = question;

  switch (q.type) {
    case "choice":
      return (
        <div className={styles.choiceGrid}>
          {q.options.map((opt, idx) => {
            const letter = String.fromCharCode(65 + idx); // A, B, C, D...
            return (
              <button
                key={opt}
                type="button"
                className={`${styles.choiceTile} ${value === opt ? styles.choiceTileActive : ""}`}
                onClick={() => updateAnswer(q.id, opt, true)}
                aria-pressed={value === opt}
              >
                <span className={styles.choiceLetter}>{letter}</span>
                <span className={styles.choiceText}>{opt}</span>
              </button>
            );
          })}
        </div>
      );

    case "stars":
      return (
        <div className={styles.starsWrapper}>
          <div className={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                type="button"
                className={`${styles.starTile} ${value === star ? styles.starTileActive : ""} ${star <= (value || 0) ? styles.starTileFilled : ""}`}
                onClick={() => updateAnswer(q.id, star, true)}
                aria-label={`${star} star${star > 1 ? "s" : ""}`}
                aria-pressed={value === star}
              >
                <svg viewBox="0 0 24 24" fill={star <= (value || 0) ? "#F2A93B" : "#C9D4EE"}>
                  <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
              </button>
            ))}
          </div>
          <span className={styles.starLabel}>
            {value ? STAR_LABELS[value - 1] : "Tap a star"}
          </span>
        </div>
      );

    case "grid":
      return (
        <div className={styles.gridCards}>
          {q.rows.map((row) => {
            const rowValue = value?.[row];
            const isComplete = rowValue !== undefined && rowValue !== null;
            return (
              <div key={row} className={`${styles.gridCard} ${isComplete ? styles.gridCardComplete : ""}`}>
                <div className={styles.gridCardHeader}>
                  <span className={styles.gridCardLabel}>{row}</span>
                  {isComplete && (
                    <span className={styles.gridCardCheck}>✓</span>
                  )}
                </div>
                <div className={styles.gridStars}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      className={styles.gridStarBtn}
                      onClick={() => updateGridAnswer(q.id, row, star)}
                      aria-label={`${star} star${star > 1 ? "s" : ""} for ${row}`}
                    >
                      <svg viewBox="0 0 24 24" fill={star <= (rowValue || 0) ? "#F2A93B" : "#C9D4EE"}>
                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                      </svg>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      );

    case "scale":
      return (
        <div className={styles.scaleWrapper}>
          <div className={styles.scaleGrid}>
            {Array.from({ length: q.max - q.min + 1 }, (_, i) => q.min + i).map((num) => (
              <button
                key={num}
                type="button"
                className={`${styles.scaleBtn} ${value === num ? styles.scaleBtnActive : ""}`}
                onClick={() => updateAnswer(q.id, num, true)}
                aria-pressed={value === num}
              >
                {num}
              </button>
            ))}
          </div>
          <div className={styles.scaleLabels}>
            <span>{q.min} · {q.minLabel}</span>
            <span>{q.max} · {q.maxLabel}</span>
          </div>
        </div>
      );

    case "checkboxes":
      const hasOther = (value || []).includes("Other");
      return (
        <div className={styles.checkboxWrapper}>
          <div className={styles.checkboxChips}>
            {q.options.map((opt) => {
              const isChecked = (value || []).includes(opt);
              return (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.checkboxChip} ${isChecked ? styles.checkboxChipActive : ""}`}
                  onClick={() => toggleCheckbox(q.id, opt)}
                  aria-pressed={isChecked}
                >
                  <span className={styles.checkboxIcon}>
                    {isChecked ? "✓" : "+"}
                  </span>
                  <span>{opt}</span>
                </button>
              );
            })}
          </div>
          {q.hasOtherText && hasOther && (
            <input
              type="text"
              className={styles.otherInput}
              placeholder="Please specify..."
              value={otherText || ""}
              onChange={(e) => updateOtherText(q.id, e.target.value)}
              maxLength={100}
            />
          )}
        </div>
      );

    case "long":
      return (
        <div className={styles.longWrapper}>
          <textarea
            className={styles.longTextarea}
            value={value || ""}
            onChange={(e) => updateAnswer(q.id, e.target.value)}
            placeholder={q.placeholder || ""}
            maxLength={q.maxLength || 1000}
            rows={5}
          />
          {q.id === "story" && (
            <p className={styles.storyHint}>Please leave out names and personal details.</p>
          )}
          <span className={styles.charCount}>
            {(value || "").length} / {q.maxLength || 1000}
          </span>
        </div>
      );

    default:
      return null;
  }
}

// Searchable Dropdown Component
function SearchableDropdown({ options, value, onChange, placeholder }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        setIsOpen(false);
        setSearch("");
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const filtered = options.filter((opt) =>
    opt.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelect = (opt) => {
    onChange(opt);
    setIsOpen(false);
    setSearch("");
  };

  return (
    <div ref={wrapperRef} className={styles.dropdown}>
      <button
        type="button"
        className={styles.dropdownTrigger}
        onClick={() => {
          setIsOpen(!isOpen);
          if (!isOpen) {
            setTimeout(() => inputRef.current?.focus(), 0);
          }
        }}
      >
        <span className={value ? styles.dropdownValue : styles.dropdownPlaceholder}>
          {value || placeholder}
        </span>
        <svg className={styles.dropdownArrow} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div className={styles.dropdownMenu}>
          <input
            ref={inputRef}
            type="text"
            className={styles.dropdownSearch}
            placeholder="Type to search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div className={styles.dropdownOptions}>
            {filtered.length === 0 ? (
              <div className={styles.dropdownEmpty}>No matches</div>
            ) : (
              filtered.map((opt) => (
                <button
                  key={opt}
                  type="button"
                  className={`${styles.dropdownOption} ${value === opt ? styles.dropdownOptionActive : ""}`}
                  onClick={() => handleSelect(opt)}
                >
                  {opt}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
