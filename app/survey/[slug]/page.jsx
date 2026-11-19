import { notFound } from "next/navigation";
import Header from "@/app/components/Header";
import Footer from "@/app/components/Footer";
import SurveyClient from "./SurveyClient";
import { getSurvey, getSurveyStatus } from "@/lib/surveys";

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const survey = getSurvey(slug);

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
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  const status = getSurveyStatus(survey);
  const isDraft = status === "draft";
  const isClosed = status === "closed";

  return (
    <>
      <Header />
      <main>
        <SurveyClient survey={survey} isClosed={isClosed} isDraft={isDraft} />
      </main>
      <Footer />
    </>
  );
}
