import { notFound } from "next/navigation";
import { RESEARCH_TOPICS, getAllTopicSlugs } from "../../../lib/research-data";
import ResearchArticle from "../../components/ResearchArticle";
import Header from "../../components/Header";
import Footer from "../../components/Footer";

// Pre-builds all six pages at deploy time (yoga-breathwork, mindfulness, etc.)
export function generateStaticParams() {
  return getAllTopicSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({ params }) {
  const { slug } = await params;
  const topic = RESEARCH_TOPICS[slug];
  if (!topic) return {};
  return {
    title: `${topic.title} - The Research | Shape Your Destiny`,
    description: topic.dek,
  };
}

export default async function ResearchTopicPage({ params }) {
  const { slug } = await params;
  const topic = RESEARCH_TOPICS[slug];
  if (!topic) notFound();

  return (
    <>
      <Header />
      <ResearchArticle topic={topic} allSlugs={getAllTopicSlugs().filter((s) => s !== slug)} />
      <Footer />
    </>
  );
}
