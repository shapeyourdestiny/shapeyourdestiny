import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOpenCoverageRequests, getMyCoverageRequests } from "@/lib/coverage/queries";
import CoverageBoard from "./CoverageBoard";

export const metadata = {
  title: "Coverage Board | Shape Your Destiny",
  description: "Pick up sessions when teammates need coverage.",
};

export default async function CoveragePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  // Get profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name")
    .eq("id", user.id)
    .single();

  if (!profile) {
    redirect("/instructor-login");
  }

  // Fetch coverage data
  let openRequests = [];
  let myRequests = { coveredForYou: [], claimed: [] };

  try {
    [openRequests, myRequests] = await Promise.all([
      getOpenCoverageRequests(user.id),
      getMyCoverageRequests(user.id),
    ]);
  } catch (e) {
    console.error("Error fetching coverage data:", e);
  }

  return (
    <CoverageBoard
      openRequests={openRequests}
      myRequests={myRequests}
    />
  );
}
