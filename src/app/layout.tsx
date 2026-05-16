import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import "./globals.css";
import { ToastLayoutWrapper } from "@/components/toast-layout-wrapper";

export const metadata: Metadata = {
  title: "SocialCreator - AI-Powered Social Media Content",
  description: "Generate and publish social media content using AI agents",
};

// Playfair Display for display/headings (replaces licensed Waldenburg)
// Inter for body text is already in globals.css
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-display",
  display: "swap",
});

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`antialiased ${playfair.variable}`}>
        <ToastLayoutWrapper>
          {children}
        </ToastLayoutWrapper>
      </body>
    </html>
  );
}