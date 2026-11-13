import { defineConfig } from "prisma/config";
import { buildLocalPostgresUrl } from "./lib/postgres-url";

// Debug: Log what env vars are available during build
console.log('[prisma.config] Env check:', {
  VERCEL: !!process.env.VERCEL,
  CF_PAGES: !!process.env.CF_PAGES,
  CF_PAGES_BRANCH: process.env.CF_PAGES_BRANCH,
  CF_PAGES_COMMIT_SHA: process.env.CF_PAGES_COMMIT_SHA,
  DATABASE_URL: process.env.DATABASE_URL ? 'SET (hidden)' : 'NOT SET',
  POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL ? 'SET' : 'NOT SET',
  NODE_ENV: process.env.NODE_ENV,
});

// Only override DB URLs for local dev — on Vercel/Cloudflare, env vars already point to Neon
const isProduction = process.env.VERCEL || process.env.CF_PAGES || process.env.DATABASE_URL || process.env.CF_PAGES_BRANCH;
if (!isProduction) {
  const localPostgresUrl = buildLocalPostgresUrl();
  process.env.POSTGRES_PRISMA_URL = localPostgresUrl;
  process.env.POSTGRES_URL = localPostgresUrl;
  process.env.POSTGRES_URL_NON_POOLING = localPostgresUrl;
  console.log('[prisma.config] Using local postgres:', localPostgresUrl);
} else {
  console.log('[prisma.config] Production mode detected');
}

// If DATABASE_URL is set (e.g., Cloudflare build), use it for Prisma
if (process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
  process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
  console.log('[prisma.config] Using DATABASE_URL for Prisma');
}

export default defineConfig({
    schema: "prisma/schema.prisma",
});
