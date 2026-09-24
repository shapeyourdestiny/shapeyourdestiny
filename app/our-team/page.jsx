import { unstable_cache } from "next/cache";
import Header from "../components/Header";
import Footer from "../components/Footer";
import { getPublicStaff } from "@/lib/staff/queries";
import StaffHero from "./StaffHero";
import LeadershipSection from "./LeadershipSection";
import InstructorsSection from "./InstructorsSection";
import ValuesSection from "./ValuesSection";
import JoinSection from "./JoinSection";

export const metadata = {
  title: "Our Team — Shape Your Destiny",
  description:
    "Meet the instructors and coaches who bring yoga, movement, team sports and mindfulness to schools across California.",
};

// Revalidate every 60 seconds as a safety net
export const revalidate = 60;

// Cache the staff data with a tag for on-demand revalidation
const getCachedStaff = unstable_cache(
  async () => getPublicStaff(),
  ["public-staff"],
  { tags: ["staff"], revalidate: 60 }
);

export default async function OurTeamPage() {
  const { leadership, instructors, programs } = await getCachedStaff();

  return (
    <>
      <Header />
      <main>
        <StaffHero />
        <LeadershipSection members={leadership} />
        <InstructorsSection members={instructors} programs={programs} />
        <ValuesSection />
        <JoinSection />
      </main>
      <Footer />
    </>
  );
}
