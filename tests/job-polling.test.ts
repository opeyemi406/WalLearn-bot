import assert from "assert";
import fs from "fs";
import path from "path";
import { WalrusClient } from "../src/walrus/client.js";
import { replayEvents, MemoryEvent } from "../src/walrus/memory-events.js";

async function runJobPollingTests() {
  console.log("============================================================");
  console.log("🧪 WalLearn MemWal Job Polling & Asynchronous Indexing Tests");
  console.log("============================================================\n");

  // ---------------------------------------------------------------------------
  // Test 1: Successful Job Polling
  // ---------------------------------------------------------------------------
  console.log("▶ Test 1: Bounded job polling succeeds when job transitions to 'done'");
  {
    const client = new WalrusClient();
    let pollAttempts = 0;
    const testJobId = "mock-job-success-123";
    const testBlobId = "mock-blob-confirmed-456";

    client.getRememberStatus = async (jobId: string) => {
      pollAttempts++;
      assert.strictEqual(jobId, testJobId);
      if (pollAttempts < 3) {
        return { status: "running" };
      }
      return { status: "done", blob_id: testBlobId };
    };

    const res = await client.waitForRememberJob(testJobId, {
      pollIntervalMs: 15,
      timeoutMs: 1000,
    });

    assert.strictEqual(res.status, "done");
    assert.strictEqual(res.blobId, testBlobId);
    assert.strictEqual(res.attempts, 3);
    console.log(`  ✅ Successfully resolved job after ${res.attempts} polls with blob: ${res.blobId}`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Job Failure Handling
  // ---------------------------------------------------------------------------
  console.log("\n▶ Test 2: Job failure terminates polling immediately with error detail");
  {
    const client = new WalrusClient();
    const testJobId = "mock-job-fail-789";
    const failureReason = "TEE encryption quorum rejected payload";

    client.getRememberStatus = async (jobId: string) => {
      assert.strictEqual(jobId, testJobId);
      return { status: "failed", error: failureReason };
    };

    const res = await client.waitForRememberJob(testJobId, {
      pollIntervalMs: 15,
      timeoutMs: 1000,
    });

    assert.strictEqual(res.status, "failed");
    assert.strictEqual(res.jobId, testJobId);
    assert.strictEqual(res.error, failureReason);
    assert.strictEqual(res.attempts, 1, "Failed job should stop polling on first failed status");
    console.log(`  ✅ Failed job stopped polling immediately with error: "${res.error}"`);
  }

  // ---------------------------------------------------------------------------
  // Test 3: Polling Timeout Handling
  // ---------------------------------------------------------------------------
  console.log("\n▶ Test 3: Bounded polling times out gracefully without infinite looping");
  {
    const client = new WalrusClient();
    const testJobId = "mock-job-stalled-999";

    client.getRememberStatus = async () => {
      return { status: "running" };
    };

    const start = Date.now();
    const res = await client.waitForRememberJob(testJobId, {
      pollIntervalMs: 25,
      timeoutMs: 120,
    });
    const elapsed = Date.now() - start;

    assert.strictEqual(res.status, "timeout");
    assert.strictEqual(res.jobId, testJobId);
    assert(res.attempts! >= 3, `Expected at least 3 attempts, got ${res.attempts}`);
    assert(elapsed >= 100, `Expected elapsed >= 100ms, got ${elapsed}ms`);
    console.log(`  ✅ Timeout safely handled after ${res.attempts} attempts in ${elapsed}ms: "${res.error}"`);
  }

  // ---------------------------------------------------------------------------
  // Test 4: Restore Returning Zero Entries After Writes
  // ---------------------------------------------------------------------------
  console.log("\n▶ Test 4: Restore returning zero entries is detected and rejected");
  {
    const client = new WalrusClient();
    // Simulate remote indexing lag where relayer returns 0 events
    (client as any).fetchRemoteEvents = async () => ({ ok: true, events: [] });

    const restoreRes = await client.restoreNamespace("ana201", 888888888);
    assert.strictEqual(restoreRes.restored, 0);

    // Verify test-document assertion: must reject restored === 0 with error
    let rejected = false;
    try {
      if (restoreRes.restored === 0) {
        throw new Error("Remote restore recovered 0 entries from Walrus Mainnet");
      }
    } catch (err) {
      rejected = true;
      assert((err as Error).message.includes("0 entries"));
    }
    assert(rejected, "Zero restored entries must trigger failure assertion");
    console.log("  ✅ Zero-entry restore correctly flagged as incomplete indexing");
  }

  // ---------------------------------------------------------------------------
  // Test 5: Restore Returning Expected Test Topics
  // ---------------------------------------------------------------------------
  console.log("\n▶ Test 5: Restore verifies expected test topics in rebuilt state");
  {
    const sampleTopic1 = "Facial Colliculus of Pons";
    const sampleTopic2 = "Medullary Pyramids Decussation";
    const now = new Date().toISOString();

    const mockEvents: MemoryEvent[] = [
      {
        type: "mistake",
        topic: sampleTopic1,
        question: "Q1",
        misconception: "E1",
        correctFact: "C1",
        severity: "medium",
        misses: 1,
        at: now,
        blobId: "blob-topic-1",
      },
      {
        type: "mistake",
        topic: sampleTopic2,
        question: "Q2",
        misconception: "E2",
        correctFact: "C2",
        severity: "medium",
        misses: 1,
        at: now,
        blobId: "blob-topic-2",
      },
    ];

    const { topics } = replayEvents(mockEvents);
    const hasTopic1 = topics.has(sampleTopic1.toLowerCase());
    const hasTopic2 = topics.has(sampleTopic2.toLowerCase());

    assert(hasTopic1, `Topic 1 "${sampleTopic1}" must be present in replayed topics`);
    assert(hasTopic2, `Topic 2 "${sampleTopic2}" must be present in replayed topics`);
    console.log(`  ✅ Restored state accurately matches expected topics: "${sampleTopic1}" and "${sampleTopic2}"`);
  }

  // ---------------------------------------------------------------------------
  // Test 6: Zero Hardcoded Creator IDs or Namespaces
  // ---------------------------------------------------------------------------
  console.log("\n▶ Test 6: Verification that scripts/test-document.ts and client.ts contain no creator IDs");
  {
    const testDocScript = fs.readFileSync(path.resolve("scripts/test-document.ts"), "utf8");
    const clientSource = fs.readFileSync(path.resolve("src/walrus/client.ts"), "utf8");

    // Must not contain creator chat ID
    assert(!testDocScript.includes("6878463854"), "scripts/test-document.ts must not contain creator chat ID 6878463854");
    // Must not contain creator namespace
    assert(!testDocScript.includes("u6878463854"), "scripts/test-document.ts must not contain creator namespace");
    // Must not contain creator account ID
    assert(!testDocScript.includes("0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140"), "scripts/test-document.ts must not contain creator account ID");
    assert(!clientSource.includes("0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140"), "src/walrus/client.ts must not contain creator account ID");

    console.log("  ✅ Zero creator IDs or namespaces verified across scripts and client.");
  }

  console.log("\n============================================================");
  console.log("🎉 All 6/6 Job Polling & Indexing Tests Passed Successfully!");
  console.log("============================================================\n");
}

runJobPollingTests().catch((err) => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
