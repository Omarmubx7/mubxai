/**
 * Central SEO / structured-data constants for ai.mubx.dev.
 *
 * Entity model:
 *   MUBXAI  = the product (this site)
 *   MUBX    = the studio that builds it (https://mubx.dev)
 *   HTU     = Al Hussein Technical University, the university it serves
 *
 * Keeping these in one file prevents the naming drift that happens when
 * metadata, JSON-LD and page copy are edited separately.
 */

export const SITE_URL = "https://ai.mubx.dev";
export const SITE_NAME = "MUBXAI";
export const SITE_TITLE =
  "MUBXAI (MUBX AI) — HTU GPA Calculator & Academic Tracker";
export const SITE_DESCRIPTION =
  "MUBXAI is a free GPA calculator and academic tracker for Al Hussein Technical University (HTU) students in Jordan. Track courses, calculate CGPA, check prerequisites and plan your degree from 0 to graduation.";

export const STUDIO_URL = "https://mubx.dev";
export const PERSON_URL = "https://me.mubx.dev";
export const BOT_URL = "https://bot.mubx.dev";
export const UNIVERSITY_URL = "https://htu.edu.jo";

export const organizationId = `${STUDIO_URL}/#organization`;
export const websiteId = `${SITE_URL}/#website`;
export const appId = `${SITE_URL}/#app`;

export const organizationSchema = {
  "@type": "Organization",
  "@id": organizationId,
  name: "MUBX",
  alternateName: ["MUBX Web Engineering Studio", "MUBX Studio"],
  url: STUDIO_URL,
  logo: {
    "@type": "ImageObject",
    url: `${STUDIO_URL}/mubxnewlogo.png`,
  },
  description:
    "MUBX is a web engineering studio in Amman, Jordan. It builds high-performance websites, e-commerce stores, custom web systems and AI products — including MUBXAI.",
  email: "mubxdev@proton.me",
  foundingDate: "2024",
  priceRange: "$$",
  areaServed: [
    { "@type": "Country", name: "Jordan" },
    { "@type": "City", name: "Amman" },
  ],
  knowsAbout: [
    "Website Development",
    "Web Design",
    "Programming",
    "Affordable Web Development",
    "E-commerce",
    "Custom Web Systems",
    "Technical SEO",
    "Next.js & React Development",
  ],
  address: {
    "@type": "PostalAddress",
    addressLocality: "Amman",
    addressCountry: "JO",
  },
  founder: {
    "@type": "Person",
    "@id": `${PERSON_URL}/#person`,
    name: "Omar Mubaidin",
    url: PERSON_URL,
  },
  sameAs: [
    PERSON_URL,
    BOT_URL,
    "https://github.com/Omarmubx7",
    "https://www.linkedin.com/in/omarmubaidin",
    "https://www.instagram.com/mubx.dev",
  ],
};

export const softwareApplicationSchema = {
  "@type": "SoftwareApplication",
  "@id": appId,
  name: "MUBXAI",
  alternateName: ["MUBX AI", "HTUAI", "MUBX Academic Tracker"],
  url: SITE_URL,
  operatingSystem: "Web",
  applicationCategory: "EducationalApplication",
  applicationSubCategory: "Academic Planning",
  description: SITE_DESCRIPTION,
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    availability: "https://schema.org/InStock",
  },
  audience: {
    "@type": "EducationalAudience",
    educationalRole: "student",
    audienceType:
      "Students at Al Hussein Technical University (HTU) in Amman, Jordan",
  },
  provider: { "@id": organizationId },
  isPartOf: { "@id": websiteId },
  featureList: [
    "Course completion tracking with prerequisite checks",
    "Real-time GPA and CGPA calculator on the HTU 4.0 scale",
    "Semester planner with grade prediction",
    "Degree progress monitoring by requirement category",
    "Study session logging with streaks and XP",
    "Google Calendar sync for exams and study sessions",
    "Support for all HTU computing and engineering majors",
    "Bilingual English/Arabic keyword support",
  ],
  screenshot: `${SITE_URL}/mubxai-og-image.png`,
  author: {
    "@type": "Person",
    "@id": `${PERSON_URL}/#person`,
    name: "Omar Mubaidin",
    url: PERSON_URL,
  },
  inLanguage: "en",
};

export const websiteSchema = {
  "@type": "WebSite",
  "@id": websiteId,
  name: "MUBXAI",
  alternateName: ["MUBX AI", "HTUAI", "MUBX Academic Tracker"],
  url: SITE_URL,
  description: SITE_DESCRIPTION,
  publisher: { "@id": organizationId },
  inLanguage: "en",
};

export function breadcrumbSchema(
  items: Array<{ name: string; path: string }>
) {
  return {
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.path.startsWith("http") ? item.path : `${SITE_URL}${item.path}`,
    })),
  };
}

export function faqSchema(items: Array<{ question: string; answer: string }>) {
  return {
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.answer,
      },
    })),
  };
}

export const HTU_GRADING_SCALE = [
  { grade: "D", label: "Distinction", points: 4.0 },
  { grade: "M", label: "Merit", points: 3.2 },
  { grade: "P", label: "Pass", points: 2.4 },
  { grade: "U", label: "Unclassified", points: 0.0 },
];

export const CORE_FAQ = [
  {
    question: "What is MUBXAI?",
    answer:
      "MUBXAI (also written MUBX AI) is a free academic tracker and GPA calculator for students at Al Hussein Technical University (HTU) in Amman, Jordan. It tracks completed courses, calculates GPA and CGPA on the HTU 4.0 scale, checks prerequisites, plans semesters and monitors degree progress.",
  },
  {
    question: "Is MUBXAI the same as HTUAI?",
    answer:
      "Yes. The product was originally called HTUAI and was renamed MUBXAI. Both names refer to the same free academic tracker at ai.mubx.dev.",
  },
  {
    question: "Is MUBXAI an official HTU tool?",
    answer:
      "No. MUBXAI is an independent student-built tool created by Omar Mubaidin and maintained by MUBX. It is not operated or endorsed by Al Hussein Technical University. Always cross-check official results with HTU academic records.",
  },
  {
    question: "How does the HTU GPA calculator work?",
    answer:
      "MUBXAI uses the HTU 4-point scale: D = 4.0, M = 3.2, P = 2.4 and U = 0.0. GPA is the sum of grade points multiplied by credit hours, divided by completed credit hours. In-progress and planned courses are excluded until a grade is entered.",
  },
  {
    question: "Is MUBXAI free?",
    answer:
      "Yes. MUBXAI is 100% free. There are no premium tiers, subscriptions, ads or hidden fees.",
  },
  {
    question: "Which majors does MUBXAI support?",
    answer:
      "MUBXAI supports the HTU curricula for Computer Science, Data Science and AI, Cybersecurity, Game Design, Electrical Engineering, Energy Engineering, Industrial Engineering and Mechanical Engineering.",
  },
  {
    question: "Does MUBXAI sync with Google Calendar?",
    answer:
      "Yes. After you connect Google Calendar, MUBXAI can push exam dates and study sessions to your calendar. It only writes the events you choose and does not read unrelated calendar data.",
  },
];
