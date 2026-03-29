"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";

const UTM_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const;
const STORAGE_KEY = "utm_params";
const LAST_SENT_KEY = "utm_last_sent";
const DEDUP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Capture UTM params from URL on mount and persist in sessionStorage. */
export function useUtmCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const params: Record<string, string> = {};
    let hasAny = false;

    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        params[key] = value;
        hasAny = true;
      }
    }

    // Only overwrite if the current URL actually has UTM params
    if (hasAny) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(params));
      } catch {
        // sessionStorage unavailable (private browsing edge cases)
      }
    }
  }, [searchParams]);
}

/** Read stored UTM params (call when submitting forms). */
export function getStoredUtmParams(): Record<string, string> {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * UtmTracker — invisible component that records UTM events to the server.
 * Place in root layout inside <Suspense>.
 *
 * - URL has UTM + logged in → POST immediately
 * - URL has UTM + NOT logged in → store in sessionStorage (for later)
 * - After login redirect (no UTM in URL, but sessionStorage has UTM) → POST + clear
 * - Deduplicates: skips if same params were sent within 5 minutes
 */
export function UtmTracker() {
  const searchParams = useSearchParams();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === "loading") return;

    // Collect UTM from URL
    const urlParams: Record<string, string> = {};
    let hasUrlUtm = false;
    for (const key of UTM_KEYS) {
      const value = searchParams.get(key);
      if (value) {
        urlParams[key] = value;
        hasUrlUtm = true;
      }
    }

    // If URL has UTM, always store in sessionStorage (for signup flow)
    if (hasUrlUtm) {
      try {
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(urlParams));
      } catch {
        // ignore
      }
    }

    // Determine UTM params to send (URL params take priority, fallback to sessionStorage)
    const utmParams = hasUrlUtm ? urlParams : getStoredUtmParams();
    const utmSource = utmParams.utm_source;

    // Need both: a logged-in user AND utm_source
    if (!session?.user?.id || !utmSource) return;

    // Deduplication: skip if same params sent recently
    try {
      const lastSentRaw = sessionStorage.getItem(LAST_SENT_KEY);
      if (lastSentRaw) {
        const lastSent = JSON.parse(lastSentRaw);
        const elapsed = Date.now() - (lastSent.timestamp || 0);
        if (elapsed < DEDUP_WINDOW_MS && lastSent.utmSource === utmSource
          && lastSent.utmMedium === (utmParams.utm_medium || "")
          && lastSent.utmCampaign === (utmParams.utm_campaign || "")) {
          return; // Skip duplicate
        }
      }
    } catch {
      // ignore
    }

    // Send UTM event to server
    const payload = {
      utmSource,
      utmMedium: utmParams.utm_medium || "",
      utmCampaign: utmParams.utm_campaign || "",
      utmContent: utmParams.utm_content || "",
      utmTerm: utmParams.utm_term || "",
      url: window.location.href,
      eventType: "visit",
    };

    // Write dedup key BEFORE fetch to prevent race conditions
    // (useEffect can fire multiple times before the first fetch resolves)
    try {
      sessionStorage.setItem(
        LAST_SENT_KEY,
        JSON.stringify({
          utmSource: payload.utmSource,
          utmMedium: payload.utmMedium,
          utmCampaign: payload.utmCampaign,
          timestamp: Date.now(),
        })
      );
      sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }

    fetch("/api/utm-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(console.error);
  }, [searchParams, session, status]);

  return null;
}
