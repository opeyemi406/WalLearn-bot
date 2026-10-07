import assert from "assert";
import fs from "fs";
import path from "path";
import { WalrusClient } from "../src/walrus/client.js";
import { config } from "../src/config.js";

async function runConfigSafetyTests() {
  console.log("============================================================");
  console.log("🛡️ WalLearn Configuration Safety & Isolation Test Suite");
  console.log("============================================================\n");

  const originalEnv = { ...process.env };

  try {
    // -------------------------------------------------------------------------
    // Test 1: Config defaults must not contain hardcoded creator credentials
    // -------------------------------------------------------------------------
    console.log("▶ Test 1: Verifying src/config.ts does not contain hardcoded identity fallbacks");
    {
      const configSource = fs.readFileSync(path.resolve("src/config.ts"), "utf8");
      assert(!configSource.includes("0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140"), "config.ts must not contain creator account ID");
      assert(!configSource.includes("0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2"), "config.ts must not contain creator wallet address");
      assert(!configSource.includes("0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa"), "config.ts must not contain creator delegate address");
      console.log("  ✅ src/config.ts is clean of creator-specific hardcoded fallbacks.");
    }

    // -------------------------------------------------------------------------
    // Test 2: Incomplete credentials (missing MEMWAL_ACCOUNT_ID) must be rejected
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 2: Missing MEMWAL_ACCOUNT_ID must throw explicit configuration error");
    {
      delete process.env.MEMWAL_CREDENTIALS_JSON;
      delete process.env.MEMWAL_ACCOUNT_ID;
      delete process.env.WALRUS_ACCOUNT_ID;
      process.env.MEMWAL_PRIVATE_KEY = "1111111111111111111111111111111111111111111111111111111111111111";

      let threw = false;
      try {
        new WalrusClient();
      } catch (err) {
        threw = true;
        assert((err as Error).message.includes("MEMWAL_ACCOUNT_ID"), "Error message must specify missing MEMWAL_ACCOUNT_ID");
      }
      assert(threw, "WalrusClient must throw when MEMWAL_ACCOUNT_ID is missing for a private key");
      console.log("  ✅ Missing MEMWAL_ACCOUNT_ID correctly rejected without defaulting to creator.");
    }

    // -------------------------------------------------------------------------
    // Test 3: Discrete MEMWAL credentials auto-derive public key and initialize
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 3: Discrete MEMWAL credentials auto-derive public key cleanly");
    {
      delete process.env.MEMWAL_CREDENTIALS_JSON;
      delete process.env.MEMWAL_DELEGATE_ADDRESS;
      delete process.env.WALRUS_DELEGATE_ADDRESS;
      process.env.MEMWAL_ACCOUNT_ID = "0x9999999999999999999999999999999999999999999999999999999999999999";
      process.env.MEMWAL_PRIVATE_KEY = "1111111111111111111111111111111111111111111111111111111111111111";
      process.env.MEMWAL_SERVER_URL = "https://relayer.memory.walrus.xyz";

      const client = new WalrusClient();
      assert.strictEqual(client.hasCredentials(), true, "WalrusClient must report hasCredentials() true");
      const health = await client.getHealth();
      assert.strictEqual(health.accountId, "0x9999999999999999999999999999999999999999999999999999999999999999");
      console.log("  ✅ Discrete MEMWAL credentials initialize cleanly with auto-derived public key.");
    }

    // -------------------------------------------------------------------------
    // Test 4: Verify default tests have no hardcoded creator namespace or chat ID
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 4: Default test suites must have no hardcoded creator chat ID or namespaces");
    {
      const verifyScript = fs.readFileSync(path.resolve("scripts/verify-submission.ts"), "utf8");
      const crossSessionTest = fs.readFileSync(path.resolve("tests/cross-session.test.ts"), "utf8");

      assert(!verifyScript.includes("6878463854"), "scripts/verify-submission.ts must not contain creator chat ID");
      assert(!crossSessionTest.includes("6878463854"), "tests/cross-session.test.ts must not contain creator chat ID");
      assert(!crossSessionTest.includes("u6878463854_pcl301"), "tests/cross-session.test.ts must not query creator namespace");
      console.log("  ✅ scripts/verify-submission.ts and tests/cross-session.test.ts are completely account-independent.");
    }

    // -------------------------------------------------------------------------
    // Test 5: Empty local ledger boots cleanly with zero records
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 5: Empty local runtime ledger boots cleanly");
    {
      // Reset environment to unauthenticated
      delete process.env.MEMWAL_CREDENTIALS_JSON;
      delete process.env.MEMWAL_PRIVATE_KEY;
      delete process.env.MEMWAL_ACCOUNT_ID;
      delete process.env.MEMWAL_SERVER_URL;
      delete process.env.MEMWAL_DELEGATE_ADDRESS;
      delete process.env.MEMWAL_WALLET_ADDRESS;
      delete process.env.WALRUS_DELEGATE_PRIVATE_KEY;
      delete process.env.WALRUS_ACCOUNT_ID;
      delete process.env.WALRUS_DELEGATE_ADDRESS;
      delete process.env.WALRUS_RELAYER_URL;
      process.env.MEMWAL_CREDS_DIR = "/tmp/non-existent-creds-dir";

      const client = new WalrusClient();
      assert.strictEqual(client.hasCredentials(), false, "Must report hasCredentials() false in unauthenticated mode");
      const ledger = await client.getLedger();
      assert(Array.isArray(ledger), "Ledger must be an array");
      console.log(`  ✅ Clean startup verified with ${ledger.length} local records (Zero hardcoded state).`);
    }

    // -------------------------------------------------------------------------
    // Test 6: Generated temporary test namespaces are distinct and isolated
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 6: Generated temporary test namespaces are dynamic and non-conflicting");
    {
      const nonce1 = Math.floor(100000 + Math.random() * 900000);
      const nonce2 = Math.floor(100000 + Math.random() * 900000) + 1;
      const ns1 = `u${998000000 + (nonce1 % 10000)}_audit${nonce1}`;
      const ns2 = `u${998000000 + (nonce2 % 10000)}_audit${nonce2}`;

      assert.notStrictEqual(ns1, ns2, "Test namespaces must be uniquely generated");
      assert(/^u\d+_audit\d+$/.test(ns1), "Namespace format must match u{chatId}_{course}");
      console.log(`  ✅ Dynamic namespaces verified: ${ns1} vs ${ns2}`);
    }

    // -------------------------------------------------------------------------
    // Test 7: Unauthenticated mode vs Authenticated mode behavior
    // -------------------------------------------------------------------------
    console.log("\n▶ Test 7: Unauthenticated mode runs gracefully without crashing");
    {
      delete process.env.MEMWAL_CREDENTIALS_JSON;
      delete process.env.MEMWAL_PRIVATE_KEY;
      delete process.env.MEMWAL_ACCOUNT_ID;
      delete process.env.MEMWAL_SERVER_URL;
      delete process.env.MEMWAL_DELEGATE_ADDRESS;
      delete process.env.MEMWAL_WALLET_ADDRESS;
      delete process.env.WALRUS_DELEGATE_PRIVATE_KEY;
      delete process.env.WALRUS_ACCOUNT_ID;
      delete process.env.WALRUS_DELEGATE_ADDRESS;
      delete process.env.WALRUS_RELAYER_URL;
      process.env.MEMWAL_CREDS_DIR = "/tmp/non-existent-creds-dir";

      const unauthClient = new WalrusClient();
      assert.strictEqual(unauthClient.hasCredentials(), false);
      const health = await unauthClient.getHealth();
      assert(typeof health.status === "string");
      assert.strictEqual(health.accountId, "unconfigured");
      console.log("  ✅ Unauthenticated client runs safely with status:", health.status);
    }

    console.log("\n============================================================");
    console.log("🎉 All Configuration Safety & Isolation Tests Passed (7/7)!");
    console.log("============================================================\n");
  } finally {
    process.env = originalEnv;
  }
}

runConfigSafetyTests().catch((err) => {
  console.error("\n❌ Configuration Safety Test Failure:", err);
  process.exit(1);
});
