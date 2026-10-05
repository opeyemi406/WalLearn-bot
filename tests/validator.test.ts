import { validateQuizDistribution } from "../src/ai/validator.js";
import { Question } from "../src/state.js";
import { WeaknessItem } from "../src/walrus/types.js";

console.log("============================================================");
console.log("🧪 WalLearn Invariant Validator Test Suite (60/30/10 Ratio)");
console.log("============================================================\n");

const mockWeaknesses: WeaknessItem[] = [
  { topic: "Phase 1 Depolarizing Blockade", misses: 3, severity: "high", misconception: "Confused with competitive", correct_fact: "Continuous depolarization", streak: 0 },
  { topic: "Organophosphate Toxicity", misses: 2, severity: "high", misconception: "Ignored aging", correct_fact: "Pralidoxime must precede aging", streak: 1 },
  { topic: "Ganglionic Transmission", misses: 1, severity: "medium", misconception: "Attributed to M1", correct_fact: "Nicotinic NN receptor mediated", streak: 0 },
];

// Test 1: Ideal 60/30/10 distribution
console.log("▶ Test 1: Evaluating Ideal 60/30/10 Question Distribution (10 Questions)...");
const sampleQuestionsIdeal: Question[] = [
  { id: 1, stem: "Q1", options: {}, correct: "A", topic: "Phase 1 Depolarizing Blockade", category: "weakness", targetedWeakness: "Phase 1 Depolarizing Blockade", fact: "F1" },
  { id: 2, stem: "Q2", options: {}, correct: "A", topic: "Organophosphate Toxicity", category: "weakness", targetedWeakness: "Organophosphate Toxicity", fact: "F2" },
  { id: 3, stem: "Q3", options: {}, correct: "A", topic: "Ganglionic Transmission", category: "weakness", targetedWeakness: "Ganglionic Transmission", fact: "F3" },
  { id: 4, stem: "Q4", options: {}, correct: "A", topic: "General Autonomics", category: "slide_concept", fact: "F4" },
  { id: 5, stem: "Q5", options: {}, correct: "A", topic: "Sympathetic Tone", category: "slide_concept", fact: "F5" },
];

const res1 = validateQuizDistribution(sampleQuestionsIdeal, mockWeaknesses, 5, false);
console.log(`   • Result: ${res1.valid ? "PASSED ✅" : "FAILED ❌"}`);
console.log(`   • Weakness Ratio: ${res1.ratios.weaknessPct}% (Target: 60%, Minimum: 50%)`);
if (!res1.valid) throw new Error("Test 1 should pass ideal distribution!");

// Test 2: Drift detection (Only 1 weakness out of 10)
console.log("\n▶ Test 2: Detecting Ratio Drift (Under-indexed Weakness Allocation)...");
const sampleQuestionsDrift: Question[] = [
  { id: 1, stem: "Q1", options: {}, correct: "A", topic: "Phase 1 Depolarizing Blockade", category: "weakness", targetedWeakness: "Phase 1 Depolarizing Blockade", fact: "F1" },
  { id: 2, stem: "Q2", options: {}, correct: "A", topic: "Slide Topic 1", category: "slide_concept", fact: "F2" },
  { id: 3, stem: "Q3", options: {}, correct: "A", topic: "Slide Topic 2", category: "slide_concept", fact: "F3" },
  { id: 4, stem: "Q4", options: {}, correct: "A", topic: "Slide Topic 3", category: "slide_concept", fact: "F4" },
  { id: 5, stem: "Q5", options: {}, correct: "A", topic: "Slide Topic 4", category: "slide_concept", fact: "F5" },
  { id: 6, stem: "Q6", options: {}, correct: "A", topic: "Slide Topic 5", category: "slide_concept", fact: "F6" },
  { id: 7, stem: "Q7", options: {}, correct: "A", topic: "Slide Topic 6", category: "slide_concept", fact: "F7" },
  { id: 8, stem: "Q8", options: {}, correct: "A", topic: "Slide Topic 7", category: "slide_concept", fact: "F8" },
  { id: 9, stem: "Q9", options: {}, correct: "A", topic: "Slide Topic 8", category: "slide_concept", fact: "F9" },
  { id: 10, stem: "Q10", options: {}, correct: "A", topic: "Spot Check 1", category: "spot_check", fact: "F10" },
];

const res2 = validateQuizDistribution(sampleQuestionsDrift, mockWeaknesses, 10, false);
console.log(`   • Drift Flagged: ${!res2.valid ? "YES ✅ (Drift Detected)" : "NO ❌"}`);
console.log(`   • Missing Weakness Slots: ${res2.missingWeaknessSlots}`);
console.log(`   • Untested Weaknesses Identified: ${res2.untestedWeaknesses.join(", ")}`);
if (res2.valid || res2.missingWeaknessSlots <= 0) throw new Error("Test 2 should flag drift!");

// Test 3: Zero-weakness cold start (Clean distribution)
console.log("\n▶ Test 3: Zero-Weakness Cold Start Handling...");
const res3 = validateQuizDistribution(sampleQuestionsDrift, [], 10, false);
console.log(`   • Result: ${res3.valid ? "PASSED ✅ (Permits full curriculum distribution)" : "FAILED ❌"}`);
if (!res3.valid) throw new Error("Test 3 should pass when no weaknesses exist!");

console.log("\n============================================================");
console.log("🎉 All Invariant Validator Tests Passed Successfully!");
console.log("============================================================\n");
