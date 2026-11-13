import { PrismaNeonHttp } from '@prisma/adapter-neon';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient | undefined;
};

/**
 * Lazily create a PrismaClient that connects to Neon via the HTTP-based serverless driver.
 * This works on Cloudflare Workers (edge runtime) where TCP connections are not available.
 * The client is only created on first use, so the build can succeed without DATABASE_URL set.
 */
let prismaInstance: PrismaClient | null = null;

function createPrismaClient(): PrismaClient {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('Missing required environment variable: DATABASE_URL');
    }

    const adapter = new PrismaNeonHttp(connectionString, {});
    return new PrismaClient({ adapter });
}

export const prisma = new Proxy({} as PrismaClient, {
    get(_, prop: keyof PrismaClient) {
        if (!prismaInstance) {
            prismaInstance = createPrismaClient();
        }
        return (prismaInstance as any)[prop];
    },
}) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') {
    (globalForPrisma as any).prisma = prisma;
}
