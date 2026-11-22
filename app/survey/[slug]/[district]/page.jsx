import { notFound } from "next/navigation";
import SurveyClient from "../SurveyClient";
import { getSurvey } from "@/lib/surveys";
import { getSendByLinkSlug, isSendOpen } from "@/lib/surveys/sends";

export async function generateMetadata({ params }) {
  const { slug, district } = await params;
  const survey = getSurvey(slug);
  const send = await getSendByLinkSlug(slug, district);

  if (!survey || !send) {
    return { title: "Survey Not Found" };
  }

  const districtName = send.districts?.name || district;

  return {
    title: `${survey.title} - ${districtName} - Shape Your Destiny`,
    description: survey.intro,
    robots: { index: false, follow: false },
  };
}

export default async function DistrictSurveyPage({ params }) {
  const { slug, district } = await params;
  const survey = getSurvey(slug);

  if (!survey) {
    notFound();
  }

  // Look up the send for this district link
  const send = await getSendByLinkSlug(slug, district);

  if (!send) {
    notFound();
  }

  // Check if the send is closed
  const isOpen = isSendOpen(send);
  const isClosed = !isOpen;

  // Build district info for the client
  const districtInfo = {
    id: send.district_id,
    name: send.districts?.name || district,
    linkSlug: send.link_slug,
    schools: send.schools || [],
  };

  return (
    <SurveyClient
      survey={survey}
      isClosed={isClosed}
      isDraft={false}
      districtInfo={districtInfo}
    />
  );
}
