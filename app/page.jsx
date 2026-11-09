import Header from "./components/Header";
import Hero from "./components/Hero";
import Intro from "./components/Intro";
import TrustMarquee from "./components/TrustMarquee";
import Statement from "./components/Statement";
import SplitSection from "./components/SplitSection";
import ProgramActivities from "./components/ProgramActivities";
import ResearchGrid from "./components/ResearchGrid";
import CTA from "./components/CTA";
import Footer from "./components/Footer";

export const metadata = {
  title: "Youth Wellness & After-School Programs in the Inland Empire | Shape Your Destiny",
  description:
    "Shape Your Destiny offers holistic youth wellness programs in the Inland Empire, combining fitness, mindfulness, nutrition, and social-emotional learning to help children build confidence and thrive.",
  openGraph: {
    title: "Youth Wellness & After-School Programs | Shape Your Destiny",
    description:
      "Holistic youth wellness programs combining fitness, mindfulness, nutrition, and SEL to help children thrive.",
    url: "https://shapeyourdestiny.co",
    siteName: "Shape Your Destiny",
    images: [
      {
        url: "/Images/hero-kids.webp",
        width: 1200,
        height: 630,
        alt: "Shape Your Destiny - Youth Wellness Programs",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Youth Wellness & After-School Programs | Shape Your Destiny",
    description:
      "Holistic youth wellness programs combining fitness, mindfulness, nutrition, and SEL to help children thrive.",
    images: ["/Images/hero-kids.webp"],
  },
  alternates: {
    canonical: "https://shapeyourdestiny.co",
  },
};

export default function Home() {
  return (
    <>
      <Header />

      <main>
        <Hero />
        <Intro />
        <TrustMarquee />
        <Statement />

        <SplitSection
          eyebrow="Our Approach"
          heading={'Our "Whole Child" Approach'}
          paragraphs={[
            "At Shape Your Destiny, we know kids need more than fitness or nutrition alone. True growth happens when children connect the dots. They see that moving their bodies and eating well also shapes how they feel emotionally.",
            "This approach makes them more engaged, confident, and resilient.",
          ]}
          imageSrc="/Images/whole-child-main.webp"
          imageAlt="Instructor leading kids through a mindfulness activity"
        />

        <SplitSection
          reverse
          eyebrow="Youth Wellness Programs"
          heading="Before & After School"
          paragraphs={[
            "Our programs help children stay active while also learning skills that support them at school, at home, and in life. They connect movement, breathing, and social-emotional learning (SEL) so kids understand the link between how their bodies feel and how their emotions work.",
            "Our instructors are trained to create a safe, encouraging space for every child, whether shy, full of energy, or somewhere in between, meeting them where they are and helping them grow.",
          ]}
          imageSrc="/Images/whole-child-inset.webp"
          imageAlt="Kids doing yoga outdoors with instructor"
        />

        <ProgramActivities />
        <ResearchGrid />
        <CTA />
      </main>

      <Footer />
    </>
  );
}
