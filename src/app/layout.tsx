import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SocialCreator - AI-Powered Social Media Content",
  description: "Generate and publish social media content using AI agents",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}