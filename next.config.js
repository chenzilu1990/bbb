/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    domains: [],
    remotePatterns: [],
  },
  webpack: (config) => {
    return config;
  },
};

module.exports = nextConfig; 