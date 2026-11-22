import SCHOOLS from "./schools";

const soccerFeedbackSurvey = {
  slug: "soccer-feedback",
  title: "How did intramural soccer go?",
  intro: "Help us make the program even better for your students. Takes about 4 minutes. You can stay anonymous if you prefer.",
  pill: "For our partner schools",
  closingText: "Your answers go straight to the Shape Your Destiny team.",
  closesAt: null, // Set to a Date string when you want to close the survey
  audience: "For schools",
  status: "open", // draft, open, or closed
  icon: "ball",

  sections: [
    {
      title: "About you",
      help: "All optional. Share as much or as little as you like.",
      questions: [
        {
          id: "school",
          type: "dropdown",
          label: "Your school",
          required: false,
          options: ["Prefer not to say", ...SCHOOLS],
          help: 'Type to search, or pick "Prefer not to say".',
        },
        {
          id: "role",
          type: "choice",
          label: "Your role",
          required: false,
          options: [
            "Principal",
            "Teacher",
            "Office staff",
            "After-school coordinator",
            "Other",
            "Prefer not to say",
          ],
          hasOtherText: true,
        },
        {
          id: "name",
          type: "short",
          label: "Your name",
          required: false,
          placeholder: "Leave blank to stay anonymous",
          maxLength: 100,
        },
      ],
    },
    {
      title: "The program",
      questions: [
        {
          id: "overall",
          type: "stars",
          label: "Overall, how satisfied are you with the program?",
          required: true,
        },
        {
          id: "ratings",
          type: "grid",
          label: "How would you rate us on...",
          required: true,
          rows: [
            "Communication",
            "Coach professionalism",
            "Student engagement",
            "Showing up on time",
          ],
          help: "1 = needs work, 5 = excellent",
        },
        {
          id: "active",
          type: "choice",
          label: "Have you seen more excitement about being active?",
          required: true,
          options: ["Yes", "Somewhat", "Not yet"],
        },
        {
          id: "enjoyed",
          type: "long",
          label: "What did students enjoy most?",
          required: false,
          maxLength: 1000,
        },
        {
          id: "improve",
          type: "long",
          label: "What could we improve?",
          required: false,
          maxLength: 1000,
          followUpFor: {
            questions: ["overall", "ratings"],
            max: 2,
            title: "Thanks for being honest. What could we do better?",
            help: "Even a sentence helps us fix it.",
          },
        },
      ],
    },
    {
      title: "Impact at your school",
      questions: [
        {
          id: "attendance",
          type: "choice",
          label: "Since soccer started, has after-school program attendance changed?",
          required: true,
          options: ["Gone up a lot", "Gone up a little", "Stayed the same", "Not sure"],
        },
        {
          id: "stay_longer",
          type: "choice",
          label: "Are parents leaving students in the after-school program longer because of soccer?",
          required: true,
          options: ["Yes", "Somewhat", "No", "Not sure"],
        },
        {
          id: "confidence",
          type: "choice",
          label: "Have you noticed students' self-confidence improving?",
          required: true,
          options: ["Yes, a lot", "A little", "Not really", "Not sure"],
        },
        {
          id: "story",
          type: "long",
          label: "Is there a student whose growth stood out to you?",
          required: false,
          placeholder: "For example, a shy student who came out of their shell. Please leave out names and personal details.",
          help: "Please don't include student names or personal details.",
          maxLength: 1000,
        },
      ],
    },
    {
      title: "Looking ahead",
      questions: [
        {
          id: "recommend",
          type: "scale",
          label: "How likely are you to recommend us to another school?",
          required: true,
          min: 0,
          max: 10,
          minLabel: "Not likely",
          maxLabel: "Very likely",
        },
        {
          id: "parent_requests",
          type: "checkboxes",
          label: "What programs have parents been asking about?",
          required: false,
          options: [
            "Basketball",
            "Yoga",
            "Dance",
            "Flag football",
            "Softball",
            "Other",
          ],
          hasOtherText: true,
        },
        {
          id: "bring_next",
          type: "long",
          label: "What would you like Shape Your Destiny to bring to your school?",
          required: false,
          maxLength: 1000,
        },
        {
          id: "anything_else",
          type: "long",
          label: "Anything else you'd like to add?",
          required: false,
          maxLength: 1000,
          placeholder: "Optional thoughts, questions, or feedback",
        },
      ],
    },
  ],
};

// Helper to get all required question IDs
export function getRequiredQuestionIds(survey) {
  const ids = [];
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.required) {
        ids.push(q.id);
      }
    }
  }
  return ids;
}

// Helper to get all question definitions by ID
export function getQuestionMap(survey) {
  const map = {};
  for (const section of survey.sections) {
    for (const q of section.questions) {
      map[q.id] = q;
    }
  }
  return map;
}

// Helper to count required questions
export function countRequiredQuestions(survey) {
  let count = 0;
  for (const section of survey.sections) {
    for (const q of section.questions) {
      if (q.required) {
        count++;
      }
    }
  }
  return count;
}

export default soccerFeedbackSurvey;
