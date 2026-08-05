import type { NextConfig } from "next";

// Fixed Supabase project host (see lib/supabase.ts — the URL is hardcoded
// there too, not an env var) so CSP connect-src can name it explicitly
// instead of falling back to a wildcard.
const SUPABASE_HOST = "ctibusjfvbffdlmzkqxh.supabase.co";

const csp = [
  "default-src 'self'",
  // Next.js ships an inline bootstrap script and (in dev) uses eval for
  // fast refresh — 'unsafe-inline'/'unsafe-eval' stay necessary without a
  // nonce-based setup, which is a bigger change than this pass covers.
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  // The app uses React's style={{...}} prop extensively (RevenueTab,
  // LeadSlideOver, etc.) — that's an inline style attribute, which CSP
  // treats the same as a <style> tag and requires 'unsafe-inline' for.
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://${SUPABASE_HOST} wss://${SUPABASE_HOST}`,
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
