/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true
  },
  experimental: {
    turbo: {
      resolveAlias: {
        '@/components': './components',
        '@/lib': './lib',
        '@/web3': './lib/web3'
      }
    },
  },
  // Pages Router'ı kullan
  // Environment variables
  env: {
    NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_SWAP_CONTRACT_ADDRESS,
    NEXT_PUBLIC_BILL_TOKEN_ADDRESS: process.env.NEXT_PUBLIC_BILL_TOKEN_ADDRESS,
    NEXT_PUBLIC_GAME_CONTRACT_ADDRESS: process.env.NEXT_PUBLIC_GAME_CONTRACT_ADDRESS,
    RPC_URL: process.env.RPC_URL,
    CHAIN_ID: process.env.CHAIN_ID,
  },
  // Webpack yapılandırması
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        path: false,
        stream: false,
        crypto: false,
        http: false,
        https: false,
        zlib: false,
        os: false,
        querystring: false,
        url: false,
        util: false,
      };
    }
    return config;
  },
};

// Relayer key'lerini ekle
for (let i = 1; i <= 50; i++) {
  const key = `NEXT_PUBLIC_RELAYER_KEY_${i}`;
  nextConfig.env[key] = process.env[key];
}

module.exports = nextConfig;
