/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV === "development";

const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self' blob:",
  "child-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@paperzero/shared",
    "@paperzero/pdf-compression",
    "@paperzero/pdf-core",
    "@paperzero/pdf-operations",
    "@paperzero/pdf-ui",
  ],
  webpack(config) {
    // The Emscripten bundle contains guarded Node branches that are unreachable
    // in the browser worker. Mark their core modules unavailable so webpack can
    // compile the browser branch without injecting server polyfills.
    config.resolve.fallback = {
      ...(config.resolve.fallback ?? {}),
      module: false,
      fs: false,
      path: false,
      url: false,
      crypto: false,
    };
    return config;
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;
