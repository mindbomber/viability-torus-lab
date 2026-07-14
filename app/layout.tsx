import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export async function generateMetadata(): Promise<Metadata> {
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  const origin = `${protocol}://${host}`;
  const title = "Viability Torus Lab — Interactive ATS/AANA/AIx Simulation";
  const description = "Choose a real-world system, change pressure, feedback, correction, and debt, then watch its viable recurrent geometry respond.";
  return {
    title,
    description,
    applicationName: "Viability Torus Lab",
    keywords: ["ATS", "AANA", "AIx", "toroidal geometry", "systems simulation", "alignment"],
    authors: [{ name: "Armando Sori" }],
    icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
    openGraph: {
      title,
      description,
      type: "website",
      url: origin,
      images: [{ url: `${origin}/og.png`, width: 1732, height: 909, alt: "Viability Torus Lab — agent-operable toroidal viability experiments" }],
    },
    twitter: { card: "summary_large_image", title, description, images: [`${origin}/og.png`] },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Viability Torus Lab",
    applicationCategory: "ScientificApplication",
    operatingSystem: "Web",
    description: "Deterministic two-phase toroidal viability simulation for alignment-aware systems research.",
    url: "https://viability-torus-lab.citizen-of-earth.chatgpt.site/",
    codeRepository: "https://github.com/mindbomber/viability-torus-lab",
    softwareVersion: "torus-1.0.0",
    isAccessibleForFree: true,
  };
  return <html lang="en"><head><link rel="service-desc" href="/.well-known/viability-torus-lab.json" /><link rel="alternate" type="text/plain" href="/llms.txt" title="Agent-readable documentation" /><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }} /></head><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
