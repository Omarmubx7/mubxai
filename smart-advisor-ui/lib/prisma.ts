import { PrismaClient } from "@prisma/client";
import { PrismaNeonHTTP } from "@prisma/adapter-neon";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildLocalPostgresUrl } from "./postgres-url";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

/**
 * Resolves the database connection at runtime.
 *
 * - Cloudflare Workers cannot open raw TCP sockets, so Neon gets its HTTP
 *   driver adapter (`DATABASE_URL` points at the Neon pooler).
 * - Any other environment (local dev, scripts, CI) uses the regular `pg`
 *   adapter over TCP.
 *
 * The client is created lazily so importing this module during `next build`
 * never needs a reachable database.
 */
function databaseUrl(): string {
    return (
        process.env.DATABASE_URL ||
        process.env.POSTGRES_PRISMA_URL ||
        process.env.POSTGRES_URL ||
        buildLocalPostgresUrl()
    );
}

function createPrismaClient(): PrismaClient {
    const url = databaseUrl();
    const isNeon = /neon\.tech|neon\.build|neondb/i.test(url);

    if (isNeon) {
        return new PrismaClient({ adapter: new PrismaNeonHTTP(url, {}) });
    }

    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
}

function getPrismaClient(): PrismaClient {
    if (!globalForPrisma.prisma) {
        globalForPrisma.prisma = createPrismaClient();
    }
    return globalForPrisma.prisma;
}

/**
 * Proxy so the client is only instantiated on first real query. Route handlers
 * and server components can import this safely during static analysis.
 */
export const prisma = new Proxy({} as PrismaClient, {
    get(_target, prop: string | symbol) {
        const client = getPrismaClient();
        const value = Reflect.get(client as object, prop);
        return typeof value === "function" ? value.bind(client) : value;
    },
}) as PrismaClient;
