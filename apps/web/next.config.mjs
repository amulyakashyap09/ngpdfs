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
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
];

const lockedPermissions = "camera=(), microphone=(), geolocation=(), interest-cohort=()";
const scanPermissions = "camera=(self), microphone=(), geolocation=(), interest-cohort=()";

const nextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@paperzero/shared",
    "@paperzero/pdf-compression",
    "@paperzero/pdf-ocr",
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
    // When multiple rules match, Next applies the later value for the same key.
    // Camera remains disabled everywhere except the explicit scanning route.
    return [
      {
        source: "/:path*",
        headers: [...securityHeaders, { key: "Permissions-Policy", value: lockedPermissions }],
      },
      {
        source: "/scan-to-pdf",
        headers: [{ key: "Permissions-Policy", value: scanPermissions }],
      },
    ];
  },
};

export default nextConfig;
