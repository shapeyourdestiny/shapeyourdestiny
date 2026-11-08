"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile CAPTCHA component.
 *
 * @param {Object} props
 * @param {function} props.onVerify - Callback with token when verification succeeds
 * @param {function} props.onError - Callback when verification fails (optional)
 * @param {function} props.onExpire - Callback when token expires (optional)
 * @param {"light" | "dark" | "auto"} props.theme - Widget theme
 * @param {"normal" | "compact"} props.size - Widget size
 */
export default function Turnstile({
  onVerify,
  onError,
  onExpire,
  theme = "auto",
  size = "normal",
}) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);

  useEffect(() => {
    const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

    if (!siteKey) {
      console.warn("NEXT_PUBLIC_TURNSTILE_SITE_KEY not configured");
      return;
    }

    // Load the Turnstile script if not already loaded
    if (!window.turnstile) {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => renderWidget();
      document.head.appendChild(script);
    } else {
      renderWidget();
    }

    function renderWidget() {
      if (!containerRef.current || widgetIdRef.current !== null) return;

      widgetIdRef.current = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        theme,
        size,
        callback: (token) => {
          onVerify?.(token);
        },
        "error-callback": () => {
          onError?.();
        },
        "expired-callback": () => {
          onExpire?.();
          // Auto-refresh the widget
          if (widgetIdRef.current !== null) {
            window.turnstile.reset(widgetIdRef.current);
          }
        },
      });
    }

    return () => {
      if (widgetIdRef.current !== null && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
        widgetIdRef.current = null;
      }
    };
  }, [onVerify, onError, onExpire, theme, size]);

  return <div ref={containerRef} />;
}
