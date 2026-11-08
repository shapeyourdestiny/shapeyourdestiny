/**
 * Verify a Cloudflare Turnstile token on the server.
 *
 * @param {string} token - The turnstile token from the client
 * @param {string} ip - The client IP address (optional, for additional validation)
 * @returns {Promise<{success: boolean, error?: string}>}
 */
export async function verifyTurnstileToken(token, ip) {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    console.warn("TURNSTILE_SECRET_KEY not configured - skipping verification");
    // In development without keys, allow the request
    if (process.env.NODE_ENV === "development") {
      return { success: true };
    }
    return { success: false, error: "CAPTCHA not configured" };
  }

  if (!token) {
    return { success: false, error: "CAPTCHA token required" };
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (ip) {
      formData.append("remoteip", ip);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      }
    );

    const data = await response.json();

    if (data.success) {
      return { success: true };
    }

    console.warn("Turnstile verification failed:", data["error-codes"]);
    return { success: false, error: "CAPTCHA verification failed" };
  } catch (error) {
    console.error("Turnstile verification error:", error);
    return { success: false, error: "CAPTCHA verification error" };
  }
}
