import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "QVT Campaign Dashboard",
  description: "Live status of content, ads and reports for QVT Media's Team 1 brands.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f172a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-GB" className={`${geistSans.variable} h-full antialiased`}>
      <body className="min-h-full bg-slate-50 font-sans text-slate-900">{children}</body>
    </html>
  );
}
