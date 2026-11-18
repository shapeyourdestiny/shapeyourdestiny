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
    return notFoundResponse();
  }

  // Instructors can only see visible, non-archived resources
  if (profile.role === "instructor") {
    if (!resource.visible || resource.archived_at) {
      return notFoundResponse();
    }
  }

  // Handle links
  if (resource.kind === "link") {
    if (!resource.url) {
      return notFoundResponse();
    }

    // Track open for instructors
    if (profile.role === "instructor") {
      await adminClient
        .from("resource_opens")
        .upsert({
          resource_key: key,
          version_label: "link",
          profile_id: profile.id,
          opened_at: new Date().toISOString(),
        }, {
          onConflict: "resource_key,version_label,profile_id",
          ignoreDuplicates: true,
        });
    }

    // Redirect to URL
    return redirect(resource.url);
  }

  // Handle files
  if (!resource.file_path) {
    // No file uploaded yet
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(resource.title)} | Shape Your Destiny</title>
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
    <h1>${escapeHtml(resource.title)}</h1>
    <p>This resource isn't available yet. Check back soon.</p>
    <a href="/instructor/forms">&larr; Back to Resources</a>
  </div>
</body>
</html>`;
    return new Response(html, {
      headers: { "Content-Type": "text/html" },
    });
  }

  // Track open for instructors
  if (profile.role === "instructor" && resource.version_label) {
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
      download: false,
    });

  if (signedUrlError || !signedUrlData?.signedUrl) {
    console.error("Error creating signed URL:", signedUrlError);
    return new Response("Error accessing file", { status: 500 });
  }

  // Redirect to the signed URL
  return redirect(signedUrlData.signedUrl);
}

function notFoundResponse() {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Not Found | Shape Your Destiny</title>
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
    <h1>Not Found</h1>
    <p>We couldn't find that resource.</p>
    <a href="/instructor/forms">&larr; Back to Resources</a>
  </div>
</body>
</html>`;
  return new Response(html, {
    status: 404,
    headers: { "Content-Type": "text/html" },
  });
}

function escapeHtml(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
