/**
 * Get a directions URL for a specific maps app.
 *
 * @param {string} address - The destination address
 * @param {string} app - Maps app: "apple", "google", or "waze"
 * @returns {string} URL that opens the specified maps app
 */
export function getDirectionsUrlForApp(address, app) {
  const encoded = encodeURIComponent(address);

  switch (app) {
    case "apple":
      return `https://maps.apple.com/?daddr=${encoded}`;
    case "google":
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
    case "waze":
      return `https://waze.com/ul?q=${encoded}&navigate=yes`;
    default:
      return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
  }
}

/**
 * Check if the user is on an Apple device (iOS or macOS).
 * Used to show/hide Apple Maps option.
 *
 * IMPORTANT: This uses navigator.userAgent, so it only works client-side.
 */
export function isApplePlatform() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;

  // Check for iOS (including iPad on iPadOS which reports as Macintosh with touch)
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);

  // Check for macOS (but not iOS/iPadOS)
  const isMac = ua.includes('Macintosh') && !isIOS;

  return isIOS || isMac;
}

/**
 * Get a platform-appropriate directions URL for the given address.
 * If a preferred app is provided, it uses that app.
 * Otherwise, it falls back to platform defaults.
 *
 * IMPORTANT: This uses navigator.userAgent, so it only works client-side.
 * Only call this from within a "use client" component, not from server-side code.
 *
 * @param {string} address - The destination address
 * @param {string|null} preferredApp - Preferred maps app: "apple", "google", "waze", or null for auto
 * @returns {string} URL that opens the appropriate maps app
 */
export function getDirectionsUrl(address, preferredApp = null) {
  // If user has a preference, use it
  if (preferredApp) {
    return getDirectionsUrlForApp(address, preferredApp);
  }

  // Otherwise, use platform defaults
  const encoded = encodeURIComponent(address);
  const ua = navigator.userAgent;

  // Check for iOS (including iPad on iPadOS which reports as Macintosh with touch)
  const isIOS = /iPad|iPhone|iPod/.test(ua) ||
    (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);

  // Check for macOS (but not iOS/iPadOS)
  const isMac = ua.includes('Macintosh') && !isIOS;

  // Check for Android
  const isAndroid = /Android/.test(ua);

  // iOS and macOS use Apple Maps
  if (isIOS || isMac) {
    return `https://maps.apple.com/?daddr=${encoded}`;
  }

  // Android uses geo: intent (opens in default maps app)
  if (isAndroid) {
    return `geo:0,0?q=${encoded}`;
  }

  // Fallback to Google Maps web
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}
