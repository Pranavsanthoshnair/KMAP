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
            mastery: number; // 0-100
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
}

let dbPromise: Promise<IDBPDatabase<KMAPSchema>> | null = null;

function getDB() {
    if (!dbPromise) {
        dbPromise = openDB<KMAPSchema>('kmap-db', 1, {
            upgrade(db) {
                db.createObjectStore('profile', { keyPath: 'id' });
                const capsuleStore = db.createObjectStore('capsuleCache', { keyPath: 'id' });
                capsuleStore.createIndex('by-subject', 'subject');
                capsuleStore.createIndex('by-concept', 'concept');
                db.createObjectStore('skillProfile', { keyPath: 'concept' });
                db.createObjectStore('errorPatterns', { keyPath: 'id', autoIncrement: true });
            },
        });
    }
    return dbPromise;
}

// Profile
export async function saveLocalProfile(profile: KMAPSchema['profile']['value']) {
    const db = await getDB();
    await db.put('profile', profile);
}

export async function getLocalProfile(): Promise<KMAPSchema['profile']['value'] | undefined> {
    const db = await getDB();
    const all = await db.getAll('profile');
    return all[0];
}

// Capsules
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

// Skill Profile
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

// Error Patterns
export async function recordError(concept: string, errorType: string, capsuleId: string) {
    const db = await getDB();
    await db.add('errorPatterns', { concept, errorType, capsuleId, timestamp: Date.now() });
}

export async function getErrorPatterns() {
    const db = await getDB();
    return db.getAll('errorPatterns');
}

// Recovery
export function generateRecoveryKey(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let key = 'KMAP-';
    for (let i = 0; i < 7; i++) {
        key += chars[Math.floor(Math.random() * chars.length)];
    }
    return key;
}

export async function getRecoveryData() {
    const db = await getDB();
    const profile = await getLocalProfile();
    const skills = await getSkillProfile();
    const errors = await getErrorPatterns();
    return { profile, skills, errors };
}

export async function restoreFromRecovery(data: { profile?: KMAPSchema['profile']['value']; skills?: KMAPSchema['skillProfile']['value'][]; errors?: KMAPSchema['errorPatterns']['value'][] }) {
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

export type CapsuleData = KMAPSchema['capsuleCache']['value'];
export type SkillData = KMAPSchema['skillProfile']['value'];
