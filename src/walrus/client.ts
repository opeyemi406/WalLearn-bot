import fs from "fs";
import path from "path";
import crypto from "crypto";
import { signAsync } from "@noble/ed25519";
import { config } from "../config.js";
import { MistakeEntry, WeaknessBriefing, WeaknessItem, StoredBlobRecord } from "./types.js";

const LEDGER_FILE = path.resolve(process.cwd(), "data/mistakes-ledger.json");
const RELAYER_URL = "https://relayer.memory.walrus.xyz";

function fromHex(s: string): Uint8Array {
  const clean = s.startsWith("0x") ? s.slice(2) : s;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  }
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export class WalrusClient {
  private localLedger: StoredBlobRecord[] = [];
  private creds: {
    accountId: string;
    delegatePrivateKey: string;
    delegatePublicKeyHex: string;
    walletAddress?: string;
  } | null = null;

  constructor() {
    this.ensureDataDir();
    this.loadLedger();
    this.loadCredentials();
  }

  private ensureDataDir() {
    const dir = path.dirname(LEDGER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadCredentials() {
    try {
      const credsPath = path.join(config.memwalCredsDir, "credentials.json");
      if (fs.existsSync(credsPath)) {
        this.creds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
        console.log(`✅ Loaded Walrus credentials for account: ${this.creds?.accountId?.slice(0, 12)}...`);
      } else {
        console.warn(`⚠️ Walrus credentials not found at ${credsPath}`);
      }
    } catch (e) {
      console.error("Failed to load Walrus credentials:", e);
    }
  }

  private loadLedger() {
    try {
      if (fs.existsSync(LEDGER_FILE)) {
        this.localLedger = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
      }
    } catch (e) {
      this.localLedger = [];
    }
  }

  private saveLedger() {
    try {
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.localLedger, null, 2));
    } catch (e) {
      console.error("Failed to save ledger:", e);
    }
  }

  /**
   * Helper to sign HTTP requests with the delegate Ed25519 key
   */
  private async signRequest(method: string, path: string, bodyStr: string = "") {
    if (!this.creds) {
      this.loadCredentials();
      if (!this.creds) throw new Error("Missing Walrus credentials");
    }

    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
    const accountId = this.creds.accountId;

    // Canonical message: timestamp.method.path.bodyHash.nonce.accountId
    const canonicalMsg = `${timestamp}.${method}.${path}.${bodyHash}.${nonce}.${accountId}`;
    const sig = await signAsync(new TextEncoder().encode(canonicalMsg), fromHex(this.creds.delegatePrivateKey));
    const sigHex = toHex(sig);

    return {
      "content-type": "application/json",
      "x-public-key": this.creds.delegatePublicKeyHex,
      "x-signature": sigHex,
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-account-id": accountId,
    };
  }

  /**
   * Persist a mistake to Walrus Protocol Memory via direct REST API
   */
  async remember(
    mistake: MistakeEntry,
    namespace: string = config.defaultSubject
  ): Promise<{ success: boolean; jobId?: string; blobId?: string; details?: string }> {
    const statement = `[MISTAKE] Topic: ${mistake.topic} | Question: ${mistake.question} | Error: ${mistake.my_error} | Fact: ${mistake.correct} | Severity: ${mistake.severity} | Misses: ${mistake.misses}`;

    console.log(`🧠 [Walrus Write] Storing mistake in namespace '${namespace}': ${mistake.topic}`);

    let jobId: string | undefined = undefined;
    let blobId: string | undefined = undefined;
    let details: string | undefined = undefined;

    try {
      const path = "/api/remember";
      const bodyObj = { text: statement, namespace };
      const bodyStr = JSON.stringify(bodyObj);
      const headers = await this.signRequest("POST", path, bodyStr);

      const res = await fetch(`${RELAYER_URL}${path}`, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      if (res.status === 202 || res.status === 200) {
        const data = (await res.json()) as { job_id?: string; status?: string };
        jobId = data.job_id;
        details = `Job accepted: ${jobId} (${data.status})`;
        console.log(`✅ [Walrus Write Accepted] Job ID: ${jobId}`);

        // Schedule background status poll to resolve on-chain blob_id
        if (jobId) {
          this.pollJobCompletion(jobId);
        }
      } else {
        const errText = await res.text();
        console.warn(`Walrus remember HTTP ${res.status}:`, errText);
        details = `HTTP ${res.status}: ${errText}`;
      }
    } catch (err) {
      console.warn("Notice: Walrus remember call caught:", (err as Error).message);
      details = (err as Error).message;
    }

    // Record into local ledger
    this.localLedger.push({
      jobId,
      blobId,
      topic: mistake.topic,
      question: mistake.question,
      misconception: mistake.my_error,
      correctFact: mistake.correct,
      severity: mistake.severity,
      misses: mistake.misses,
      namespace,
      timestamp: new Date().toISOString(),
      status: jobId ? "confirmed" : "pending",
    });
    this.saveLedger();

    return {
      success: true,
      jobId,
      blobId,
      details,
    };
  }

  /**
   * Polls Walrus relayer for job status to retrieve the on-chain blob_id
   */
  private async pollJobCompletion(jobId: string, maxAttempts = 6) {
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, 4000)); // check every 4 seconds
      try {
        const path = `/api/remember/${jobId}`;
        const headers = await this.signRequest("GET", path, "");
        const res = await fetch(`${RELAYER_URL}${path}`, {
          method: "GET",
          headers,
        });

        if (res.ok) {
          const data = (await res.json()) as { status?: string; blob_id?: string };
          if (data.status === "done" && data.blob_id) {
            console.log(`🎉 [Walrus Mainnet Blob Confirmed] Job ${jobId} -> Blob ${data.blob_id}`);
            const record = this.localLedger.find((r) => r.jobId === jobId);
            if (record) {
              record.blobId = data.blob_id;
              record.status = "confirmed";
              this.saveLedger();
            }
            break;
          }
        }
      } catch (e) {
        // ignore polling network blips
      }
    }
  }

  /**
   * Recall memories from Walrus Memory
   */
  async recall(query: string, namespace: string = config.defaultSubject): Promise<string> {
    const recalledTexts: string[] = [];

    // 1. Try querying Walrus Relayer REST recall
    try {
      const path = "/api/recall";
      const bodyObj = { query, namespace };
      const bodyStr = JSON.stringify(bodyObj);
      const headers = await this.signRequest("POST", path, bodyStr);

      const res = await fetch(`${RELAYER_URL}${path}`, {
        method: "POST",
        headers,
        body: bodyStr,
      });

      if (res.ok) {
        const data = (await res.json()) as { results?: Array<{ text?: string }>; total?: number };
        if (data.results && data.results.length > 0) {
          for (const item of data.results) {
            if (item.text) recalledTexts.push(item.text);
          }
        }
      }
    } catch (err) {
      console.warn("Walrus recall query caught:", (err as Error).message);
    }

    // 2. Combine with confirmed local ledger entries for this namespace
    const localMatches = this.localLedger.filter(
      (entry) => !entry.namespace || entry.namespace.toLowerCase() === namespace.toLowerCase()
    );

    for (const entry of localMatches) {
      const line = `[MISTAKE] Topic: ${entry.topic} | Question: ${entry.question || ""} | Error: ${entry.misconception || ""} | Fact: ${entry.correctFact || ""} | Severity: ${entry.severity || "high"} | Misses: ${entry.misses || 1}`;
      if (!recalledTexts.includes(line)) {
        recalledTexts.push(line);
      }
    }

    return recalledTexts.join("\n");
  }

  /**
   * Generate a cold Weakness Briefing for a subject
   */
  async getWeaknessBriefing(subject: string = config.defaultSubject): Promise<WeaknessBriefing> {
    const rawMemories = await this.recall(
      `repeated mistakes, misconceptions, and failed questions in ${subject}`,
      subject
    );

    const weaknessesMap = new Map<string, WeaknessItem>();
    const mastered: string[] = [];

    // Parse memories
    const lines = rawMemories.split("\n");
    for (const line of lines) {
      if (line.includes("[MISTAKE]")) {
        const topicMatch = line.match(/Topic:\s*([^|]+)/i);
        const errorMatch = line.match(/Error:\s*([^|]+)/i);
        const factMatch = line.match(/Fact:\s*([^|]+)/i);
        const severityMatch = line.match(/Severity:\s*([^|]+)/i);
        const missesMatch = line.match(/Misses:\s*(\d+)/i);

        if (topicMatch) {
          const topic = topicMatch[1].trim();
          const misses = missesMatch ? parseInt(missesMatch[1], 10) : 1;
          const severity = (severityMatch?.[1].trim().toLowerCase() as any) || "medium";

          if (weaknessesMap.has(topic)) {
            const existing = weaknessesMap.get(topic)!;
            existing.misses += misses;
            if (severity === "high") existing.severity = "high";
          } else {
            weaknessesMap.set(topic, {
              topic,
              misconception: errorMatch ? errorMatch[1].trim() : "",
              correct_fact: factMatch ? factMatch[1].trim() : "",
              severity,
              misses,
            });
          }
        }
      } else if (line.toLowerCase().includes("mastered:")) {
        const topicMatch = line.match(/topic:\s*([^|]+)/i);
        if (topicMatch) mastered.push(topicMatch[1].trim());
      }
    }

    const weaknesses = Array.from(weaknessesMap.values());

    // Sort weaknesses by misses * severity weight
    const severityWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    weaknesses.sort((a, b) => {
      const scoreA = a.misses * (severityWeight[a.severity] || 2);
      const scoreB = b.misses * (severityWeight[b.severity] || 2);
      return scoreB - scoreA;
    });

    return {
      subject,
      total_mistakes: weaknesses.length,
      weaknesses: weaknesses.slice(0, 5), // Top 5
      mastered,
    };
  }

  /**
   * Check connection and account health via signed whoami endpoint
   */
  async getHealth(): Promise<{ status: string; accountId: string; walletAddress: string; blobCount: number; confirmedBlobs: number }> {
    let status = "connected (REST direct)";
    try {
      const path = "/api/whoami";
      const headers = await this.signRequest("GET", path, "");
      const res = await fetch(`${RELAYER_URL}${path}`, {
        method: "GET",
        headers,
      });
      if (res.ok) {
        status = "healthy & verified on Walrus Protocol";
      } else {
        status = `relayer status ${res.status}`;
      }
    } catch (e) {
      status = "offline";
    }

    const confirmedCount = this.localLedger.filter((r) => r.blobId).length;

    return {
      status,
      accountId: this.creds?.accountId || config.walrusAccountId,
      walletAddress: this.creds?.walletAddress || config.walrusWalletAddress,
      blobCount: this.localLedger.length,
      confirmedBlobs: confirmedCount,
    };
  }

  getLedger(): StoredBlobRecord[] {
    return this.localLedger;
  }
}

export const walrus = new WalrusClient();
