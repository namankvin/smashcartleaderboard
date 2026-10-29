/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Production gets contacts from MongoDB; private local input files are not
    // dependencies of any Vercel function.
    outputFileTracingExcludes: {
      "/api/**/*": ["./data/**/*", "./tests/**/*", "./scripts/**/*", "./.env*"],
    },
  },
};
export default nextConfig;
