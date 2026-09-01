import { redirect } from "next/navigation";
import { getMyProfile } from "@/lib/instructors/self-service";
import ProfileClient from "./ProfileClient";

export const metadata = {
  title: "Profile | Shape Your Destiny",
  description: "Manage your instructor profile.",
};

export default async function InstructorProfilePage() {
  const profile = await getMyProfile();

  if (!profile) {
    redirect("/instructor-login");
  }

  return <ProfileClient profile={profile} />;
}
