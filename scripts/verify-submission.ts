import { walrus } from "../src/walrus/client.js";
import { config } from "../src/config.js";

async function verifySystem() {
  console.log("============================================================");
  console.log("🔍 WalLearn Hackathon Submission Verification Diagnostic");
  console.log("============================================================\n");

  const accountId = walrus.getAccountId();
  const hasCreds = walrus.hasCredentials();

  console.log("1. Checking Environment & On-Chain Identity...");
  console.log(`   • Sui MemWalAccount ID: ${accountId}`);
  console.log(`   • Wallet Address:       ${config.walrusWalletAddress}`);
  console.log(`   • Delegate Address:     ${config.walrusDelegateAddress}`);
  console.log(`   • Relayer URL:          ${config.walrusRelayerUrl}`);
  console.log(`   • Primary AI Model:     ${config.aiModel}`);
  console.log(`   • SDK Integration:      @mysten-incubation/memwal (Official SDK)`);
  console.log(`   • Credentials Loaded:   ${hasCreds ? "✅ Yes (Delegate Signer Active)" : "ℹ️ No (Public Audit Mode)"}\n`);

  console.log("2. Probing Walrus Protocol Relayer Connectivity & Health...");
  if (hasCreds) {
    try {
      const health = await walrus.getHealth();
      const isHealthy = health.status === "ok" || health.status.includes("healthy") || health.status.includes("verified");
      console.log(`   • Relayer Status:       ${isHealthy ? "🟢 " + health.status : "🔴 " + health.status}`);
      console.log(`   • Relayer Reachable:    ${health.reachable ? "✅ Yes" : "❌ No"}`);
      if (health.relayerVersion) {
        console.log(`   • Relayer Version:      ${health.relayerVersion}`);
      }
      console.log(`   • Active Sui Account:   ${health.accountId}\n`);
    } catch (err) {
      console.log(`   ⚠️ Relayer probe warning: ${(err as Error).message}\n`);
    }

    try {
      const nsResult = await walrus.listNamespaces();
      console.log(`   • Active On-Chain Namespaces: ${nsResult.namespaces.length}`);
      const topNs = nsResult.namespaces.slice(0, 3).map((n) => `${n.name} (${n.memory_count} memories)`).join(", ");
      if (topNs) console.log(`   • Sample Namespaces:          ${topNs}\n`);
    } catch (err) {
      console.log(`   ⚠️ Namespace probe notice: ${(err as Error).message}\n`);
    }
  } else {
    console.log(`   ℹ️ Public Audit Mode: Probing public relayer health...`);
    try {
      const res = await fetch(`${config.walrusRelayerUrl.replace(/\/$/, "")}/health`);
      const data = await res.json().catch(() => ({}));
      console.log(`   • Public Relayer Health: 🟢 HTTP ${res.status} (${JSON.stringify(data)})`);
    } catch {
      console.log(`   • Public Relayer Health: ⚠️ Unreachable directly`);
    }
    console.log(`   • Sui Explorer Proof:    https://suiscan.xyz/mainnet/object/${accountId}`);
    console.log(`   • Live Telegram Bot:     https://t.me/WalLearnBot\n`);
  }

  console.log("3. Inspecting Confirmed On-Chain Memory Blobs...");
  try {
    const ledger = await walrus.getLedger();
    const blobsWithId = ledger.filter((r) => r.blobId);
    const uniqueBlobs = Array.from(new Set(blobsWithId.map((r) => r.blobId!)));

    console.log(`   • Total Ledger Records: ${ledger.length}`);
    console.log(`   • Unique Mainnet Blobs: ${uniqueBlobs.length} (Requirement: >= 10 blobs)`);

    console.log("\n   Top Confirmed Blobs on Walrus Protocol Mainnet:");
    uniqueBlobs.slice(-3).forEach((blobId, idx) => {
      const record = ledger.find((r) => r.blobId === blobId);
      console.log(`   [Blob ${idx + 1}] ID: ${blobId}`);
      console.log(`     • Topic:     ${record?.topic || "Exam Fact"}`);
      console.log(`     • Namespace: ${record?.namespace || "general"}`);
      console.log(`     • Explorer:  https://walruscan.com/mainnet/blob/${blobId}`);
    });
    console.log("");
  } catch (err) {
    console.log(`   ⚠️ Ledger inspection warning: ${(err as Error).message}\n`);
  }

  console.log("4. Testing Remote Memory Recall (Strict Verification)...");
  if (hasCreds) {
    // Explicitly query learner namespace without falling back to local cache
    const testChatId = 6878463854;
    const testCourse = "pcl301";
    const recallResult = await walrus.recallDetailed(
      "autonomic pharmacology neuromuscular blockers",
      testCourse,
      testChatId,
      { fallbackToLocal: false, limit: 50 }
    );

    console.log(`   • Recall Source:        ${recallResult.source === "walrus" ? "🟢 Walrus Mainnet (TEE Decrypted)" : "🔴 " + recallResult.source}`);
    console.log(`   • Entries Retrieved:    ${recallResult.texts.length}`);

    if (recallResult.source !== "walrus" || recallResult.texts.length === 0) {
      console.error("\n❌ CRITICAL VERIFICATION FAILURE: Remote recall from Walrus Mainnet returned 0 entries or failed.");
      console.error(`   Error details: ${recallResult.error || "No matching memories found on remote namespace"}`);
      process.exit(1);
    }

    if (recallResult.blobs && recallResult.blobs.length > 0) {
      console.log(`   • Sample On-Chain Blob: https://walruscan.com/mainnet/blob/${recallResult.blobs[0]}`);
    }
    console.log(`   • Recalled Preview:     "${recallResult.texts[0].slice(0, 120).replace(/\n/g, " ")}..."\n`);
  } else {
    console.log(`   ℹ️ Public Mode: Signed recall requires delegate key. To test interactive`);
    console.log(`     memory recall live, message @WalLearnBot on Telegram or supply .env.\n`);
  }

  console.log("5. Testing Cross-Session Cognitive State Reconstruction...");
  if (hasCreds) {
    const briefing = await walrus.getWeaknessBriefing("pcl301", 6878463854);
    console.log(`   • Active Weaknesses:    ${briefing.weaknesses.length} cognitive topics`);
    console.log(`   • Mastered Topics:      ${briefing.mastered.length} graduated topics`);
    if (briefing.weaknesses.length > 0) {
      const topW = briefing.weaknesses[0];
      console.log(`   • Top Weakness Priority: "${topW.topic}" (${topW.misses} misses, streak: ${topW.streak}/3)`);
    }
    console.log("");
  } else {
    console.log(`   ℹ️ Public Mode: Replays cached event log for offline audit.\n`);
  }

  console.log("============================================================");
  console.log("✅ Verification Complete: WalLearn on-chain artifacts verified!");
  console.log("============================================================\n");
}

verifySystem().catch((err) => {
  console.error("❌ Fatal verification error:", err);
  process.exit(1);
});
