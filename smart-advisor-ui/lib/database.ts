import { prisma } from './prisma';
import { Prisma } from '@prisma/client';
import { requireEnv } from '@/lib/env';

/**
 * Drop all tables and recreate them. (Nuclear Reset)
 */
export async function resetDB() {
    // Drop in correct order of dependencies
    // Prisma does not provide raw DROP efficiently cross-platform without raw execution
    await prisma.$executeRawUnsafe(`
        TRUNCATE TABLE user_badges, badges, quests, gamification_profiles, calendar_events, 
        integration_tokens, admin_logs, study_sessions, gpa_history, course_notes, 
        courses, semesters, accounts, users, visitor_logs, student_profile, student_progress RESTART IDENTITY CASCADE;
    `);
}

/**
 * Visitor log data structure
 */
export interface VisitorLog {
    ip_address: string;
    user_agent: string;
    device_vendor: string | undefined;
    device_model: string | undefined;
    os_name: string | undefined;
    os_version: string | undefined;
    browser_name: string | undefined;
    student_id?: string;
}

function isMissingTableError(error: unknown): boolean {
    if (!error || typeof error !== 'object') return false;

    const prismaError = error as { code?: string; message?: string };
    const message = prismaError.message || '';

    return prismaError.code === 'P2021'
        || message.includes('does not exist')
        || message.includes('relation "');
}

/**
 * Checks database health and connection.
 * Table structure is managed by Prisma db push/migrations.
 */
export async function initDB() {
    try {
        await prisma.$connect();
    } catch (e) {
        console.error("[DB] Initialization failed:", e);
        throw e;
    }
}

/** Helper to resolve a user by whatever ID next-auth currently has for them */
export async function resolveUserByString(identity: string) {
    if (!identity) return null;

    const idLower = identity.toLowerCase();

    // 0. Try numeric DB primary key (e.g. db_id.toString() = "42")
    const numericId = Number(identity);
    if (Number.isInteger(numericId) && numericId > 0) {
        const user = await prisma.user.findUnique({ where: { id: numericId } });
        if (user) return user;
    }

    // 1. Try Student ID exactly (preserve leading zeros)
    let user = await prisma.user.findUnique({ where: { student_id: identity } });
    if (user) return user;

    // 2. Try Email
    user = await prisma.user.findUnique({ where: { email: identity } });
    if (user) return user;

    // 3. Try Lowercase Email
    user = await prisma.user.findUnique({ where: { email: idLower } });
    if (user) return user;

    // 4. Try Name (Display Name)
    user = await prisma.user.findFirst({ where: { name: identity } });

    return user;
}

/** Create an admin log entry */
export async function createAdminLog(data: {
    type: string;
    message?: string;
    details?: Record<string, unknown>;
    course_id?: number;
    event_kind?: string;
    target_id?: string;
}) {
    try {
        await prisma.adminLog.create({
            data: {
                type: data.type,
                message: data.message || null,
                details: (data.details as unknown) || {},
                course_id: data.course_id || null,
                event_kind: data.event_kind || null,
                target_id: data.target_id || null,
            }
        });
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.error('Admin log creation failed:', e);
        }
    }
}

/** Log visitor information */
export async function logVisitor(data: VisitorLog): Promise<void> {
    try {
        await prisma.visitorLog.create({
            data: {
                student_id: data.student_id || null,
                ip_address: data.ip_address || null,
                user_agent: data.user_agent || null,
                device_vendor: data.device_vendor || null,
                device_model: data.device_model || null,
                os_name: data.os_name || null,
                os_version: data.os_version || null,
                browser_name: data.browser_name || null,
            }
        });
    } catch (e) {
        // During static generation, DATABASE_URL is not available
        // Silently skip logging instead of throwing
        if (e instanceof Error && (
            e.message.includes('Can\'t reach database server') ||
            e.message.includes('DATABASE_URL') ||
            e.message.includes('connection') ||
            e.message.includes('ECONNREFUSED')
        )) {
            return;
        }
        if (!isMissingTableError(e)) {
            console.error('Failed to log visitor', e);
        }
    }
}

/** Get recent visitor logs */
export async function getVisitorLogs(limit = 100) {
    try {
        const logs = await prisma.visitorLog.findMany({
            take: limit,
            orderBy: { visited_at: 'desc' },
        });
        return logs;
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.warn("Visitor log fetch error:", e);
        }
        return [];
    }
}

/** Load a student's completed courses for a specific major */
export async function loadProgress(studentId: string, major: string): Promise<string[]> {
    try {
        const record = await prisma.studentProgress.findUnique({
            where: {
                student_id_major: {
                    student_id: studentId,
                    major: major
                }
            }
        });
        if (!record) return [];
        return JSON.parse(record.completed) as string[];
    } catch (e) {
        console.error("Progress fetch error:", e);
        return [];
    }
}

/** Save a student's completed courses for a specific major */
export async function saveProgress(studentId: string, major: string, completed: string[]): Promise<void> {
    const jsonStr = JSON.stringify(completed);
    const time = BigInt(Math.floor(Date.now() / 1000));
    
    const user = await resolveUserByString(studentId);
    if (!user) return;
    
    // Try to find existing progress for this user and major
    const existing = await prisma.studentProgress.findFirst({
        where: { 
            user_id: user.id,
            major: major
        }
    });

    if (existing) {
        await prisma.studentProgress.update({
            where: {
                student_id_major: {
                    student_id: existing.student_id,
                    major: existing.major,
                },
            },
            data: {
                completed: jsonStr,
                updated_at: time,
                student_id: user.student_id || studentId
            }
        });
    } else {
        await prisma.studentProgress.create({
            data: {
                student_id: user.student_id || studentId,
                major: major,
                completed: jsonStr,
                updated_at: time,
                user: {
                    connect: { id: user.id }
                }
            }
        });
    }
}

/** Get a summary of all students */
export async function getAllStudents(): Promise<{ student_id: string; major: string; count: number }[]> {
    // using raw since JSON length isn't straightforward in prisma strictly
    try {
        const res = await prisma.$queryRaw<{ student_id: string, major: string, count: number }[]>`
            SELECT student_id, major, json_array_length(completed::json) as count
            FROM student_progress
            ORDER BY updated_at DESC
        `;
        // convert any BigInts safely if needed, but count is usually Int / BigInt -> Number
        return res.map(r => ({ ...r, count: Number(r.count) }));
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.error('Student summary query failed:', e);
        }
        return [];
    }
}

/** Load the major a student previously chose (null = first-time user) */
export async function loadMajor(studentId: string): Promise<string | null> {
    try {
        const rec = await prisma.studentProfile.findUnique({
            where: { student_id: studentId }
        });
        return rec?.major || null;
    } catch (e) { console.error("Major load error:", e); return null; }
}

/** Save / update the student's chosen major */
export async function saveMajor(studentId: string, major: string): Promise<void> {
    const time = BigInt(Math.floor(Date.now() / 1000));
    const user = await resolveUserByString(studentId);
    if (!user) return;
    await prisma.studentProfile.upsert({
        where: { user_id: user.id },
        update: { 
            major, 
            updated_at: time,
            student_id: studentId // Update the string ID to match current context
        },
        create: {
            student_id: studentId,
            major: major,
            updated_at: time,
            user_id: user.id
        }
    });
}

// ─── User Authentication Methods ─────────────────────────────────────────────

export interface DBUser {
    id: number;
    student_id: string | null;
    email: string | null;
    password_hash: string | null;
    name: string | null;
    image: string | null;
    role: string;
}

export async function getUserById(id: number): Promise<DBUser | null> {
    try {
        const u = await prisma.user.findUnique({ where: { id } });
        if (!u) return null;
        return { ...u, role: u.role || 'student' };
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.error('User lookup by id failed:', e);
        }
        return null;
    }
}

export async function getUserByStudentId(studentId: string): Promise<DBUser | null> {
    try {
        const u = await prisma.user.findUnique({ where: { student_id: studentId } });
        if (!u) return null;
        return { ...u, role: u.role || 'student' };
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.error('User lookup by student id failed:', e);
        }
        return null;
    }
}

export async function getUserByEmail(email: string): Promise<DBUser | null> {
    try {
        const u = await prisma.user.findUnique({ where: { email } });
        if (!u) return null;
        return { ...u, role: u.role || 'student' };
    } catch (e) {
        if (!isMissingTableError(e)) {
            console.error('User lookup by email failed:', e);
        }
        return null;
    }
}

export async function createUser(data: Partial<DBUser>): Promise<DBUser> {
    try {
        if (data.student_id) {
            const u = await prisma.user.upsert({
                where: { student_id: data.student_id },
                update: {
                    password_hash: data.password_hash || undefined,
                    email: data.email || undefined,
                    name: data.name || undefined,
                    image: data.image || undefined,
                    role: data.role || undefined,
                    updated_at: new Date()
                },
                create: {
                    student_id: data.student_id,
                    email: data.email || null,
                    password_hash: data.password_hash || null,
                    name: data.name || null,
                    image: data.image || null,
                    role: data.role || 'student',
                }
            });
            return { ...u, role: u.role || 'student' };
        } else if (data.email) {
            const u = await prisma.user.upsert({
                where: { email: data.email },
                update: {
                    student_id: data.student_id || undefined,
                    password_hash: data.password_hash || undefined,
                    name: data.name || undefined,
                    image: data.image || undefined,
                    role: data.role || undefined,
                    updated_at: new Date()
                },
                create: {
                    student_id: data.student_id || null,
                    email: data.email,
                    password_hash: data.password_hash || null,
                    name: data.name || null,
                    image: data.image || null,
                    role: data.role || 'student',
                }
            });
            return { ...u, role: u.role || 'student' };
        } else {
            const u = await prisma.user.create({
                data: {
                    student_id: data.student_id || null,
                    email: data.email || null,
                    password_hash: data.password_hash || null,
                    name: data.name || null,
                    image: data.image || null,
                    role: data.role || 'student',
                }
            });
            return { ...u, role: u.role || 'student' };
        }
    } catch (e) {
        console.error("DB Error in createUser:", e);
        throw e;
    }
}

export async function linkAccount(userId: number, provider: string, providerAccountId: string) {
    try {
        await prisma.account.upsert({
            where: {
                provider_provider_account_id: {
                    provider,
                    provider_account_id: providerAccountId
                }
            },
            update: {}, // DO NOTHING ON CONFLICT
            create: { user_id: userId, provider, provider_account_id: providerAccountId }
        });
    } catch (e) { console.error("Account link error:", e); }
}

export interface SaveIntegrationTokenOptions {
    studentId: string;
    provider: string;
    accessToken: string;
    refreshToken?: string;
    expiresAt?: number;
    providerAccountId?: string;
    accountEmail?: string;
    studentName?: string;
    metadata?: Record<string, unknown>;
}

export async function saveIntegrationToken({
    studentId, provider, accessToken,
    refreshToken, expiresAt, providerAccountId, accountEmail, studentName, metadata
}: SaveIntegrationTokenOptions) {
    const user = await resolveUserByString(studentId);
    if (!user) {
        throw new Error(`Could not resolve user for identity: ${studentId}`);
    }
    
    try {
        const finalMetadata: Record<string, unknown> = metadata ? { ...metadata } : {};
        if (studentName) finalMetadata.student_name = studentName;
        // Store email in metadata as a fallback
        if (accountEmail) finalMetadata.account_email = accountEmail;

        const dataPayload = {
            student_id: user.student_id || studentId,
            access_token: accessToken,
            refresh_token: refreshToken || null,
            expires_at: expiresAt ? BigInt(Math.floor(expiresAt)) : null,
            provider_account_id: providerAccountId || null,
            account_email: accountEmail || null,
            metadata: structuredClone(finalMetadata) as unknown as Prisma.InputJsonValue,
            updated_at: new Date()
        };

        await prisma.$transaction(async (tx) => {
            const existing = await tx.integrationToken.findFirst({
                where: { user_id: user.id, provider }
            });

            if (existing) {
                await tx.integrationToken.update({
                    where: { id: existing.id },
                    data: dataPayload
                });
            } else {
                await tx.integrationToken.create({
                    data: {
                        ...dataPayload,
                        provider,
                        user: {
                            connect: { id: user.id }
                        }
                    }
                });
            }
        });
    } catch (error: unknown) {
        console.error("[DB] saveIntegrationToken failure:", error);
        throw error;
    }
}

type PrismaIntegrationToken = NonNullable<Awaited<ReturnType<typeof prisma.integrationToken.findFirst>>>;

interface RefreshResult {
    token: PrismaIntegrationToken;
    accessToken: string;
    expiresAt: number;
}

/**
 * Attempts to refresh a Google OAuth token with retry logic.
 * Returns the updated token data on success, or null if all attempts fail.
 */
async function refreshGoogleToken(
    token: PrismaIntegrationToken,
    now: number
): Promise<RefreshResult | null> {
    const MAX_RETRIES = 2;
    const refreshToken = token.refresh_token;
    if (!refreshToken) return null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            const res: Response = await fetch("https://oauth2.googleapis.com/token", {
                method: "POST",
                headers: { "Content-Type": "application/x-www-form-urlencoded" },
                body: new URLSearchParams({
                    client_id: requireEnv("GOOGLE_CLIENT_ID"),
                    client_secret: requireEnv("GOOGLE_CLIENT_SECRET"),
                    refresh_token: refreshToken,
                    grant_type: "refresh_token",
                }),
            });

            if (res.ok) {
                const data: { access_token: string; expires_in: number } = await res.json();
                const newExpiresAt = now + data.expires_in;

                const updatedToken = await prisma.integrationToken.update({
                    where: { id: token.id },
                    data: {
                        access_token: data.access_token,
                        expires_at: BigInt(newExpiresAt),
                        updated_at: new Date()
                    }
                });

                return { token: updatedToken, accessToken: data.access_token, expiresAt: newExpiresAt };
            }

            const errText = await res.text();
            console.error(`[DB] Token refresh attempt ${attempt}/${MAX_RETRIES} failed (${res.status}):`, errText);

            // If Google says the refresh token is invalid/revoked, don't retry
            if (res.status === 400 && errText.includes('invalid_grant')) {
                console.error("[DB] Refresh token revoked or invalid — user must reconnect.");
                return null;
            }
        } catch (error) {
            console.error(`[DB] Token refresh attempt ${attempt}/${MAX_RETRIES} error:`, error);
        }

        // Wait 1 second before retrying
        if (attempt < MAX_RETRIES) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.error("[DB] All token refresh attempts failed for user_id:", token.user_id);
    return null;
}

export async function getIntegrationToken(studentId: string, provider: string) {
    const user = await resolveUserByString(studentId);
    if (!user) return null;
    
    let token = await prisma.integrationToken.findFirst({
        where: { user_id: user.id, provider }
    });
    
    if (!token) return null;

    let accessToken = token.access_token;
    let expiresAt = token.expires_at ? Number(token.expires_at) : null;

    // Check if token is expired or expires in less than 5 minutes (300 seconds)
    const now = Math.floor(Date.now() / 1000);
    const needsRefresh = expiresAt && (expiresAt - now < 300) && token.refresh_token && provider === 'google_calendar';

    if (needsRefresh) {
        const refreshResult = await refreshGoogleToken(token, now);
        if (!refreshResult) return null;
        token = refreshResult.token;
        accessToken = refreshResult.accessToken;
        expiresAt = refreshResult.expiresAt;
    } else if (expiresAt && (expiresAt - now < 0) && !token.refresh_token) {
        return null;
    }

    const metadata = (token.metadata ?? {}) as Record<string, unknown>;
    return {
        accessToken: accessToken,
        refreshToken: token.refresh_token,
        expiresAt: expiresAt,
        accountEmail: token.account_email || metadata.account_email,
        metadata: metadata,
    };
}

export async function deleteIntegrationToken(studentId: string, provider: string) {
    try {
        const user = await resolveUserByString(studentId);
        if (!user) return;
        const token = await prisma.integrationToken.findFirst({
            where: { user_id: user.id, provider }
        });
        if (token) {
            await prisma.integrationToken.delete({
                where: { id: token.id }
            });
        }
    } catch (e) { console.error("Token delete error:", e); }
}

export async function getCourseNotes(studentId: string, courseId: string): Promise<string | null> {
    try {
        const user = await resolveUserByString(studentId);
        if (!user) return null;
        const note = await prisma.courseNote.findUnique({
            where: { user_id_course_id: { user_id: user.id, course_id: courseId } }
        });
        return note?.notes || null;
    } catch (e) {
        console.error("Notes load error:", e);
        return null;
    }
}

export async function saveCourseNotes(studentId: string, courseId: string, notes: string): Promise<void> {
    try {
        const user = await resolveUserByString(studentId);
        if (!user) return;
        
        await prisma.courseNote.upsert({
            where: { user_id_course_id: { user_id: user.id, course_id: courseId } },
            update: { notes, updated_at: new Date() },
            create: { 
                course_id: courseId, 
                notes, 
                student_id: user.student_id,
                updated_at: new Date(),
                user: {
                    connect: { id: user.id }
                }
            }
        });
    } catch (e) { console.error("Notes save error:", e); }
}
