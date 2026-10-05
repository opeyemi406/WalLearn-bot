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
  const accountId = walrus.getAccountId();
  console.log(`Environment: ${hasCreds ? `🟢 Authenticated (${accountId.slice(0, 12)}...)` : "ℹ️ Public / Unauthenticated Mode"}`);

  // -------------------------------------------------------------------------
  // Test 1: Spaced Repetition Mastery Progression State Machine (Local)
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 1: 3-Consecutive-Pass Spaced Repetition State Machine & Demotion (Local)");
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
    const evMistake = parseMemoryLine(formatMistake(baseMistake, new Date(t0).toISOString()), "blob-sim-1")!;
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
    const evPass1 = parseMemoryLine(formatProgress(topic, 1, new Date(t0 + 1000).toISOString()), "blob-sim-2")!;
    state = replayEvents([evMistake, evPass1]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 1, "Streak must be 1 after pass 1");
    assert.strictEqual(topicState.status, "recovering", "Status must be recovering after pass 1");

    // Pass 2
    const evPass2 = parseMemoryLine(formatProgress(topic, 2, new Date(t0 + 2000).toISOString()), "blob-sim-3")!;
    state = replayEvents([evMistake, evPass1, evPass2]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 2, "Streak must be 2 after pass 2");
    assert.strictEqual(topicState.status, "recovering", "Status must be recovering after pass 2");

    // Pass 3 (Graduation to Mastered)
    const evMastered = parseMemoryLine(formatMastered(topic, new Date(t0 + 3000).toISOString()), "blob-sim-4")!;
    state = replayEvents([evMistake, evPass1, evPass2, evMastered]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 3, "Streak must be 3 after pass 3");
    assert.strictEqual(topicState.status, "mastered", "Topic must graduate to mastered on 3rd pass");

    // Subsequent Failure (Demotion during 10% spot-check)
    const evDemote = parseMemoryLine(formatMistake({ ...baseMistake, misses: 2 }, new Date(t0 + 4000).toISOString()), "blob-sim-5")!;
    state = replayEvents([evMistake, evPass1, evPass2, evMastered, evDemote]);
    topicState = state.topics.get(topic.toLowerCase().trim())!;
    assert.strictEqual(topicState.streak, 0, "Streak must be reset to 0 after demotion");
    assert.strictEqual(topicState.status, "confirmed", "Status must demote back to confirmed (in recovery)");
    assert.strictEqual(topicState.misses, 2, "Cumulative misses must increment to 2");

    console.log("  ✅ Mastery state machine verified: 0 -> 1 -> 2 -> 3 (mastered) -> demote on error.");
  }

  // -------------------------------------------------------------------------
  // Test 2: Cold-Start Cognitive State Reconstruction from Events (Local)
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 2: Cold-Start Cognitive State Reconstruction from Events (Local)");
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
  // Test 3: Handling of Duplicate Mistakes & Idempotent Recording (Local)
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 3: Handling Duplicate Mistakes & Cumulative Misses (Local)");
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

  // -------------------------------------------------------------------------
  // Test 4: Remote MemWal Live Write, Confirmation, Recall & Isolation
  // -------------------------------------------------------------------------
  console.log("\n▶ Test 4: Remote MemWal Live Write, Confirmation, Recall & Isolation (Walrus Protocol)");
  let remotePassed = false;
  let remoteSkipped = false;

  if (hasCreds) {
    const auditNonce = Math.floor(100000 + Math.random() * 900000);
    const auditChatId = 998000000 + (auditNonce % 10000);
    const auditCourse = `audit${auditNonce}`;
    const testTopic = `Autonomous Audit Token ${auditNonce}`;
    const testFact = `Walrus Protocol decentralized cognitive memory verified for audit ${auditNonce}`;

    console.log(`  • Generated isolated test namespace: u${auditChatId}_${auditCourse}`);
    console.log(`  • Writing test fact to Walrus Mainnet with active signer...`);

    const rememberResult = await walrus.recordFact(testTopic, testFact, auditCourse, auditChatId);
    console.log(`  • Remember job submitted: ${rememberResult.jobId || "direct"}`);

    if (rememberResult.jobId) {
      console.log(`  • Polling job confirmation on Walrus Protocol...`);
      const pollStatus = await walrus.waitForJobCompletion(rememberResult.jobId, 8, 2000);
      if (pollStatus.blobId) {
        console.log(`  • Blob confirmed on Walrus: https://walruscan.com/mainnet/blob/${pollStatus.blobId}`);
      }
    }

    console.log(`  • Testing remote signed recall on audit namespace...`);
    let studentRecall = await walrus.recallDetailed(
      testFact,
      auditCourse,
      auditChatId,
      { fallbackToLocal: false, limit: 10 }
    );

    // Background vector indexing at relayer can take 2-4 seconds; poll if not immediately returned
    for (let attempt = 0; attempt < 5 && (!studentRecall.texts || studentRecall.texts.length === 0); attempt++) {
      await new Promise((r) => setTimeout(r, 2000));
      studentRecall = await walrus.recallDetailed(
        testFact,
        auditCourse,
        auditChatId,
        { fallbackToLocal: false, limit: 10 }
      );
    }

    assert.strictEqual(studentRecall.source, "walrus", "Recall source must be 'walrus'");
    assert(studentRecall.texts.length > 0, "Recall must return memories for generated audit namespace");
    assert(
      studentRecall.texts.some((t) => t.includes(String(auditNonce))),
      "Recalled memory must contain the unique audit token"
    );
    console.log(`  ✅ Live recall verified: retrieved ${studentRecall.texts.length} decrypted memories from Walrus Mainnet.`);

    // Isolation test: Query an unpopulated namespace
    const isolatedCourse = `isolated${auditNonce}`;
    const nonExistentNs = await walrus.recallDetailed(
      "neuromuscular blockers",
      isolatedCourse,
      999999999,
      { fallbackToLocal: false, limit: 10 }
    );

    assert.strictEqual(nonExistentNs.source, "none", "Non-existent namespace must return source 'none' when fallback is disabled");
    assert.strictEqual(nonExistentNs.texts.length, 0, "Non-existent namespace must return 0 memories (Strict Isolation)");
    console.log("  ✅ Namespace isolation verified: other namespaces do not leak or cross-contaminate.");

    // State reconstruction from live bytes
    const sampleEvent = parseMemoryLine(studentRecall.texts[0], studentRecall.blobs?.[0]);
    if (sampleEvent) {
      const state = replayEvents([sampleEvent]);
      assert(state.facts.length > 0 || state.topics.size > 0, "State must rebuild from live recalled memory");
      console.log("  ✅ End-to-end cognitive state rebuilt from live Walrus bytes.");
    }

    remotePassed = true;
  } else {
    remoteSkipped = true;
    console.log("  ⚠️ Remote live Walrus test SKIPPED: MemWal credentials not configured in environment or .env.");
    console.log("     To test live writes & signed recall against Walrus Protocol Mainnet, provide your MemWal credentials.");
  }

  console.log("\n============================================================");
  if (remotePassed) {
    console.log("🎉 All 4/4 Tests Passed (3 Local State Machine + 1 Remote Live Walrus Mainnet Round-Trip)!");
  } else if (remoteSkipped) {
    console.log("⚠️ Partial Pass: 3/3 Local Tests Passed, 1 Remote Test Skipped (No credentials configured).");
    console.log("   (Remote tests were safely skipped and not reported as passed without credentials.)");
  }
  console.log("============================================================\n");
}

runCrossSessionTests().catch((err) => {
  console.error("\n❌ Cross-Session Test Failure:", err);
  process.exit(1);
});
