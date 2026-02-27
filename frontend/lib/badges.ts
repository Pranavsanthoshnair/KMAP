/**
 * Badge definitions for the KMAP milestone system.
 * All badge evaluation is done locally — no server involvement.
 */

export interface BadgeDefinition {
    id: string;
    name: string;
    emoji: string;
    description: string;
    /** Short text shown on the locked badge card */
    hint: string;
}

export const ALL_BADGES: BadgeDefinition[] = [
    // ── Questions answered ────────────────────────────────────────────────────
    {
        id: 'first_question',
        name: 'First Step',
        emoji: '🌱',
        description: 'You answered your very first question!',
        hint: 'Answer your first question',
    },
    {
        id: 'questions_10',
        name: 'Quick Learner',
        emoji: '⚡',
        description: 'You have answered 10 questions across any subject.',
        hint: 'Answer 10 questions total',
    },
    {
        id: 'questions_50',
        name: 'Knowledge Seeker',
        emoji: '📚',
        description: 'Halfway to a hundred — 50 questions answered!',
        hint: 'Answer 50 questions total',
    },
    {
        id: 'questions_100',
        name: 'Century Scholar',
        emoji: '🎓',
        description: 'An incredible milestone — 100 questions answered!',
        hint: 'Answer 100 questions total',
    },
    // ── Streaks ───────────────────────────────────────────────────────────────
    {
        id: 'streak_3',
        name: 'On a Roll',
        emoji: '🔥',
        description: 'You have studied 3 days in a row. Keep the fire going!',
        hint: 'Study 3 days in a row',
    },
    {
        id: 'streak_7',
        name: 'Week Warrior',
        emoji: '🗡️',
        description: 'A full week of consistent learning — incredible dedication!',
        hint: 'Study 7 days in a row',
    },
    {
        id: 'streak_10',
        name: 'Dedicated Learner',
        emoji: '💎',
        description: '10 consecutive study days — you are unstoppable!',
        hint: 'Study 10 days in a row',
    },
    // ── Performance ──────────────────────────────────────────────────────────
    {
        id: 'perfect_quiz',
        name: 'Perfect Score',
        emoji: '⭐',
        description: 'You got 100% on a quiz! Flawless mastery.',
        hint: 'Get 100% on any quiz',
    },
    {
        id: 'mastery_5',
        name: 'Topic Expert',
        emoji: '🏆',
        description: 'You have mastered 5 or more subtopics.',
        hint: 'Achieve mastery (≥80%) in 5 subtopics',
    },
];

/** Fast lookup by id */
export const BADGE_MAP: Record<string, BadgeDefinition> = Object.fromEntries(
    ALL_BADGES.map(b => [b.id, b])
);
