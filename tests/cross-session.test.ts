import assert from "assert";
import { walrus } from "../src/walrus/client.js";
import {
  parseMemoryLine,
  replayEvents,
  formatMistake,
  formatProgress,
  formatMastered,
  MemoryEvent,
} from "../src/walrus/memory-events.js";
import { MistakeEntry } from "../src/walrus/types.js";

async function runCrossSessionTests() {
  console.log("============================================================");
  console.log("🧪 WalLearn Cross-Session & Memory Integrity Test Suite");
  console.log("============================================================\n");

  const hasCreds = walrus.hasCredentials();
  console.log(`Environment: ${hasCreds ? "🟢 Authenticated (MemWal SDK Active)" : "ℹ️ Public Audit Mode"}`);

  // -------------------------------------------------------------------------
  // Test 1: Spaced Repetition Mastery Progression State Machine
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 1: 3-Consecutive-Pass Spaced Repetition State Machine & Demotion");
  {
    const topic = "Neuromuscular Blocker Mechanism";
    const baseMistake: MistakeEntry = {
      topic,
      question: "Which drug causes depolarizing neuromuscular block?",
      my_error: "Chose Tubocurarine instead of Succinylcholine",
      correct: "Succinylcholine is the depolarizing blocker",
      severity: "high",
      misses: 1,
    };

    const t0 = Date.now();
    const evMistake = parseMemoryLine(formatMistake(baseMistake, new Date(t0).toISOString()), "blob-1")!;
    assert(evMistake, "Failed to parse mistake event");
    assert.strictEqual(evMistake.kind, "mistake");
    assert.strictEqual(evMistake.topic, topic);

    // Initial state after mistake
    let state = replayEvents([evMistake]);
    let topicState = state.topics.get(topic.toLowerCase().trim());
    assert(topicState, "Topic state should exist after mistake");
    assert.strictEqual(topicState.streak, 0, "Initial streak must be 0");
    assert.strictEqual(topicState.status, "confirmed", "Initial status must be confirmed (in recovery)");

    // Pass 1
    const evPass1 = parseMemoryLine(formatProgress(topic, 1, new Date(t0 + 1000).toISOString()), "blob-2")!;
    state = replayEvents([evMistake, evPass1]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 1, "Streak must be 1 after pass 1");
    assert.strictEqual(topicState.status, "recovering", "Status must be recovering after pass 1");

    // Pass 2
    const evPass2 = parseMemoryLine(formatProgress(topic, 2, new Date(t0 + 2000).toISOString()), "blob-3")!;
    state = replayEvents([evMistake, evPass1, evPass2]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 2, "Streak must be 2 after pass 2");
    assert.strictEqual(topicState.status, "recovering", "Status must be recovering after pass 2");

    // Pass 3 (Graduation to Mastered)
    const evMastered = parseMemoryLine(formatMastered(topic, new Date(t0 + 3000).toISOString()), "blob-4")!;
    state = replayEvents([evMistake, evPass1, evPass2, evMastered]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 3, "Streak must be 3 after pass 3");
    assert.strictEqual(topicState.status, "mastered", "Topic must graduate to mastered on 3rd pass");

    // Subsequent Failure (Demotion during 10% spot-check)
    const evDemote = parseMemoryLine(formatMistake({ ...baseMistake, misses: 2 }, new Date(t0 + 4000).toISOString()), "blob-5")!;
    state = replayEvents([evMistake, evPass1, evPass2, evMastered, evDemote]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 0, "Streak must be reset to 0 after demotion");
    assert.strictEqual(topicState.status, "confirmed", "Status must demote back to confirmed (in recovery)");
    assert.strictEqual(topicState.misses, 2, "Cumulative misses must increment to 2");

    console.log("  ✅ Mastery state machine verified: 0 -> 1 -> 2 -> 3 (mastered) -> demote on error.");
  }

  // -------------------------------------------------------------------------
  // Test 2: Cold-Start Cognitive State Reconstruction from Events
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 2: Cold-Start Cognitive State Reconstruction from Events");
  {
    const sampleEvents: MemoryEvent[] = [
      parseMemoryLine(
        "[MISTAKE] Topic: Organophosphate Poisoning | Error: Used atropine alone | Fact: Pralidoxime (2-PAM) regenerates AChE | Severity: high | Misses: 1 | At: 2026-09-26T10:00:00Z",
        "blob-op-1"
      )!,
      parseMemoryLine(
        "[PROGRESS] Topic: Organophosphate Poisoning | Streak: 1 | At: 2026-09-26T12:00:00Z",
        "blob-op-2"
      )!,
      parseMemoryLine(
        "[EXAM_FACT] Pralidoxime must be administered before AChE aging occurs. | At: 2026-09-26T13:00:00Z",
        "blob-op-3"
      )!,
    ];

    const { topics, facts } = replayEvents(sampleEvents);
    assert.strictEqual(topics.size, 1, "Should reconstruct exactly 1 topic");
    assert.strictEqual(facts.length, 1, "Should reconstruct exactly 1 exam fact");

    const opTopic = topics.get("organophosphate poisoning");
    assert(opTopic, "Reconstructed topic must match");
    assert.strictEqual(opTopic.streak, 1);
    assert.strictEqual(opTopic.status, "recovering");
    assert.strictEqual(opTopic.blobId, "blob-op-2");

    console.log("  ✅ Cold-start event replay verified: 1 topic and 1 fact reconstructed with streak=1.");
  }

  // -------------------------------------------------------------------------
  // Test 3: Remote MemWal Recall & Namespace Isolation (Live Mainnet)
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 3: Remote MemWal Recall & Namespace Isolation (Live Walrus Mainnet)");
  if (hasCreds) {
    const studentChatId = 6878463854;
    const studentCourse = "pcl301";

    // A. Query real student namespace
    const studentRecall = await walrus.recallDetailed(
      "autonomic pharmacology neuromuscular blockers",
      studentCourse,
      studentChatId,
      { fallbackToLocal: false, limit: 50 }
    );

    assert.strictEqual(studentRecall.source, "walrus", "Recall source must be 'walrus'");
    assert(studentRecall.texts.length > 0, "Recall must return memories for real learner namespace");
    console.log(`  ✅ Learner namespace (u${studentChatId}_${studentCourse}): retrieved ${studentRecall.texts.length} memories from Walrus Mainnet`);

    // B. Query an isolated/empty namespace
    const nonExistentNs = await walrus.recallDetailed(
      "neuromuscular blockers",
      "nonexistent_course_9999",
      9999999999,
      { fallbackToLocal: false, limit: 10 }
    );

    assert.strictEqual(nonExistentNs.source, "none", "Non-existent namespace must return source 'none' when fallback is disabled");
    assert.strictEqual(nonExistentNs.texts.length, 0, "Non-existent namespace must return 0 memories (Strict Isolation)");
    console.log("  ✅ Namespace isolation verified: other namespaces do not leak or cross-contaminate.");
  } else {
    console.log("  ℹ️ Public audit mode: skipping remote signed recall test (requires delegate key).");
  }

  // -------------------------------------------------------------------------
  // Test 4: Handling of Duplicate Mistakes & Idempotent Recording
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 4: Handling Duplicate Mistakes & Cumulative Misses");
  {
    const topic = "Beta-1 Adrenergic Signaling";
    const tKey = topic.toLowerCase().trim();
    const event1 = parseMemoryLine(
      `[MISTAKE] Topic: ${topic} | Error: Thought Gq coupled | Fact: Gs coupled increasing cAMP | Severity: high | Misses: 1 | At: 2026-09-27T01:00:00Z`,
      "blob-b1-1"
    )!;
    const event2 = parseMemoryLine(
      `[MISTAKE] Topic: ${topic} | Error: Thought Gi coupled | Fact: Gs coupled increasing cAMP | Severity: high | Misses: 2 | At: 2026-09-27T02:00:00Z`,
      "blob-b1-2"
    )!;

    const { topics } = replayEvents([event1, event2]);
    const b1 = topics.get(tKey)!;
    assert(b1, "Topic must exist");
    assert.strictEqual(b1.misses, 2, "Cumulative misses must reflect second mistake");
    assert.strictEqual(b1.streak, 0, "Streak must remain 0 on repeated mistakes");
    assert.strictEqual(b1.status, "confirmed");

    console.log("  ✅ Duplicate mistakes handling verified: state smoothly accumulates misses without conflict.");
  }

  console.log("\n============================================================");
  console.log("🎉 All Cross-Session & Memory Integrity Tests Passed!");
  console.log("============================================================\n");
}

runCrossSessionTests().catch((err) => {
  console.error("\n❌ Cross-Session Test Failure:", err);
  process.exit(1);
});
