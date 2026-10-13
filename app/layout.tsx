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
  title: "humix | Three thoughtful comments",
  description:
    "Paste a post and choose from three relevant comments with different angles, matched to the conversation.",
  keywords: [
    "Comment Suggestions",
    "Thoughtful Comments",
    "LinkedIn Commenting Tool",
    "Writing Assistance",
  ],
  authors: [{ name: "humix Team" }],
  openGraph: {
    title: "humix | Three thoughtful comments",
    description:
      "Understand the post at a glance and choose from three different comments.",
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
