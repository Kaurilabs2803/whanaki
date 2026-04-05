import type { Metadata } from "next";
import { Montserrat, Merriweather, Source_Code_Pro } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

const fontSans = Montserrat({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
});

const fontSerif = Merriweather({
  subsets: ["latin"],
  variable: "--font-serif",
  weight: ["400", "700"],
});

const fontMono = Source_Code_Pro({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Whanaki | NZ Knowledge Workspace",
  description: "A sovereign knowledge workspace for New Zealand teams, with cited answers and grounded document retrieval.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className={`${fontSans.variable} ${fontSerif.variable} ${fontMono.variable}`}>
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
