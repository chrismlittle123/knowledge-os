import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Architecta",
  description: "The Intelligent Orchestrator - from intent to shipped code",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
