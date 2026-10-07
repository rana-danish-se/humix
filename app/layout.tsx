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
  title: "humix | Reply Editor",
  description:
    "Start with your own reaction. Edit a reply for LinkedIn, Reddit or Facebook and review it for added claims before posting.",
  keywords: [
    "Reply Editor",
    "Comment Editing",
    "LinkedIn Commenting Tool",
    "Writing Assistance",
  ],
  authors: [{ name: "humix Team" }],
  openGraph: {
    title: "humix | Reply Editor",
    description:
      "Edit your own reaction into a reply. Review every edit before posting.",
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
