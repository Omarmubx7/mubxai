import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { headers } from "next/headers";
import "./globals.css";
import { getClientInfo } from "@/lib/client-info";
import { logVisitor } from "@/lib/database";
import { Providers } from "@/components/Providers";
import MobileNav from "@/components/MobileNav";
import MobileHeader from "@/components/MobileHeader";
import MaintenanceBanner from "@/components/MaintenanceBanner";
import ThemeProvider from "@/components/ThemeProvider";
import {
  SITE_URL,
  SITE_NAME,
  SITE_TITLE,
  SITE_DESCRIPTION,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
  keywords: [
    // Brand
    "MUBXAI", "MUBX AI", "MUBXAI academic tracker", "HTUAI", "HTU AI",
    "MUBX academic tracker", "MUBX GPA calculator",
    // University + high-intent queries
    "Al Hussein Technical University", "HTU", "HTU Jordan",
    "HTU GPA calculator", "Al Hussein Technical University GPA calculator",
    "HTU CGPA calculator", "HTU course tracker", "HTU academic advisor",
    "HTU curriculum", "HTU prerequisites", "HTU credit hours",
    "HTU computer science courses", "HTU engineering curriculum",
    "HTU semester planner", "HTU degree progress",
    // Arabic keywords
    "جامعة الحسين التقنية", "حاسبة المعدل التراكمي",
    "تتبع المواد الجامعية", "جدول الفصل الدراسي",
    "خطة دراسية", "الساعات المعتمدة", "المتطلبات السابقة",
    // Category
    "university course tracker Jordan", "college GPA calculator free",
    "academic progress tracker", "degree completion tracker",
    "prerequisite checker university", "academic planning app",
  ],
  authors: [{ name: "Omar Mubaidin", url: "https://me.mubx.dev" }],
  creator: "Omar Mubaidin",
  publisher: "MUBX",
  category: "education",
  openGraph: {
    title: SITE_TITLE,
    description:
      "Track courses, calculate GPA and CGPA on the HTU 4.0 scale, plan semesters and monitor degree progress. Free for all Al Hussein Technical University students.",
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "en_US",
    type: "website",
    images: [
      {
        url: "/mubxai-og-image.png",
        width: 1200,
        height: 630,
        alt: "MUBXAI — HTU GPA calculator and academic tracker for Al Hussein Technical University students",
        type: "image/png",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "MUBXAI (MUBX AI) — HTU GPA Calculator & Academic Tracker",
    description:
      "Free GPA calculator and course tracker for Al Hussein Technical University (HTU) students in Jordan.",
    images: ["/mubxai-og-image.png"],
    creator: "@omarmubx",
    site: "@omarmubx",
  },
  icons: {
    icon: [
      { url: "/mubxai-light-favicon.ico", media: "(prefers-color-scheme: light)" },
      { url: "/mubxai-dark-favicon.ico", media: "(prefers-color-scheme: dark)" },
    ],
    apple: "/mubxai-dark-logo.png",
  },
  manifest: "/manifest.json",
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: "AwC38xmOqbq4byFRJWpR_VackCRoayOpOIJe_cQV6GM",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const info = await getClientInfo().catch(() => null);
  if (info) {
    // Fire and forget - don't await the DB insert to avoid blocking
    logVisitor(info).catch((e) => console.error("Logging failed", e));
  }

  const hdrs = await headers();
  const nonce = hdrs.get("x-nonce") || undefined;

  return (
    <html lang="en" className="light overflow-x-hidden" suppressHydrationWarning>
      <head>
        {/* Machine-readable context for AI crawlers and answer engines */}
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLM context" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="LLM extended context" />
        <link rel="alternate" type="text/plain" href="/ai.txt" title="AI permissions" />
        <script
          nonce={nonce}
          dangerouslySetInnerHTML={{
            __html: `(function(){
              var isStorageLike=function(value){
                return !!value && typeof value.getItem==="function" && typeof value.setItem==="function" && typeof value.removeItem==="function";
              };
              var s=function(e){
                var msg=(e.message||e.reason?.message||"").toLowerCase();
                if(msg.includes("storage")||msg.includes("access")||msg.includes("zap")||msg.includes("clock")||msg.includes("extension")||msg.includes("cactus")){
                  if(e.stopImmediatePropagation)e.stopImmediatePropagation();
                  if(e.preventDefault)e.preventDefault();
                  return true;
                }
              };
              window.addEventListener("error",s,true);
              window.addEventListener("unhandledrejection",s,true);

              var f=function(a){if(!a || typeof a!=="string")return false;var s=a.toLowerCase();return s.includes("zustand")||s.includes("deprecated")||s.includes("extension")||s.includes("storage")||s.includes("access")||s.includes("zap")||s.includes("clock")||s.includes("cactus");};
              var ow=console.warn;console.warn=function(){if(f(arguments[0]))return;ow.apply(console,arguments)};
              var oe=console.error;console.error=function(){if(f(arguments[0]))return;oe.apply(console,arguments)};
              var ol=console.log;console.log=function(){if(f(arguments[0]))return;ol.apply(console,arguments)};
            })();`
          }}
        />
      </head>
      <body className={`${inter.variable} font-sans min-h-screen flex flex-col`} suppressHydrationWarning>
        <ThemeProvider>
          <Providers>
            {/* JSON-LD: one graph for the MUBX organization, the MUBXAI product and the site */}
            <script
              type="application/ld+json"
              dangerouslySetInnerHTML={{
                __html: JSON.stringify({
                  "@context": "https://schema.org",
                  "@graph": [
                    organizationSchema,
                    websiteSchema,
                    softwareApplicationSchema,
                  ],
                }),
              }}
            />
            <MaintenanceBanner />
            <MobileHeader />
            <main className="flex-1 flex flex-col">
              {children}
            </main>
            <MobileNav />
          </Providers>
        </ThemeProvider>
      </body>
    </html>
  );
}
