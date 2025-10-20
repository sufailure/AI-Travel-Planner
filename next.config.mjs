/** @type {import('next').NextConfig} */
const nextConfig = {
    reactStrictMode: true,
    experimental: {
        serverComponentsExternalPackages: ['ws'],
    },
};

export default nextConfig;
