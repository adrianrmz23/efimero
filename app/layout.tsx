import type { Metadata } from "next";
import "./globals.css";
import AuthSessionSync from "@/components/auth/AuthSessionSync";

export const metadata: Metadata = {
  title: "Efímero Content Engine",
  description: "Motor editorial y calendario inteligente para Efímero",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><AuthSessionSync/>{children}</body>
    </html>
  );
}
