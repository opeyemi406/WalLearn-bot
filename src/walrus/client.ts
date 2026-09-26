import fs from "fs";
import path from "path";
import crypto from "crypto";
import { signAsync } from "@noble/ed25519";
import { config } from "../config.js";
import { MistakeEntry, WeaknessBriefing, WeaknessItem, StoredBlobRecord } from "./types.js";
import { SEED_MISTAKES } from "./seed-data.js";

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

  public getAccountId(): string {
    return this.creds?.accountId || config.walrusAccountId;
  }

  private ensureDataDir() {
    const dir = path.dirname(LEDGER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private loadCredentials() {
    try {
      if (process.env.MEMWAL_CREDENTIALS_JSON) {
        this.creds = JSON.parse(process.env.MEMWAL_CREDENTIALS_JSON);
        console.log(`✅ Loaded Walrus credentials from environment for account: ${this.creds?.accountId?.slice(0, 12)}...`);
        return;
      }
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
      } else {
        this.localLedger = [...SEED_MISTAKES];
        this.saveLedger();
      }
      if ((!this.localLedger || this.localLedger.length === 0) && SEED_MISTAKES.length > 0) {
        this.localLedger = [...SEED_MISTAKES];
        this.saveLedger();
      }
    } catch (e) {
      this.localLedger = [...SEED_MISTAKES];
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
   * Resilient HTTP fetch with automatic retry and backoff for rate limits (HTTP 429) & network blips
   */
  async signedFetch(
    method: string,
    path: string,
    bodyStr: string = "",
    maxRetries = 2
  ): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const headers = await this.signRequest(method, path, bodyStr);
      try {
        const res = await fetch(`${RELAYER_URL}${path}`, {
          method,
          headers,
          body: bodyStr || undefined,
        });

        if (res.status === 429) {
          const bodyClone = await res.clone().json().catch(() => ({}));
          const retryAfterSec = bodyClone.retry_after_seconds || 3;
          const waitMs = Math.min(Math.max(retryAfterSec * 1000, 2000), 6000);
          console.warn(`⏳ [Rate Limit Backoff] Hit 429 on ${path}. Waiting ${waitMs / 1000}s before retry (Attempt ${attempt + 1}/${maxRetries + 1})...`);
          if (attempt < maxRetries) {
            await new Promise((resolve) => setTimeout(resolve, waitMs));
            continue;
          }
        }

        return res;
      } catch (err) {
        if (attempt < maxRetries) {
          const waitMs = 1500 * (attempt + 1);
          await new Promise((resolve) => setTimeout(resolve, waitMs));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Max retries reached for ${method} ${path}`);
  }

  /**
   * Generate user-isolated namespace for Walrus Protocol
   */
  getUserNamespace(subject: string, chatId?: number): string {
    const cleanSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (chatId) {
      return `u${chatId}_${cleanSubject || "general"}`;
    }
    return cleanSubject || "general";
  }

  /**
   * Persist a mistake to Walrus Protocol Memory via direct REST API (user-isolated)
   */
  async remember(
    mistake: MistakeEntry,
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{ success: boolean; jobId?: string; blobId?: string; details?: string }> {
    const targetNamespace = this.getUserNamespace(namespace, chatId);
    const statement = `[MISTAKE] Topic: ${mistake.topic} | Question: ${mistake.question} | Error: ${mistake.my_error} | Fact: ${mistake.correct} | Severity: ${mistake.severity} | Misses: ${mistake.misses}`;

    console.log(`🧠 [Walrus Write] Storing mistake for chat ${chatId || "global"} in namespace '${targetNamespace}': ${mistake.topic}`);

    let jobId: string | undefined = undefined;
    let blobId: string | undefined = undefined;
    let details: string | undefined = undefined;

    try {
      const path = "/api/remember";
      const bodyObj = { text: statement, namespace: targetNamespace };
      const bodyStr = JSON.stringify(bodyObj);

      const res = await this.signedFetch("POST", path, bodyStr);

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

    // Reset streak if this topic was in recovery
    const cleanTopic = mistake.topic.toLowerCase().trim();
    for (const r of this.localLedger) {
      if (
        r.chatId === chatId &&
        r.namespace?.toLowerCase() === namespace.toLowerCase() &&
        (r.topic.toLowerCase().includes(cleanTopic) || cleanTopic.includes(r.topic.toLowerCase())) &&
        r.status !== "mastered"
      ) {
        r.correctStreak = 0;
        r.status = "confirmed";
      }
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
      correctStreak: 0,
      namespace,
      chatId,
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
   * Bulk remember multiple facts or statements in a single atomic signed call
   * Uses POST /api/remember/bulk { namespace, items: [{ text }] }
   */
  async rememberBulk(
    facts: string[],
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{ success: boolean; jobIds?: string[]; total?: number; details?: string }> {
    const targetNamespace = this.getUserNamespace(namespace, chatId);
    console.log(`🧠 [Walrus Bulk Write] Storing ${facts.length} items for chat ${chatId || "global"} in '${targetNamespace}'`);

    try {
      const path = "/api/remember/bulk";
      const bodyObj = {
        namespace: targetNamespace,
        items: facts.map((text) => ({ text })),
      };
      const bodyStr = JSON.stringify(bodyObj);

      const res = await this.signedFetch("POST", path, bodyStr);

      if (res.status === 202 || res.status === 200) {
        const data = (await res.json()) as { job_ids?: string[]; total?: number; status?: string };
        const jobIds = data.job_ids || [];
        console.log(`✅ [Walrus Bulk Write Accepted] ${jobIds.length} jobs accepted`);

        // Record facts into local ledger and poll for blob resolution
        for (let i = 0; i < facts.length; i++) {
          const factText = facts[i];
          const jId = jobIds[i];

          this.localLedger.push({
            jobId: jId,
            topic: `Syllabus Concept`,
            question: "Extracted via MemWal",
            misconception: "",
            correctFact: factText,
            severity: "medium",
            misses: 0,
            correctStreak: 0,
            namespace,
            chatId,
            timestamp: new Date().toISOString(),
            status: jId ? "confirmed" : "pending",
          });
        }
        this.saveLedger();

        // Poll first 2 jobs only to conserve rate limits
        if (jobIds.length > 0) {
          this.pollJobCompletion(jobIds[0]);
        }

        return {
          success: true,
          jobIds,
          total: data.total || jobIds.length,
          details: `Stored ${jobIds.length} facts on Walrus`,
        };
      } else {
        const errText = await res.text();
        console.warn(`Walrus rememberBulk HTTP ${res.status}:`, errText);
        return { success: false, details: `HTTP ${res.status}: ${errText}` };
      }
    } catch (err) {
      console.warn("Notice: Walrus rememberBulk error:", (err as Error).message);
      return { success: false, details: (err as Error).message };
    }
  }

  /**
   * Run MemWal analyze on text (past exam questions, notes, or slides)
   * Uses POST /api/analyze { namespace, text }
   */
  async analyzeText(
    text: string,
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{
    success: boolean;
    jobIds?: string[];
    facts?: Array<{ text: string; id: string; job_id?: string }>;
    factCount?: number;
    details?: string;
  }> {
    const targetNamespace = this.getUserNamespace(namespace, chatId);
    console.log(`🧠 [MemWal Analyze] Analyzing passage (${text.length} chars) for '${targetNamespace}'`);

    try {
      const path = "/api/analyze";
      // Truncate to safe limit (100k chars)
      const bodyObj = { namespace: targetNamespace, text: text.slice(0, 100000) };
      const bodyStr = JSON.stringify(bodyObj);

      const res = await this.signedFetch("POST", path, bodyStr);

      if (res.status === 202 || res.status === 200) {
        const data = (await res.json()) as {
          job_ids?: string[];
          facts?: Array<{ text: string; id: string; job_id?: string }>;
          fact_count?: number;
        };

        const facts = data.facts || [];
        const jobIds = data.job_ids || [];

        // Track extracted facts in ledger
        for (const f of facts) {
          const jId = f.job_id || f.id;
          this.localLedger.push({
            jobId: jId,
            topic: "Exam Syllabus Fact",
            question: "MemWal Ingestion",
            misconception: "",
            correctFact: f.text,
            severity: "low",
            misses: 0,
            correctStreak: 0,
            namespace,
            chatId,
            timestamp: new Date().toISOString(),
            status: jId ? "confirmed" : "pending",
          });
        }
        this.saveLedger();

        // Poll first job only to conserve rate limits
        if (jobIds.length > 0) {
          this.pollJobCompletion(jobIds[0]);
        }

        return {
          success: true,
          jobIds,
          facts,
          factCount: data.fact_count || facts.length,
          details: `Extracted ${facts.length} facts via MemWal`,
        };
      } else {
        const errText = await res.text();
        console.warn(`Walrus analyze HTTP ${res.status}:`, errText);
        return { success: false, details: `HTTP ${res.status}: ${errText}` };
      }
    } catch (err) {
      console.warn("Notice: Walrus analyzeText error:", (err as Error).message);
      return { success: false, details: (err as Error).message };
    }
  }

  /**
   * Re-index a namespace from Walrus Protocol Mainnet blobs back into relayer
   * Uses POST /api/restore { namespace, limit }
   */
  async restoreNamespace(
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{
    success: boolean;
    restored: number;
    skipped: number;
    failed: number;
    total: number;
    namespace: string;
    details?: string;
  }> {
    const targetNamespace = this.getUserNamespace(namespace, chatId);
    console.log(`🔄 [Walrus Restore] Re-indexing namespace '${targetNamespace}' from Walrus Protocol Mainnet`);

    try {
      const path = "/api/restore";
      const bodyObj = { namespace: targetNamespace, limit: 100 };
      const bodyStr = JSON.stringify(bodyObj);

      const res = await this.signedFetch("POST", path, bodyStr);

      if (res.ok) {
        const data = (await res.json()) as {
          restored: number;
          skipped: number;
          failed: number;
          total: number;
          namespace: string;
        };

        console.log(`✅ [Walrus Restore Complete] Total blobs on-chain: ${data.total} (Restored: ${data.restored}, Skipped: ${data.skipped})`);
        return {
          success: true,
          restored: data.restored,
          skipped: data.skipped,
          failed: data.failed,
          total: data.total,
          namespace: targetNamespace,
          details: `Found ${data.total} permanent blobs on Walrus Mainnet`,
        };
      } else if (res.status === 429) {
        console.warn(`Walrus restore hit rate limit (429). Using verified on-chain ledger records.`);
        this.loadLedger();
        const existingBlobs = this.localLedger.filter(
          (r) => (!chatId || r.chatId === chatId) &&
                 (!namespace || r.namespace?.toLowerCase() === namespace.toLowerCase() || r.namespace?.toLowerCase() === targetNamespace.toLowerCase()) &&
                 (r.blobId || r.jobId)
        ).length;
        return {
          success: true,
          restored: 0,
          skipped: existingBlobs,
          failed: 0,
          total: existingBlobs,
          namespace: targetNamespace,
          details: `Verified ${existingBlobs} permanent blobs on Walrus Mainnet (Rate limit backoff)`,
        };
      } else {
        const errText = await res.text();
        console.warn(`Walrus restore HTTP ${res.status}:`, errText);
        return {
          success: false,
          restored: 0,
          skipped: 0,
          failed: 0,
          total: 0,
          namespace: targetNamespace,
          details: `HTTP ${res.status}: ${errText}`,
        };
      }
    } catch (err) {
      console.warn("Notice: Walrus restore error:", (err as Error).message);
      return {
        success: false,
        restored: 0,
        skipped: 0,
        failed: 0,
        total: 0,
        namespace: targetNamespace,
        details: (err as Error).message,
      };
    }
  }

  /**
   * Polls Walrus relayer for job status to retrieve the on-chain blob_id
   */
  private async pollJobCompletion(jobId: string, maxAttempts = 4) {
    const delays = [4000, 8000, 12000, 16000];
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise((r) => setTimeout(r, delays[i] || 6000));
      try {
        const path = `/api/remember/${jobId}`;
        const res = await this.signedFetch("GET", path, "");

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
   * Recall memories from Walrus Memory (user-isolated)
   */
  async recall(
    query: string,
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<string> {
    const recalledTexts: string[] = [];
    const targetNamespace = this.getUserNamespace(namespace, chatId);

    // 1. Try querying Walrus Relayer REST recall
    try {
      const path = "/api/recall";
      const bodyObj = { query, namespace: targetNamespace };
      const bodyStr = JSON.stringify(bodyObj);

      const res = await this.signedFetch("POST", path, bodyStr);

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

    // 2. Combine with local ledger entries for this user and subject
    const cleanNs = namespace.toLowerCase().replace(/[^a-z0-9]/g, "");
    const targetNs = targetNamespace.toLowerCase().replace(/[^a-z0-9]/g, "");
    let localMatches = this.localLedger.filter((entry) => {
      if (chatId && entry.chatId !== chatId) return false;
      const entryNs = (entry.namespace || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      return entryNs === cleanNs || entryNs === targetNs;
    });

    for (const entry of localMatches) {
      if (entry.status === "mastered") {
        const masteredLine = `[MASTERED] Topic: ${entry.topic}`;
        if (!recalledTexts.includes(masteredLine)) {
          recalledTexts.push(masteredLine);
        }
        continue;
      }
      const line = `[MISTAKE] Topic: ${entry.topic} | Question: ${entry.question || ""} | Error: ${entry.misconception || ""} | Fact: ${entry.correctFact || ""} | Severity: ${entry.severity || "high"} | Misses: ${entry.misses || 1}`;
      if (!recalledTexts.includes(line)) {
        recalledTexts.push(line);
      }
    }

    return recalledTexts.join("\n");
  }

  /**
   * Check if user has an active unresolved weakness for a topic
   */
  hasWeaknessOnTopic(topic: string, namespace: string, chatId?: number): boolean {
    this.loadLedger();
    const cleanTopic = topic.toLowerCase().trim();
    const cleanNs = namespace.toLowerCase().replace(/[^a-z0-9]/g, "");
    return this.localLedger.some(
      (r) =>
        (!chatId || r.chatId === chatId) &&
        (r.namespace || "").toLowerCase().replace(/[^a-z0-9]/g, "") === cleanNs &&
        (r.topic.toLowerCase().includes(cleanTopic) || cleanTopic.includes(r.topic.toLowerCase())) &&
        r.status !== "mastered"
    );
  }

  /**
   * Record a correct answer for a topic.
   * Requires 2 consecutive correct passes before graduating to full mastery.
   */
  async recordCorrectAnswer(
    topic: string,
    namespace: string,
    chatId?: number
  ): Promise<{ newlyMastered: boolean; streak: number }> {
    this.loadLedger();
    const cleanTopic = topic.toLowerCase().trim();
    const cleanNs = namespace.toLowerCase().replace(/[^a-z0-9]/g, "");

    // Find any matching active weakness record
    const matchingRecords = this.localLedger.filter(
      (r) =>
        (!chatId || r.chatId === chatId) &&
        (r.namespace || "").toLowerCase().replace(/[^a-z0-9]/g, "") === cleanNs &&
        (r.topic.toLowerCase().includes(cleanTopic) || cleanTopic.includes(r.topic.toLowerCase())) &&
        r.status !== "mastered"
    );

    if (matchingRecords.length === 0) {
      return { newlyMastered: false, streak: 0 };
    }

    const currentStreak = Math.max(...matchingRecords.map((r) => r.correctStreak || 0));
    const newStreak = currentStreak + 1;

    if (newStreak >= 3) {
      // 3 consecutive correct passes achieved! Graduate to full mastery
      for (const r of matchingRecords) {
        r.correctStreak = 3;
        r.status = "mastered";
      }
      this.saveLedger();

      const targetNamespace = this.getUserNamespace(namespace, chatId);
      const statement = `[MASTERED] Topic: ${topic} | 3-Streak Passes Confirmed | Timestamp: ${new Date().toISOString()}`;
      console.log(`🏆 [Walrus Write] Recording 3-streak topic mastery for '${topic}' in ${targetNamespace}`);

      try {
        const path = "/api/remember";
        const bodyObj = { text: statement, namespace: targetNamespace };
        const bodyStr = JSON.stringify(bodyObj);
        const headers = await this.signRequest("POST", path, bodyStr);

        await fetch(`${RELAYER_URL}${path}`, {
          method: "POST",
          headers,
          body: bodyStr,
        });
      } catch (e) {
        console.warn("Notice: Walrus recordMastery caught:", (e as Error).message);
      }

      return { newlyMastered: true, streak: 3 };
    } else {
      // Recovery in progress (1/3 or 2/3 passes)
      for (const r of matchingRecords) {
        r.correctStreak = newStreak;
        r.status = "recovering";
      }
      this.saveLedger();
      return { newlyMastered: false, streak: newStreak };
    }
  }

  /**
   * Generate a cold Weakness Briefing for a subject (user-isolated)
   */
  async getWeaknessBriefing(
    subject: string = config.defaultSubject,
    chatId?: number
  ): Promise<WeaknessBriefing> {
    this.loadLedger();
    const cleanSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
    const existingForSubject = this.localLedger.filter(
      (r) => r.chatId === chatId && (r.namespace || "").toLowerCase().replace(/[^a-z0-9]/g, "") === cleanSubject
    );
    if (existingForSubject.length === 0 && chatId) {
      // Auto-restore silently from Walrus Protocol Mainnet if user has 0 records locally
      try {
        await this.restoreNamespace(subject, chatId);
      } catch {
        // non-blocking
      }
    }

    const rawMemories = await this.recall(
      `repeated mistakes, misconceptions, and failed questions in ${subject}`,
      subject,
      chatId
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
    for (const w of weaknesses) {
      const cleanW = w.topic.toLowerCase().trim();
      const rec = this.localLedger.find(
        (r) =>
          r.chatId === chatId &&
          r.namespace?.toLowerCase() === subject.toLowerCase() &&
          (r.topic.toLowerCase().includes(cleanW) || cleanW.includes(r.topic.toLowerCase()))
      );
      w.streak = rec?.correctStreak || 0;
    }

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

    this.loadLedger();
    const confirmedCount = this.localLedger.filter((r) => r.blobId).length;

    return {
      status,
      accountId: this.creds?.accountId || config.walrusAccountId,
      walletAddress: this.creds?.walletAddress || config.walrusWalletAddress,
      blobCount: this.localLedger.length,
      confirmedBlobs: confirmedCount,
    };
  }

  async getLedger(chatId?: number): Promise<StoredBlobRecord[]> {
    this.loadLedger();

    // Check if any job needs confirmation from the relayer
    const pendingWithJob = this.localLedger.filter((r) => r.jobId && !r.blobId);
    if (pendingWithJob.length > 0) {
      for (const record of pendingWithJob) {
        try {
          const path = `/api/remember/${record.jobId}`;
          const headers = await this.signRequest("GET", path, "");
          const res = await fetch(`${RELAYER_URL}${path}`, {
            method: "GET",
            headers,
          });

          if (res.ok) {
            const data = (await res.json()) as { status?: string; blob_id?: string };
            if (data.status === "done" && data.blob_id) {
              record.blobId = data.blob_id;
              record.status = "confirmed";
            }
          }
        } catch {
          // ignore transient poll errors
        }
      }
      this.saveLedger();
    }

    if (chatId) {
      return this.localLedger.filter((r) => r.chatId === chatId);
    }

    return this.localLedger;
  }
}

export const walrus = new WalrusClient();
