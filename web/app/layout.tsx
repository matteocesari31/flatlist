import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import FaviconLinks from "@/components/FaviconLinks";

const satoshi = localFont({
  src: [
    {
      path: "../public/fonts/Satoshi-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../public/fonts/Satoshi-Bold.woff2",
      weight: "700",
      style: "normal",
    },
  ],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: "Flatlist - Smart Apartment Hunting",
  description: "Save apartment listings from anywhere, then use AI to search and compare them intelligently.",
  // Icons are handled dynamically by FaviconLinks component based on color scheme
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${satoshi.variable} font-sans antialiased`}>
        <FaviconLinks />
        {children}
      </body>
    </html>
  );
}
