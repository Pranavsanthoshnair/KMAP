import { openDB, DBSchema, IDBPDatabase } from 'idb';

interface KMAPSchema extends DBSchema {
    profile: {
        key: string;
        value: {
            id: string;
            name: string;
            gradeBand: number;
            subjects: string[];
            recoveryKey: string;
        };
    };
    capsuleCache: {
        key: string;
        value: {
            id: string;
            concept: string;
            grade: number;
            difficulty: number;
            coreIdea: string;
            rule: string;
            example: string;
            pattern: string;
            practice: string;
            practiceAnswer: string;
            subject: string;
            cachedAt: number;
        };
        indexes: { 'by-subject': string; 'by-concept': string };
    };
    skillProfile: {
        key: string;
        value: {
            concept: string;
            correct: number;
            incorrect: number;
            lastAttempt: number;
            mastery: number; // 0–100 (display scale)
        };
    };
    /** Privacy-first mastery map — float 0–1 per subtopic */
    masteryMap: {
        key: string; // subtopic slug
        value: {
            subtopic: string;
            score: number;      // 0.0–1.0
            updatedAt: number;  // timestamp
        };
    };
    /** Resources served to this user — used by allocator for novelty */
    seenResources: {
        key: string; // resource id
        value: {
            id: string;
            servedAt: number;
        };
    };
    errorPatterns: {
        key: number;
        value: {
            id?: number;
            concept: string;
            errorType: string;
            capsuleId: string;
            timestamp: number;
        };
    };
    /** Subject-level skill (1–3) and optional last score — privacy-first, local only */
    subjectSkills: {
        key: string; // subjectId (lowercase)
        value: {
            subjectId: string;
            level: 1 | 2 | 3;
            lastScore?: number;
            lastAttendedAt?: number; // timestamp of last question/capsule activity
        };
    };
}

let dbPromise: Promise<IDBPDatabase<KMAPSchema>> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<KMAPSchema>('kmap-db', 3, {
            upgrade(db, _oldVersion) {
                // ── Version 1 stores ─────────────────────────────────────────
                if (!db.objectStoreNames.contains('profile')) {
                    db.createObjectStore('profile', { keyPath: 'id' });
                }
                if (!db.objectStoreNames.contains('capsuleCache')) {
                    const capsuleStore = db.createObjectStore('capsuleCache', { keyPath: 'id' });
                    capsuleStore.createIndex('by-subject', 'subject');
                    capsuleStore.createIndex('by-concept', 'concept');
                }
                if (!db.objectStoreNames.contains('skillProfile')) {
                    db.createObjectStore('skillProfile', { keyPath: 'concept' });
                }
                if (!db.objectStoreNames.contains('errorPatterns')) {
                    db.createObjectStore('errorPatterns', { keyPath: 'id', autoIncrement: true });
                }
                // ── Version 2 stores ─────────────────────────────────────────
                if (!db.objectStoreNames.contains('masteryMap')) {
                    db.createObjectStore('masteryMap', { keyPath: 'subtopic' });
                }
                if (!db.objectStoreNames.contains('seenResources')) {
                    db.createObjectStore('seenResources', { keyPath: 'id' });
                }
                // ── Version 3: subject-level skills (privacy-first, no server sync) ──
                if (!db.objectStoreNames.contains('subjectSkills')) {
                    db.createObjectStore('subjectSkills', { keyPath: 'subjectId' });
                }
            },
        });
    }
    return dbPromise;
}

// ── Profile ──────────────────────────────────────────────────────────────────
export async function saveLocalProfile(profile: KMAPSchema['profile']['value']) {
    const db = await getDB();
    await db.put('profile', profile);
}

export async function getLocalProfile(): Promise<KMAPSchema['profile']['value'] | undefined> {
    const db = await getDB();
    const all = await db.getAll('profile');
    return all[0];
}

// ── Capsules ──────────────────────────────────────────────────────────────────
export async function cacheCapsule(capsule: Omit<KMAPSchema['capsuleCache']['value'], 'cachedAt'>) {
    const db = await getDB();
    await db.put('capsuleCache', { ...capsule, cachedAt: Date.now() });
}

export async function cacheCapsules(capsules: Omit<KMAPSchema['capsuleCache']['value'], 'cachedAt'>[]) {
    const db = await getDB();
    const tx = db.transaction('capsuleCache', 'readwrite');
    for (const c of capsules) {
        tx.store.put({ ...c, cachedAt: Date.now() });
    }
    await tx.done;
}

export async function getCachedCapsulesBySubject(subject: string) {
    const db = await getDB();
    return db.getAllFromIndex('capsuleCache', 'by-subject', subject);
}

export async function getCachedCapsuleByConcept(concept: string) {
    const db = await getDB();
    return db.getAllFromIndex('capsuleCache', 'by-concept', concept);
}

export async function getAllCachedCapsules() {
    const db = await getDB();
    return db.getAll('capsuleCache');
}

// ── Skill Profile (100-scale for display) ────────────────────────────────────
export async function updateSkill(concept: string, correct: boolean) {
    const db = await getDB();
    const existing = await db.get('skillProfile', concept);
    const skill = existing || { concept, correct: 0, incorrect: 0, lastAttempt: 0, mastery: 0 };
    if (correct) skill.correct++;
    else skill.incorrect++;
    skill.lastAttempt = Date.now();
    const total = skill.correct + skill.incorrect;
    skill.mastery = Math.round((skill.correct / total) * 100);
    await db.put('skillProfile', skill);
    return skill;
}

export async function getSkillProfile() {
    const db = await getDB();
    return db.getAll('skillProfile');
}

// ── Subject skills (level 1–3, optional lastScore) — IndexedDB source of truth ──
export async function getSubjectSkill(subjectId: string): Promise<{ level: 1 | 2 | 3; lastScore?: number; lastAttendedAt?: number } | undefined> {
    const db = await getDB();
    const row = await db.get('subjectSkills', subjectId.toLowerCase());
    if (!row) return undefined;
    return { level: row.level, lastScore: row.lastScore, lastAttendedAt: row.lastAttendedAt };
}

export async function getAllSubjectSkills(): Promise<{
    skills: Record<string, 1 | 2 | 3>;
    lastScores: Record<string, number>;
    lastAttendedAt: Record<string, number>;
}> {
    const db = await getDB();
    const all = await db.getAll('subjectSkills');
    const skills: Record<string, 1 | 2 | 3> = {};
    const lastScores: Record<string, number> = {};
    const lastAttendedAt: Record<string, number> = {};
    for (const row of all) {
        skills[row.subjectId] = row.level;
        if (typeof row.lastScore === 'number' && !Number.isNaN(row.lastScore)) {
            lastScores[row.subjectId] = row.lastScore;
        }
        if (typeof row.lastAttendedAt === 'number' && !Number.isNaN(row.lastAttendedAt)) {
            lastAttendedAt[row.subjectId] = row.lastAttendedAt;
        }
    }
    return { skills, lastScores, lastAttendedAt };
}

export async function setSubjectSkill(
    subjectId: string,
    level: 1 | 2 | 3,
    lastScore?: number
): Promise<void> {
    const db = await getDB();
    const key = subjectId.toLowerCase();
    const existing = await db.get('subjectSkills', key);
    const value: KMAPSchema['subjectSkills']['value'] = {
        subjectId: key,
        level,
        lastAttendedAt: Date.now(),
    };
    if (typeof lastScore === 'number' && !Number.isNaN(lastScore)) {
        value.lastScore = lastScore;
    }
    await db.put('subjectSkills', value);
}

/** Mark that the user attended (e.g. completed a capsule) for this subject; keeps level/lastScore. */
export async function touchSubjectAttendance(subjectId: string): Promise<void> {
    const db = await getDB();
    const key = subjectId.toLowerCase();
    const existing = await db.get('subjectSkills', key);
    const value: KMAPSchema['subjectSkills']['value'] = {
        subjectId: key,
        level: existing?.level ?? 1,
        lastAttendedAt: Date.now(),
    };
    if (typeof existing?.lastScore === 'number' && !Number.isNaN(existing.lastScore)) {
        value.lastScore = existing.lastScore;
    }
    await db.put('subjectSkills', value);
}

// ── Mastery Map (float 0–1, privacy-first) ────────────────────────────────────
/**
 * Save a mastery score for a subtopic (float 0–1).
 * This is what gets sent to the server for allocation — nothing else.
 */
export async function saveMastery(subtopic: string, score: number) {
    const db = await getDB();
    await db.put('masteryMap', { subtopic, score, updatedAt: Date.now() });
}

export async function getMasteryMap(): Promise<Record<string, number>> {
    const db = await getDB();
    const all = await db.getAll('masteryMap');
    return Object.fromEntries(all.map(m => [m.subtopic, m.score]));
}

// ── Seen Resources (for novelty in allocation) ────────────────────────────────
export async function markResourceSeen(id: string) {
    const db = await getDB();
    await db.put('seenResources', { id, servedAt: Date.now() });
}

export async function getSeenResourceIds(): Promise<string[]> {
    const db = await getDB();
    const all = await db.getAll('seenResources');
    // Only consider recently seen (last 7 days)
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return all.filter(r => r.servedAt > cutoff).map(r => r.id);
}

// ── Error Patterns ────────────────────────────────────────────────────────────
export async function recordError(concept: string, errorType: string, capsuleId: string) {
    const db = await getDB();
    await db.add('errorPatterns', { concept, errorType, capsuleId, timestamp: Date.now() });
}

export async function getErrorPatterns() {
    const db = await getDB();
    return db.getAll('errorPatterns');
}

// ── Recovery ──────────────────────────────────────────────────────────────────
export function generateRecoveryKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'KMAP-';
    for (let i = 0; i < 7; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
}

export async function getRecoveryData() {
    await getDB();
    const profile = await getLocalProfile();
    const skills = await getSkillProfile();
    const errors = await getErrorPatterns();
    return { profile, skills, errors };
}

export async function restoreFromRecovery(data: {
    profile?: KMAPSchema['profile']['value'];
    skills?: KMAPSchema['skillProfile']['value'][];
    errors?: KMAPSchema['errorPatterns']['value'][];
}) {
    const db = await getDB();
    if (data.profile) await db.put('profile', data.profile);
    if (data.skills) {
        const tx = db.transaction('skillProfile', 'readwrite');
        for (const s of data.skills) tx.store.put(s);
        await tx.done;
    }
    if (data.errors) {
        const tx = db.transaction('errorPatterns', 'readwrite');
        for (const e of data.errors) tx.store.put(e);
        await tx.done;
    }
}

// ── Global reset ────────────────────────────────────────────────────────────
export async function clearAllLocalData() {
    const db = await getDB();
    const stores = [
        'profile',
        'capsuleCache',
        'skillProfile',
        'masteryMap',
        'seenResources',
        'errorPatterns',
        'subjectSkills',
    ] as const;
    for (const name of stores) {
        await db.clear(name);
    }
}

export type CapsuleData = KMAPSchema['capsuleCache']['value'];
export type SkillData = KMAPSchema['skillProfile']['value'];
