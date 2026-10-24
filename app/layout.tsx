import type { Metadata } from "next";
import "./globals.css";
import "./ui-system.css";
import "./styles/calendar.css";
import "./styles/studio.css";
import "./styles/inspiration.css";
import "./styles/insights.css";
import "./styles/settings.css";
import "./styles/dialogs.css";
import AuthSessionSync from "@/components/auth/AuthSessionSync";
import { DialogProvider } from "@/components/ui/DialogProvider";

export const metadata: Metadata = {
  title: "Efímero Content Engine",
  description: "Motor editorial y calendario inteligente para Efímero",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body><AuthSessionSync/><DialogProvider>{children}</DialogProvider></body>
    </html>
  );
}
