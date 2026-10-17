/** @type {import('next').NextConfig} */
const nextConfig = {
  async redirects() {
    return [
      {
        source: '/recently-sold',
        destination: '/sold-by-gurmeet',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
