import type { Metadata, Viewport } from "next";
import { Gabarito, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";

// Body text.
const inter = Inter({ variable: "--font-inter", subsets: ["latin"] });

// Headings and big numbers. Gabarito is a free stand-in for Ragick (the logo's
// typeface); once a Ragick web licence is bought, load it here with next/font/local.
const display = Gabarito({ variable: "--font-display-face", subsets: ["latin"], weight: ["700", "800", "900"] });

export const metadata: Metadata = {
  title: "PRIME",
  description: "Every campaign. Live. Be the first to know.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0b1f4b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may add a class to <html> before the app loads.
    <html lang="en-GB" className={`${inter.variable} ${display.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-white font-sans text-ink">
        {/* Runs before the page is drawn: if the intro already played in this visit
            (or the phone asks for less motion), hide it from the first frame. */}
        <Script id="prime-intro-check" strategy="beforeInteractive">
          {`try{if(sessionStorage.getItem("prime-intro-seen")==="1"||matchMedia("(prefers-reduced-motion: reduce)").matches)document.documentElement.classList.add("prime-intro-skip")}catch(e){}`}
        </Script>
        {children}
      </body>
    </html>
  );
}
