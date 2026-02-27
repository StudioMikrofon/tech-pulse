import type { Metadata } from "next";
import { Orbitron, Inter } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TerminalBoot from "@/components/TerminalBoot";
import PageTransition from "@/components/PageTransition";
import SpaceStage from "@/components/SpaceStage";
import KonamiCode from "@/components/KonamiCode";
import Ticker from "@/components/Ticker";
import { getAllArticles } from "@/lib/content";

const orbitron = Orbitron({
  variable: "--font-orbitron",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "TECH & SPACE — Your Portal to the Future",
    template: "%s | TECH & SPACE",
  },
  description:
    "Tech & space news portal. AI, Gaming, Space, Technology, Medicine, Society, and Robotics — curated from around the globe.",
  openGraph: {
    title: "TECH & SPACE — Your Portal to the Future",
    description:
      "Tech & space news portal with 3D globe visualization.",
    type: "website",
    locale: "en_US",
    siteName: "TECH & SPACE",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const articles = getAllArticles();

  return (
    <html lang="en" className="dark">
      <body
        className={`${orbitron.variable} ${inter.variable} font-body antialiased bg-space-bg text-text-primary`}
      >
        <TerminalBoot />
        <SpaceStage />
        <PageTransition />
        <KonamiCode />
        <div className="relative z-10 nebula-bg min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
        <Ticker articles={articles} compact />
      </body>
    </html>
  );
}
