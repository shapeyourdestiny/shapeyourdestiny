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
          mainSrc="/images/whole-child-main.jpg"
          mainAlt="Instructor leading kids through a mindfulness activity"
          insetSrc="/images/whole-child-inset.jpg"
          insetAlt="Program instructor"
        />

        <SplitSection
          reverse
          eyebrow="Youth Wellness Programs"
          heading="Before & After School"
          paragraphs={[
            "Our programs help children stay active while also learning skills that support them at school, at home, and in life. They connect movement, breathing, and social-emotional learning (SEL) so kids understand the link between how their bodies feel and how their emotions work.",
            "Our instructors are trained to create a safe, encouraging space for every child, whether shy, full of energy, or somewhere in between, meeting them where they are and helping them grow.",
          ]}
          mainSrc="/images/before-after-main.jpg"
          mainAlt="Kids doing yoga outdoors"
          insetSrc="/images/before-after-inset.jpg"
          insetAlt="Instructor teaching a stretch"
        />

        <ProgramActivities />
        <ResearchGrid />
        <CTA />
      </main>

      <Footer />
    </>
  );
}
