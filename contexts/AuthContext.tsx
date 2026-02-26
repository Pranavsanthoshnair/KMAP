'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
 * Local Anonymous Identity
 *
 * • No Supabase Auth. No login. No signup.
 * • A random UUID is created on first visit and persisted in localStorage.
 * • All user data (grade, mastery, skill) lives in IndexedDB/localStorage.
 * • The backend never sees or stores user identity.
 * ────────────────────────────────────────────────────────────────────────── */

const LOCAL_USER_KEY = 'kmap_user_id';
const LOCAL_DATA_KEY = 'kmap_user_data';

export interface LocalUserData {
    grade: number;
    skill_level: string;
    mastery: Record<string, number>;
    data_used_today: number;
    data_date: string; // ISO date string for daily reset
}

const DEFAULT_USER_DATA: LocalUserData = {
    grade: 2,
    skill_level: 'beginner',
    mastery: {},
    data_used_today: 0,
    data_date: new Date().toISOString().slice(0, 10),
};

interface AuthContextType {
    userId: string;
    ready: boolean;
    userData: LocalUserData;
    setUserData: (data: Partial<LocalUserData>) => void;
    trackDataUsage: (bytes: number) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function initLocalUser(): string {
    if (typeof window === 'undefined') return '';
    let id = localStorage.getItem(LOCAL_USER_KEY);
    if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(LOCAL_USER_KEY, id);
    }
    return id;
}

function loadUserData(): LocalUserData {
    if (typeof window === 'undefined') return { ...DEFAULT_USER_DATA };
    try {
        const raw = localStorage.getItem(LOCAL_DATA_KEY);
        if (!raw) return { ...DEFAULT_USER_DATA };
        const parsed = JSON.parse(raw) as LocalUserData;
        // Reset daily counter if date changed
        const today = new Date().toISOString().slice(0, 10);
        if (parsed.data_date !== today) {
            parsed.data_used_today = 0;
            parsed.data_date = today;
        }
        return parsed;
    } catch {
        return { ...DEFAULT_USER_DATA };
    }
}

function saveUserData(data: LocalUserData) {
    if (typeof window === 'undefined') return;
    localStorage.setItem(LOCAL_DATA_KEY, JSON.stringify(data));
}

export function AuthProvider({ children }: { children: ReactNode }) {
    const [userId, setUserId] = useState('');
    const [ready, setReady] = useState(false);
    const [userData, setUserDataState] = useState<LocalUserData>({ ...DEFAULT_USER_DATA });

    useEffect(() => {
        const id = initLocalUser();
        const data = loadUserData();
        setUserId(id);
        setUserDataState(data);
        setReady(true);
    }, []);

    const setUserData = (partial: Partial<LocalUserData>) => {
        setUserDataState(prev => {
            const next = { ...prev, ...partial };
            saveUserData(next);
            return next;
        });
    };

    const trackDataUsage = (bytes: number) => {
        setUserDataState(prev => {
            const today = new Date().toISOString().slice(0, 10);
            const next: LocalUserData = {
                ...prev,
                data_used_today: (prev.data_date === today ? prev.data_used_today : 0) + bytes,
                data_date: today,
            };
            saveUserData(next);
            return next;
        });
    };

    return (
        <AuthContext.Provider value={{ userId, ready, userData, setUserData, trackDataUsage }}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used within AuthProvider');
    return ctx;
}
