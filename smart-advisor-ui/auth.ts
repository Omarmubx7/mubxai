
import type { AuthOptions } from "next-auth";
import type { DefaultSession } from "next-auth";
import type { DefaultJWT } from "next-auth/jwt";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import { getUserByStudentId, createUser, getUserByEmail, linkAccount, createAdminLog } from "./lib/database";

const isProduction = process.env.NODE_ENV === "production";

function requireEnv(name: string, value: string | undefined): string {
    if (value?.trim()) {
        return value.trim();
    }

    const message = `[auth] Missing required environment variable: ${name}`;
    if (isProduction) {
        throw new Error(message);
    }
    // In development, warn and continue with a placeholder so the auth route
    // still loads. Throwing here makes /api/auth/session return an HTML error
    // page, which surfaces as next-auth's CLIENT_FETCH_ERROR in the browser.
    console.warn(`${message}; using a local development placeholder.`);
    return `dev-${name.toLowerCase()}`;
}

const googleClientId = requireEnv("GOOGLE_CLIENT_ID", process.env.GOOGLE_CLIENT_ID);
const googleClientSecret = requireEnv("GOOGLE_CLIENT_SECRET", process.env.GOOGLE_CLIENT_SECRET);
const nextAuthSecret = (() => {
    const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
    if (secret?.trim()) {
        return secret.trim();
    }

    const message = "[auth] NEXTAUTH_SECRET or AUTH_SECRET must be configured";
    if (isProduction) {
        throw new Error(message);
    }
    console.warn(`${message}; using a local development fallback.`);
    return "dev-secret-key";
})();

declare module "next-auth" {
    interface Session {
        user: {
            id: string;
            db_id?: number;
            student_id?: string | null;
            provider?: string;
            role?: string | null;
        } & DefaultSession["user"];
    }
    interface User {
        student_id?: string | null;
        role?: string | null;
    }
}

declare module "next-auth/jwt" {
    interface JWT extends DefaultJWT {
        student_id?: string | null;
        db_id?: number | null;
        provider?: string;
        role?: string | null;
    }
}

export const authOptions: AuthOptions = {
    providers: [
        GoogleProvider({
            clientId: googleClientId,
            clientSecret: googleClientSecret,
        }),
        CredentialsProvider({
            name: "University ID",
            credentials: {
                student_id: { label: "University ID", type: "text" },
                password: { label: "Password", type: "password" },
                is_claiming: { label: "Claiming Account", type: "text" }
            },
            async authorize(credentials) {
                if (!credentials?.student_id || !credentials?.password) {
                    return null;
                }

                const studentId = credentials.student_id;
                const password = credentials.password;
                const isClaiming = credentials.is_claiming === "true";

                try {
                    const user = await getUserByStudentId(studentId);

                    if (isClaiming) {
                        if (user) {
                            return null;
                        }

                        const passwordHash = await bcrypt.hash(password, 10);
                        const finalUser = await createUser({
                            student_id: studentId,
                            password_hash: passwordHash
                        });

                        return { id: finalUser.id.toString(), name: studentId, student_id: studentId, role: finalUser.role };
                    }

                    if (!user?.password_hash) {
                        return null;
                    }

                    const isValid = await bcrypt.compare(password, user.password_hash);
                    if (!isValid) {
                        return null;
                    }

                    // Banned accounts cannot sign in.
                    if (user.role === "banned") {
                        return null;
                    }

                    return { id: user.id.toString(), name: user.student_id, student_id: user.student_id, role: user.role };
                } catch (error) {
                    console.error("Auth Error in authorize callback:", error);
                    // Return null instead of throwing to avoid HTML error responses
                    return null;
                }
            }
        }),
    ],
    callbacks: {
        async signIn({ user, account }) {
            try {
                if (account?.provider === "google") {
                    const existingUser = await getUserByEmail(user.email || "");
                    if (existingUser) {
                        // Banned accounts cannot sign in.
                        if (existingUser.role === "banned") {
                            return false;
                        }
                        await linkAccount(existingUser.id, account.provider, account.providerAccountId).catch((err) => {
                            console.error(`[signIn callback] linkAccount failed for ${account.provider}/${account.providerAccountId} user=${user.email}`, err);
                        });
                        createAdminLog({
                            type: 'login',
                            message: `User ${user.email} logged in via Google OAuth`,
                            details: { email: user.email, name: user.name, provider: 'google' },
                            event_kind: 'login',
                            target_id: user.email || String(existingUser.id),
                        }).catch((err) => {
                            console.error(`[signIn callback] createAdminLog failed for login user=${user.email}`, err);
                        });
                        return true;
                    }
                    const newUser = await createUser({
                        email: user.email,
                        name: user.name,
                        image: user.image
                    });
                    if (!newUser?.id) {
                        throw new Error(`[signIn callback] createUser returned no user for ${user.email}`);
                    }
                    await linkAccount(newUser.id, account.provider, account.providerAccountId).catch((err) => {
                        console.error(`[signIn callback] linkAccount failed for ${account.provider}/${account.providerAccountId} newUser=${newUser.id}`, err);
                    });
                    createAdminLog({
                        type: 'register',
                        message: `New user registered via Google: ${user.email} (${user.name})`,
                        details: { email: user.email, name: user.name, provider: 'google', db_id: newUser.id },
                        event_kind: 'register',
                        target_id: user.email || String(newUser.id),
                    }).catch((err) => {
                        console.error(`[signIn callback] createAdminLog failed for register user=${user.email} target=${newUser.id}`, err);
                    });
                }
                return true;
            } catch (error) {
                console.error("[signIn callback] Error:", error);
                // Return true to allow auth to proceed even if DB calls fail
                // User can still authenticate, just without extra data
                return true;
            }
        },

        /**
         * Reads session data from the JWT token — NO DB call on every request.
         * This fixes the "Initializing Workspace" hang caused by DB latency on
         * every page load. DB lookups are done once at sign-in time (jwt callback).
         */
        async session({ session, token }) {
            try {
                if (token.sub && session.user) {
                    session.user.id = token.sub;
                    session.user.provider = token.provider;
                    if (token.role) {
                        session.user.role = token.role;
                    }
                    if (token.student_id) {
                        session.user.student_id = token.student_id;
                    }
                    if (token.db_id) {
                        session.user.db_id = token.db_id;
                    }
                }
                return session;
            } catch (error) {
                console.error("[session callback] Error:", error);
                // Return session even if there's an error
                return session;
            }
        },

        /**
         * JWT is only called at sign-in time (first time) or when token is refreshed.
         * This is the right place for the one-time DB lookup per session.
         */
        async jwt({ token, user, account }) {
            try {
                // Persist student_id and db_id from the authorize() return
                if (user) {
                    token.student_id = (user as { student_id?: string | null }).student_id;
                    token.role = (user as { role?: string | null }).role ?? token.role;
                    // user.id is always the DB id (as string) for credentials users
                    const parsedId = Number(user.id);
                    if (!Number.isNaN(parsedId)) {
                        token.db_id = parsedId;
                    }
                }
                if (account) {
                    token.provider = account.provider;
                    // For Google OAuth: look up the DB user ONCE at sign-in time
                    if (account.provider === "google" && user?.email) {
                        try {
                            const dbUser = await getUserByEmail(user.email);
                            if (dbUser) {
                                token.student_id = dbUser.student_id;
                                token.db_id = dbUser.id;
                                token.role = dbUser.role ?? token.role;
                            }
                        } catch (e) {
                            console.error("[JWT] Failed to look up Google user in DB:", e);
                        }
                    }
                }
                return token;
            } catch (error) {
                console.error("[jwt callback] Error:", error);
                return token;
            }
        }
    },
    secret: nextAuthSecret,
    cookies: {
        sessionToken: {
            name: process.env.NODE_ENV === 'production' ? `__Secure-next-auth.session-token` : `next-auth.session-token`,
            options: {
                httpOnly: true,
                sameSite: 'lax',
                path: '/',
                secure: process.env.NODE_ENV === 'production',
                domain: process.env.NODE_ENV === 'production' ? '.mubx.dev' : undefined
            }
        }
    }
};
