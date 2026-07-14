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
    openGraph: { title, description, type: "website", url: origin },
    twitter: { card: "summary", title, description },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
