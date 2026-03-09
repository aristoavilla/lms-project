import posthog from "posthog-js";

const key = import.meta.env.VITE_PUBLIC_POSTHOG_KEY as string | undefined;
const host = (import.meta.env.VITE_PUBLIC_POSTHOG_HOST as string | undefined) ?? "https://app.posthog.com";

let initialized = false;

export function initPosthog() {
  if (initialized || !key) {
    return;
  }

  posthog.init(key, {
    api_host: host,
    capture_pageview: true,
    capture_pageleave: true,
  });

  initialized = true;
}
