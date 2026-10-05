import { Question } from "../state.js";
import { WeaknessItem } from "../walrus/types.js";
import { topicsMatch } from "../walrus/memory-events.js";

export interface DistributionReport {
  valid: boolean;
  total: number;
  weaknessCount: number;
  slideCount: number;
  spotCheckCount: number;
  ratios: {
    weaknessPct: number;
    slidePct: number;
    spotCheckPct: number;
  };
  missingWeaknessSlots: number;
  untestedWeaknesses: string[];
  testedWeaknesses: string[];
}

/**
 * Validates that the generated quiz adheres to the 60/30/10 cognitive distribution:
 * - 60% Targeted Weakness Drill (tested against active Walrus misconceptions)
 * - 30% Curriculum / Slide Grounding
 * - 10% Spaced Spot-Checks
 *
 * If the student has active Walrus weaknesses, the invariant requires at least 50%
 * (accounting for integer rounding in 3-question or 5-question drills) to target those weaknesses.
 */
export function validateQuizDistribution(
  questions: Question[],
  briefingWeaknesses: WeaknessItem[],
  requestedCount: number,
  isSlideUpload: boolean
): DistributionReport {
  const total = questions.length;
  const activeTopics = briefingWeaknesses.map((w) => w.topic.trim());

  let weaknessCount = 0;
  let slideCount = 0;
  let spotCheckCount = 0;

  const testedWeaknessSet = new Set<string>();

  for (const q of questions) {
    // 1. Explicit schema match
    let isWeakness = q.category === "weakness";

    // 2. Semantic topic cross-reference against active Walrus topics
    if (!isWeakness && activeTopics.length > 0) {
      const matchesActive = activeTopics.find(
        (t) => topicsMatch(t, q.topic) || (q.targetedWeakness && topicsMatch(t, q.targetedWeakness))
      );
      if (matchesActive) {
        isWeakness = true;
        q.category = "weakness";
        q.targetedWeakness = matchesActive;
      }
    }

    if (isWeakness) {
      weaknessCount++;
      if (q.targetedWeakness) {
        testedWeaknessSet.add(q.targetedWeakness);
      } else if (q.topic) {
        const found = activeTopics.find((t) => topicsMatch(t, q.topic));
        if (found) testedWeaknessSet.add(found);
      }
    } else if (q.category === "spot_check") {
      spotCheckCount++;
    } else {
      slideCount++;
      if (!q.category) q.category = "slide_concept";
    }
  }

  // Calculate target weakness quota
  // e.g. for 10 questions with >=6 weaknesses: quota is 6
  // e.g. for 5 questions with 2 weaknesses: quota is min(round(5*0.6)=3, 2) = 2
  const targetWeaknessQuota =
    activeTopics.length > 0 && !isSlideUpload
      ? Math.min(Math.round(total * 0.6), activeTopics.length)
      : 0;

  // Minimal floor allowing for integer rounding (e.g. 50% minimum if weaknesses exist)
  const minimumAcceptableWeakness =
    activeTopics.length > 0 && !isSlideUpload
      ? Math.min(Math.floor(total * 0.5), activeTopics.length)
      : 0;

  const valid = weaknessCount >= minimumAcceptableWeakness && total >= requestedCount;
  const missingWeaknessSlots = Math.max(0, targetWeaknessQuota - weaknessCount);

  const untestedWeaknesses = activeTopics.filter((t) => !testedWeaknessSet.has(t));
  const testedWeaknesses = Array.from(testedWeaknessSet);

  return {
    valid,
    total,
    weaknessCount,
    slideCount,
    spotCheckCount,
    ratios: {
      weaknessPct: total > 0 ? Math.round((weaknessCount / total) * 100) : 0,
      slidePct: total > 0 ? Math.round((slideCount / total) * 100) : 0,
      spotCheckPct: total > 0 ? Math.round((spotCheckCount / total) * 100) : 0,
    },
    missingWeaknessSlots,
    untestedWeaknesses,
    testedWeaknesses,
  };
}
