/**
 * Get a platform-appropriate directions URL for the given address.
 *
 * IMPORTANT: This uses navigator.userAgent, so it only works client-side.
 * Only call this from within a "use client" component, not from server-side code.
 *
 * @param {string} address - The destination address
 * @returns {string} URL that opens the appropriate maps app
 */
export function getDirectionsUrl(address) {
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
