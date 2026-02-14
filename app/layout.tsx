import type { Metadata } from "next";
import { Space_Grotesk, Inter } from "next/font/google";
import "./globals.css";
import Starfield from "@/components/Starfield";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import TerminalBoot from "@/components/TerminalBoot";
import PageTransition from "@/components/PageTransition";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
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
    default: "Tech Pulse — Your Portal to the Future",
    template: "%s | Tech Pulse",
  },
  description:
    "Space-themed tech news portal. AI, Gaming, Space, Technology, Medicine, Society, and Robotics — curated from around the globe.",
  openGraph: {
    title: "Tech Pulse — Your Portal to the Future",
    description:
      "Space-themed tech news portal with 3D globe visualization.",
    type: "website",
    locale: "en_US",
    siteName: "Tech Pulse",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${spaceGrotesk.variable} ${inter.variable} font-body antialiased bg-space-bg text-text-primary`}
      >
        <TerminalBoot />
        <Starfield />
        <PageTransition />
        <div className="relative z-10 nebula-bg min-h-screen flex flex-col">
          <Header />
          <main className="flex-1">{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
