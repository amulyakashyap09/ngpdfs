/** @type {import('next').NextConfig} */
const nextConfig = {
  output: "export",
  reactStrictMode: true,
  transpilePackages: [
    "@paperzero/shared",
    "@paperzero/pdf-compression",
    "@paperzero/pdf-conversion",
    "@paperzero/pdf-extraction",
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
};

export default nextConfig;
