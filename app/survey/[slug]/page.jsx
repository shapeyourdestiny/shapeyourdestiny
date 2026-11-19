import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import SurveyClient from "./SurveyClient";
import soccerFeedbackSurvey from "@/lib/surveys/soccer-feedback";

// Map of available surveys
const SURVEYS = {
  "soccer-feedback": soccerFeedbackSurvey,
};

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const survey = SURVEYS[slug];

  if (!survey) {
    return { title: "Survey Not Found" };
  }

  return {
    title: `${survey.title} - Shape Your Destiny`,
    description: survey.intro,
    robots: { index: false, follow: false },
  };
}

export default async function SurveyPage({ params }) {
  const { slug } = await params;
  const survey = SURVEYS[slug];

  if (!survey) {
    notFound();
  }

  // Check if survey is closed
  const isClosed = survey.closesAt && new Date() > new Date(survey.closesAt);

  return (
    <>
      <Header />
      <main>
        <SurveyClient survey={survey} isClosed={isClosed} />
      </main>
      <Footer />
    </>
  );
}
