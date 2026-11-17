import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import {
  getAllResources,
  listResourceFiles,
  getResourceOpenCount,
  getActiveInstructorCount,
} from "@/lib/resources/queries";
import ResourcesClient from "./ResourcesClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Resources | Admin",
};

export default async function ResourcesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/instructor-login");
  }

  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role, full_name")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || profile.role !== "admin") {
    redirect("/instructor/dashboard");
  }

  // Get all resources
  const resources = await getAllResources();

  // Get history and stats for each resource
  const resourcesWithData = await Promise.all(
    resources.map(async (resource) => {
      const history = await listResourceFiles(resource.key);
      const openCount = resource.version_label
        ? await getResourceOpenCount(resource.key, resource.version_label)
        : 0;
      return { ...resource, history, openCount };
    })
  );

  // Get total active instructors for the "opened by X of Y" stat
  const totalInstructors = await getActiveInstructorCount();

  return (
    <ResourcesClient
      resources={resourcesWithData}
      totalInstructors={totalInstructors}
    />
  );
}
