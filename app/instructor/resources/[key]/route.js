import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request, { params }) {
  const { key } = await params;
  const supabase = await createClient();

  // Check if user is logged in
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    // Redirect to login with return URL
    const returnUrl = `/instructor/resources/${key}`;
    return redirect(`/instructor-login?next=${encodeURIComponent(returnUrl)}`);
  }

  // Check user role using admin client (bypasses RLS)
  const adminClient = createAdminClient();
  const { data: profile } = await adminClient
    .from("profiles")
    .select("id, role")
    .or(`user_id.eq.${user.id},id.eq.${user.id}`)
    .maybeSingle();

  if (!profile || !["instructor", "admin"].includes(profile.role)) {
    return new Response("Unauthorized", { status: 403 });
  }

  // Look up the resource
  const { data: resource } = await adminClient
    .from("resources")
    .select("*")
    .eq("key", key)
    .maybeSingle();

  if (!resource) {
    return new Response("Resource not found", { status: 404 });
  }

  // If no file uploaded yet, show "coming soon" page
  if (!resource.file_path) {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${resource.title} | Shape Your Destiny</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: #F4F7FC;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }
    .card {
      background: white;
      border-radius: 16px;
      padding: 32px;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 24px rgba(0,0,0,0.08);
    }
    h1 {
      font-size: 20px;
      color: #16193B;
      margin-bottom: 12px;
    }
    p {
      font-size: 15px;
      color: #4A5170;
      line-height: 1.5;
    }
    a {
      display: inline-block;
      margin-top: 20px;
      color: #3E8FA0;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <div class="card">
    <h1>${resource.title}</h1>
    <p>The handbook isn't available yet. Check back soon.</p>
    <a href="/instructor/forms">&larr; Back to Resources</a>
  </div>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Track open for instructors (not admins)
  if (profile.role === "instructor" && resource.version_label) {
    // Insert open record (upsert to avoid duplicates)
    await adminClient
      .from("resource_opens")
      .upsert({
        resource_key: key,
        version_label: resource.version_label,
        profile_id: profile.id,
        opened_at: new Date().toISOString(),
      }, {
        onConflict: "resource_key,version_label,profile_id",
        ignoreDuplicates: true,
      });
  }

  // Create a signed URL (5 minutes)
  const { data: signedUrlData, error: signedUrlError } = await adminClient
    .storage
    .from("resources")
    .createSignedUrl(resource.file_path, 300, {
      download: false, // inline, not forced download
    });

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("Error creating signed URL:", signedUrlError);
    return new Response("Error accessing file", { status: 500 });
  }

  // Redirect to the signed URL
  return redirect(signedUrlData.signedUrl);
}
