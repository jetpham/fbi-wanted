import "~/styles/globals.css";

import { type Metadata } from "next";
import { Geist } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

export const metadata: Metadata = {
  title: "FBI Most Wanted",
  description: "Browse FBI Wanted Persons Browser",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
  openGraph: {
    title: "FBI Wanted",
    description: "Browse FBI Wanted Persons Browser",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "FBI Wanted",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "FBI Wanted",
    description: "Browse FBI Wanted Persons Browser",
    images: ["/opengraph-image.png"],
  },
  other: {
    "apple-mobile-web-app-title": "FBI Wanted",
  },
};

const geist = Geist({
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geist.variable}`}>
      <body className="flex min-h-screen flex-col">
        <TRPCReactProvider>
          <main className="flex-1">{children}</main>
          <footer className="mt-auto py-4 text-center text-sm text-gray-600">
            Made by{" "}
            <a
              href="https://jetpham.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:underline"
            >
              Jet
            </a>
          </footer>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
