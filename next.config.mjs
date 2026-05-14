/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: "/newsfeed",
        destination: "/community",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
