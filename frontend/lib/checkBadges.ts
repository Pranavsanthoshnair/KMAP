/**
 * Badge evaluation logic.
 * Runs after every quiz session; awards newly earned badges and returns their definitions.
 */

import { awardBadge, ActivityStats } from '@/lib/indexeddb';
import { ALL_BADGES, BadgeDefinition } from '@/lib/badges';

/**
 * Evaluates all badge conditions against current stats and mastery map.
 * Saves newly earned badges to IndexedDB.
 *
 * @param stats       Latest ActivityStats from recordQuizActivity()
 * @param masteryMap  subtopic → score (0–1) from getMasteryMap()
 * @returns           Array of BadgeDefinitions that were **newly** earned this session
 */
export async function checkAndAwardBadges(
    stats: ActivityStats,
    masteryMap: Record<string, number>,
): Promise<BadgeDefinition[]> {
    const masteredCount = Object.values(masteryMap).filter(s => s >= 0.8).length;

    // Map badge id → condition met
    const conditions: Record<string, boolean> = {
        first_question: stats.totalQuestionsAnswered >= 1,
        questions_10: stats.totalQuestionsAnswered >= 10,
        questions_50: stats.totalQuestionsAnswered >= 50,
        questions_100: stats.totalQuestionsAnswered >= 100,
        streak_3: stats.currentStreak >= 3,
        streak_7: stats.currentStreak >= 7,
        streak_10: stats.currentStreak >= 10,
        perfect_quiz: stats.perfectQuizzes >= 1,
        mastery_5: masteredCount >= 5,
    };

    const newlyEarned: BadgeDefinition[] = [];

    for (const badge of ALL_BADGES) {
        if (conditions[badge.id]) {
            const isNew = await awardBadge(badge.id);
            if (isNew) newlyEarned.push(badge);
        }
    }

    return newlyEarned;
}
