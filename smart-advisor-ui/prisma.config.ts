import { defineConfig } from "prisma/config";
import { buildLocalPostgresUrl } from "./lib/postgres-url";

// Only override DB URLs for local dev — on Cloudflare, DATABASE_URL already
// points at the production Neon database.
const isProduction = process.env.DATABASE_URL || process.env.CF_PAGES_BRANCH;
if (!isProduction) {
  const localPostgresUrl = buildLocalPostgresUrl();
  process.env.POSTGRES_PRISMA_URL = localPostgresUrl;
  process.env.POSTGRES_URL = localPostgresUrl;
  process.env.POSTGRES_URL_NON_POOLING = localPostgresUrl;
}

// If DATABASE_URL is set (e.g., Cloudflare build), use it for Prisma
if (process.env.DATABASE_URL && !process.env.POSTGRES_PRISMA_URL) {
  process.env.POSTGRES_PRISMA_URL = process.env.DATABASE_URL;
}

export default defineConfig({
    schema: "prisma/schema.prisma",
});
