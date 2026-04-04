/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required for production Dockerfile.prod (standalone build)
  output: process.env.NODE_ENV === "production" ? "standalone" : undefined,

  // Proxy API calls to FastAPI backend — no CORS issues in dev
  async rewrites() {
    return [
      {
        source: "/api/backend/:path*",
        destination: `${process.env.NEXT_PUBLIC_API_URL}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;
