import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // El indicador de desarrollo tapaba "Cerrar sesión" en el sidebar.
  devIndicators: { position: "bottom-right" },
};

export default nextConfig;
