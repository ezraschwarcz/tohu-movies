import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Narrow } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/components/AuthProvider";
import { SiteProvider } from "@/components/SiteProvider";
import { ADSENSE_CLIENT, SITE_NAME, SITE_URL, TAGLINE } from "@/lib/site";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
});

const archivoNarrow = Archivo_Narrow({
  subsets: ["latin"],
  variable: "--font-archivo-narrow",
  display: "swap",
});

const DEFAULT_DESCRIPTION =
  "Independent cinema, handpicked for people who love film. Bold voices and hidden gems, streaming free in HD with captions. No sign up.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Tohu Movies — Free Independent Films, Streaming Free",
    template: "%s | Tohu Movies",
  },
  description: TAGLINE,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: "Tohu Movies — Free Independent Films, Streaming Free",
    description: DEFAULT_DESCRIPTION,
    images: [
      {
        url: "/logo-512.png",
        width: 512,
        height: 512,
        alt: "Tohu Movies logo",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tohu Movies — Free Independent Films, Streaming Free",
    description: DEFAULT_DESCRIPTION,
    images: ["/logo-512.png"],
  },
  icons: {
    icon: "/favicon.svg",
    apple: "/logo-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${archivo.variable} ${archivoNarrow.variable}`}
    >
      <head>
        {/* Google AdSense verification (publisher ca-pub-2404619225929909).
            Same script the live static site ships in its head. */}
        <script
          async
          src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <SiteProvider>
          <AuthProvider>
            <Header />
            <main>{children}</main>
            <Footer />
          </AuthProvider>
        </SiteProvider>
      </body>
    </html>
  );
}
