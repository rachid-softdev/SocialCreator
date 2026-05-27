import type { Metadata } from "next";
import { EB_Garamond, Inter, Playfair_Display } from "next/font/google";
import "./globals.css";
import { ToastLayoutWrapper } from "@/components/toast-layout-wrapper";

export const metadata: Metadata = {
  title: "SocialCreator - AI-Powered Social Media Content",
  description: "Generate and publish social media content using AI agents",
};

// Inter for body/sans-serif text - zero layout shift, auto-optimisé
const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["300", "400", "500", "600"],
});

// EB Garamond for display/headings - replaces licensed Waldenburg
const ebGaramond = EB_Garamond({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-eb-garamond",
  weight: ["400", "500", "600"],
});

// Playfair Display for alternative headings
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`antialiased ${inter.variable} ${ebGaramond.variable} ${playfair.variable}`}>
        <ToastLayoutWrapper>{children}</ToastLayoutWrapper>
      </body>
    </html>
  );
}
