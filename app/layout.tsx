import type { Metadata } from "next";
import { Comfortaa } from "next/font/google";
import "./globals.css";

const comfortaa = Comfortaa({
  subsets: ["latin"],
  variable: "--font-comfortaa",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "humix | AI Social Comment Intelligence Engine",
  description:
    "Generate human, authentic, up to 1.5 sentence comments for LinkedIn, Reddit & Facebook. Avoid generic AI-slop, summaries, and topic hijacking.",
  keywords: [
    "Social Comment Generator",
    "AI Comment Intelligence",
    "LinkedIn Commenting Tool",
    "Outbound Prospecting AI",
    "Anti-Slop AI",
  ],
  authors: [{ name: "humix Team" }],
  openGraph: {
    title: "humix | AI Social Comment Intelligence Engine",
    description:
      "Generate human, authentic, up to 1.5 sentence comments for LinkedIn, Reddit & Facebook.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${comfortaa.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
        {children}
      </body>
    </html>
  );
}
