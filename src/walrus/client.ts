import fs from "fs";
import path from "path";
import crypto from "crypto";
import * as ed from "@noble/ed25519";
import { MemWal } from "@mysten-incubation/memwal";
import { config, resolveCredsDir } from "../config.js";

if (!ed.hashes?.sha512) {
  ed.hashes.sha512 = (...m: Uint8Array[]) =>
    crypto.createHash("sha512").update(Buffer.concat(m.map((b) => Buffer.from(b)))).digest();
}
import {
  MistakeEntry,
  WeaknessBriefing,
  WeaknessItem,
  StoredBlobRecord,
  WaitForRememberJobOptions,
  WaitForRememberJobResult,
} from "./types.js";
import {
  formatMistake,
  formatProgress,
  formatMastered,
  parseMemoryLine,
  replayEvents,
  topicsMatch,
  MemoryEvent,
} from "./memory-events.js";

/**
 * WalrusClient: Powered by official @mysten-incubation/memwal SDK.
 * Walrus Memory (MemWal relayer) is the decentralized source of truth.
 *
 * - Every mistake, streak change and mastery is written to Walrus as an event line.
 * - data/mistakes-ledger.json is only a write-through CACHE + job log. It can be deleted at any
 *   time; the next briefing/restore rebuilds it by replaying events recalled from Walrus.
 * - There is no bundled/seed data and no fallback that pretends Walrus answered.
 */

const LEDGER_FILE = path.join(config.dataDir, "mistakes-ledger.json");
const getRelayerUrl = () =>
  (process.env.MEMWAL_SERVER_URL || process.env.WALRUS_RELAYER_URL || config.memwalServerUrl || config.walrusRelayerUrl || "https://relayer.memory.walrus.xyz").replace(/\/$/, "");
const REQUEST_TIMEOUT_MS = 20_000;
const SYNC_TTL_MS = 5 * 60 * 1000; // re-sync from Walrus at most every 5 minutes per learner+course
const FRESH_WRITE_MS = 2 * 60 * 1000; // do not let a stale remote index overwrite a just-written local change
const MAX_PENDING_POLLS = 10;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const normNs = (s?: string) => (s || "").toLowerCase().replace(/[^a-z0-9]/g, "");

function fromHex(s: string): Uint8Array {
  const clean = s.startsWith("0x") ? s.slice(2) : s;
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16);
  return out;
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export type RecallSource = "walrus" | "local-cache" | "none";

export class WalrusClient {
  private ledger: StoredBlobRecord[] = [];
  private lastSync = new Map<string, number>();
  private sdk: MemWal | null = null;
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
    return this.creds?.accountId || config.walrusAccountId || "";
  }

  public hasCredentials(): boolean {
    return !!(this.creds?.accountId && this.creds?.delegatePrivateKey);
  }

  public getSdk(): MemWal | null {
    return this.sdk;
  }

  public async listNamespaces() {
    if (this.sdk) {
      return await this.sdk.listNamespaces({ limit: 100 });
    }
    return { namespaces: [], has_more: false, next_cursor: null, snapshot_version: 0 };
  }

  public reloadCredentials() {
    this.loadCredentials();
  }

  private ensureDataDir() {
    fs.mkdirSync(path.dirname(LEDGER_FILE), { recursive: true });
  }

  private loadCredentials() {
    try {
      if (process.env.MEMWAL_CREDENTIALS_JSON) {
        let parsed: any;
        try {
          parsed = JSON.parse(process.env.MEMWAL_CREDENTIALS_JSON);
        } catch (jsonErr) {
          throw new Error(`Failed to parse MEMWAL_CREDENTIALS_JSON: ${(jsonErr as Error).message}`);
        }
        const privateKey = (parsed.delegatePrivateKey || parsed.privateKey || "").trim();
        const accountId = (parsed.accountId || "").trim();
        if (!accountId || !privateKey) {
          throw new Error("Invalid MEMWAL_CREDENTIALS_JSON: missing required fields 'accountId' and 'delegatePrivateKey'.");
        }
        let pubHex = (parsed.delegatePublicKeyHex || parsed.delegateAddress || "").trim();
        if (pubHex.startsWith("0x")) pubHex = pubHex.slice(2);
        if (!pubHex && privateKey) {
          try {
            pubHex = toHex(ed.getPublicKey(fromHex(privateKey)));
          } catch {
            // fallback
          }
        }
        this.creds = {
          accountId,
          delegatePrivateKey: privateKey,
          delegatePublicKeyHex: pubHex,
          walletAddress: parsed.walletAddress || "",
        };
      } else if (process.env.MEMWAL_PRIVATE_KEY || process.env.WALRUS_DELEGATE_PRIVATE_KEY) {
        const privateKey = (process.env.MEMWAL_PRIVATE_KEY || process.env.WALRUS_DELEGATE_PRIVATE_KEY || "").trim();
        const accountId = (process.env.MEMWAL_ACCOUNT_ID || process.env.WALRUS_ACCOUNT_ID || "").trim();
        const delegateAddress = (process.env.MEMWAL_DELEGATE_ADDRESS || process.env.WALRUS_DELEGATE_ADDRESS || "").trim();
        const walletAddress = (process.env.MEMWAL_WALLET_ADDRESS || process.env.WALRUS_WALLET_ADDRESS || "").trim();

        const missing: string[] = [];
        if (!accountId) missing.push("MEMWAL_ACCOUNT_ID");

        if (missing.length > 0) {
          throw new Error(
            `Incomplete MemWal credentials: MEMWAL_PRIVATE_KEY is provided, but required identity field(s) [${missing.join(
              ", "
            )}] are missing. Never pair a private key with an unspecified or mismatched account.`
          );
        }

        let pubHex = delegateAddress.startsWith("0x") ? delegateAddress.slice(2) : delegateAddress;
        if (!pubHex && privateKey) {
          try {
            pubHex = toHex(ed.getPublicKey(fromHex(privateKey)));
          } catch {
            // fallback
          }
        }

        this.creds = {
          accountId,
          delegatePrivateKey: privateKey,
          delegatePublicKeyHex: pubHex,
          walletAddress: walletAddress || "",
        };
      } else {
        const credsDir =
          process.env.MEMWAL_CREDS_DIR !== undefined
            ? process.env.MEMWAL_CREDS_DIR === "none" || process.env.MEMWAL_CREDS_DIR === ""
              ? ""
              : resolveCredsDir(process.env.MEMWAL_CREDS_DIR)
            : config.memwalCredsDir;
        const credsPath = credsDir ? path.join(credsDir, "credentials.json") : "";
        if (credsPath && fs.existsSync(credsPath)) {
          let parsed: any;
          try {
            parsed = JSON.parse(fs.readFileSync(credsPath, "utf8"));
          } catch (jsonErr) {
            throw new Error(`Failed to parse ${credsPath}: ${(jsonErr as Error).message}`);
          }
          const privateKey = (parsed.delegatePrivateKey || parsed.privateKey || "").trim();
          const accountId = (parsed.accountId || "").trim();
          if (!accountId || !privateKey) {
            throw new Error(`Invalid credentials file at ${credsPath}: missing 'accountId' and 'delegatePrivateKey'.`);
          }
          let pubHex = (parsed.delegatePublicKeyHex || parsed.delegateAddress || "").trim();
          if (pubHex.startsWith("0x")) pubHex = pubHex.slice(2);
          if (!pubHex && privateKey) {
            try {
              pubHex = toHex(ed.getPublicKey(fromHex(privateKey)));
            } catch {
              // fallback
            }
          }
          this.creds = {
            accountId,
            delegatePrivateKey: privateKey,
            delegatePublicKeyHex: pubHex,
            walletAddress: parsed.walletAddress || "",
          };
        } else {
          this.creds = null;
        }
      }

      if (this.creds?.delegatePrivateKey && this.creds?.accountId) {
        if (!/^[0-9a-fA-F]{64}$/.test(this.creds.delegatePrivateKey.trim())) {
          throw new Error("Invalid delegatePrivateKey: must be a 64-character hex-encoded Ed25519 private key.");
        }
        this.sdk = MemWal.create({
          key: this.creds.delegatePrivateKey,
          accountId: this.creds.accountId,
          serverUrl: getRelayerUrl(),
        });
        console.log(`✅ Loaded MemWal credentials & initialized SDK for account: ${this.creds.accountId.slice(0, 12)}...`);
      } else {
        this.creds = null;
        this.sdk = null;
      }
    } catch (e) {
      this.creds = null;
      this.sdk = null;
      console.error("Configuration notice in MemWal credentials:", (e as Error).message);
      throw e;
    }
  }

  private loadLedger() {
    try {
      if (fs.existsSync(LEDGER_FILE)) {
        const parsed = JSON.parse(fs.readFileSync(LEDGER_FILE, "utf8"));
        this.ledger = Array.isArray(parsed) ? parsed : [];
      }
    } catch (e) {
      console.error("Ledger cache unreadable, starting empty (Walrus will repopulate it):", e);
      this.ledger = [];
    }
    for (const r of this.ledger) {
      if (!r.recordType) {
        r.recordType = !r.misconception && !r.misses ? "fact" : "mistake";
      }
    }
  }

  private saveLedger() {
    try {
      fs.writeFileSync(LEDGER_FILE, JSON.stringify(this.ledger, null, 2));
    } catch (e) {
      console.error("Failed to save ledger cache:", e);
    }
  }

  private async signRequest(method: string, reqPath: string, bodyStr: string = "") {
    if (!this.creds) {
      this.loadCredentials();
      if (!this.creds) throw new Error("Missing MemWal credentials (see README: MemWal setup)");
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = crypto.randomUUID();
    const bodyHash = crypto.createHash("sha256").update(bodyStr).digest("hex");
    const accountId = this.creds.accountId;

    let pubKey = this.creds.delegatePublicKeyHex;
    if (!pubKey && this.creds.delegatePrivateKey) {
      try {
        pubKey = toHex(ed.getPublicKey(fromHex(this.creds.delegatePrivateKey)));
        this.creds.delegatePublicKeyHex = pubKey;
      } catch {
        // fallback
      }
    }

    // Canonical message: timestamp.method.path.bodyHash.nonce.accountId
    const canonicalMsg = `${timestamp}.${method}.${reqPath}.${bodyHash}.${nonce}.${accountId}`;
    const sig = await ed.signAsync(new TextEncoder().encode(canonicalMsg), fromHex(this.creds.delegatePrivateKey));

    return {
      "content-type": "application/json",
      "x-public-key": pubKey,
      "x-signature": toHex(sig),
      "x-timestamp": timestamp,
      "x-nonce": nonce,
      "x-account-id": accountId,
    };
  }

  /** Signed relayer request with request timeout, 429 backoff (body or Retry-After header) and network retry. */
  async signedFetch(method: string, reqPath: string, bodyStr: string = "", maxRetries = 2): Promise<Response> {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const headers = await this.signRequest(method, reqPath, bodyStr);
      try {
        const res = await fetch(`${getRelayerUrl()}${reqPath}`, {
          method,
          headers,
          body: bodyStr || undefined,
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        });
        if (res.status === 429 && attempt < maxRetries) {
          const body = (await res.clone().json().catch(() => ({}))) as { retry_after_seconds?: number };
          const hdr = Number(res.headers.get("retry-after"));
          const sec = body.retry_after_seconds ?? (Number.isFinite(hdr) && hdr > 0 ? hdr : 3);
          const waitMs = Math.min(Math.max(sec * 1000, 2000), 8000);
          console.warn(`⏳ [429] ${reqPath}: waiting ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries + 1})`);
          await sleep(waitMs);
          continue;
        }
        return res;
      } catch (err) {
        if (attempt < maxRetries) {
          await sleep(1500 * (attempt + 1));
          continue;
        }
        throw err;
      }
    }
    throw new Error(`Max retries reached for ${method} ${reqPath}`);
  }

  /** Learner-isolated namespace: u<chatId>_<course> */
  getUserNamespace(subject: string, chatId?: number): string {
    const cleanSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
    return chatId ? `u${chatId}_${cleanSubject || "general"}` : cleanSubject || "general";
  }

  private mistakeRecords(chatId: number | undefined, namespace: string, topic?: string) {
    return this.ledger.filter(
      (r) =>
        r.recordType === "mistake" &&
        r.chatId === chatId &&
        normNs(r.namespace) === normNs(namespace) &&
        (topic === undefined || topicsMatch(r.topic, topic))
    );
  }

  private async postRemember(text: string, targetNamespace: string): Promise<{ jobId?: string; details: string }> {
    try {
      if (this.sdk) {
        const res = await this.sdk.remember(text, targetNamespace);
        return { jobId: res.job_id, details: `Job accepted: ${res.job_id} (${res.status})` };
      }
      const res = await this.signedFetch("POST", "/api/remember", JSON.stringify({ text, namespace: targetNamespace }));
      if (res.status === 202 || res.status === 200) {
        const data = (await res.json()) as { job_id?: string; status?: string };
        return { jobId: data.job_id, details: `Job accepted: ${data.job_id} (${data.status})` };
      }
      const errText = await res.text();
      console.warn(`Walrus remember HTTP ${res.status}:`, errText);
      return { details: `HTTP ${res.status}: ${errText}` };
    } catch (err) {
      console.warn("Walrus remember failed:", (err as Error).message);
      return { details: (err as Error).message };
    }
  }

  /** Persist a mistake to Walrus (event line) and demote any existing progress/mastery on that topic. */
  async remember(
    mistake: MistakeEntry,
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{ success: boolean; jobId?: string; blobId?: string; details?: string }> {
    const at = new Date().toISOString();
    const target = this.getUserNamespace(namespace, chatId);
    console.log(`🧠 [Walrus Write] mistake chat=${chatId ?? "global"} ns=${target}: ${mistake.topic}`);

    const { jobId, details } = await this.postRemember(formatMistake(mistake, at), target);

    for (const r of this.mistakeRecords(chatId, namespace, mistake.topic)) {
      r.correctStreak = 0;
      r.status = "confirmed"; // demotes mastered topics too
      r.updatedAt = at;
    }
    this.ledger.push({
      jobId,
      recordType: "mistake",
      topic: mistake.topic,
      question: mistake.question,
      misconception: mistake.my_error,
      correctFact: mistake.correct,
      severity: mistake.severity,
      misses: mistake.misses,
      correctStreak: 0,
      namespace,
      chatId,
      timestamp: at,
      updatedAt: at,
      status: jobId ? "confirmed" : "pending",
    });
    this.saveLedger();
    if (jobId) void this.pollJobCompletion(jobId);

    return { success: !!jobId, jobId, details };
  }

  /** Store a single exam or verified syllabus fact to Walrus (event line). */
  async recordFact(
    topic: string,
    fact: string,
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{ success: boolean; jobId?: string; details?: string }> {
    const at = new Date().toISOString();
    const target = this.getUserNamespace(namespace, chatId);
    const line = `[EXAM_FACT] Topic: ${topic} | Fact: ${fact} | At: ${at}`;
    const { jobId, details } = await this.postRemember(line, target);
    this.ledger.push({
      jobId,
      recordType: "fact",
      topic,
      question: "Exam Syllabus Fact",
      misconception: "",
      correctFact: fact,
      severity: "low",
      misses: 0,
      correctStreak: 0,
      namespace,
      chatId,
      timestamp: at,
      status: jobId ? "confirmed" : "pending",
    });
    this.saveLedger();
    if (jobId) void this.pollJobCompletion(jobId);
    return { success: !!jobId, jobId, details };
  }

  /** Bulk-store facts in one signed call. */
  async rememberBulk(
    facts: string[],
    namespace: string = config.defaultSubject,
    chatId?: number
  ): Promise<{ success: boolean; jobIds?: string[]; total?: number; details?: string }> {
    const target = this.getUserNamespace(namespace, chatId);
    console.log(`🧠 [Walrus Bulk Write] ${facts.length} items ns=${target}`);
    try {
      let jobIds: string[] = [];
      let total = 0;
      if (this.sdk) {
        const res = await this.sdk.rememberBulk(facts.map((text) => ({ text, namespace: target })));
        jobIds = res.job_ids || [];
        total = res.total || jobIds.length;
      } else {
        const res = await this.signedFetch(
          "POST",
          "/api/remember/bulk",
          JSON.stringify({ namespace: target, items: facts.map((text) => ({ text })) })
        );
        if (res.status === 202 || res.status === 200) {
          const data = (await res.json()) as { job_ids?: string[]; total?: number };
          jobIds = data.job_ids || [];
          total = data.total || jobIds.length;
        } else {
          const errText = await res.text();
          console.warn(`Walrus rememberBulk HTTP ${res.status}:`, errText);
          return { success: false, details: `HTTP ${res.status}: ${errText}` };
        }
      }

      const now = new Date().toISOString();
      facts.forEach((factText, i) => {
        this.ledger.push({
          jobId: jobIds[i],
          recordType: "fact",
          topic: "Syllabus Concept",
          question: "Extracted via MemWal",
          misconception: "",
          correctFact: factText,
          severity: "medium",
          misses: 0,
          correctStreak: 0,
          namespace,
          chatId,
          timestamp: now,
          status: jobIds[i] ? "confirmed" : "pending",
        });
      });
      this.saveLedger();
      if (jobIds[0]) void this.pollJobCompletion(jobIds[0]);
      return { success: true, jobIds, total: total || jobIds.length, details: `Stored ${jobIds.length} facts on Walrus` };
    } catch (err) {
      return { success: false, details: (err as Error).message };
    }
  }

  /** MemWal analyze(): extract atomic facts from text and store each as a memory. */
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
    const target = this.getUserNamespace(namespace, chatId);
    try {
      let jobIds: string[] = [];
      let facts: Array<{ text: string; id: string; job_id?: string }> = [];
      let factCount = 0;

      if (this.sdk) {
        const res = await this.sdk.analyze(text.slice(0, 100000), target);
        jobIds = res.job_ids || [];
        facts = (res.facts || []).map((f) => ({ text: f.text, id: f.id, job_id: f.job_id }));
        factCount = res.fact_count || facts.length;
      } else {
        const res = await this.signedFetch("POST", "/api/analyze", JSON.stringify({ namespace: target, text: text.slice(0, 100000) }));
        if (res.status === 202 || res.status === 200) {
          const data = (await res.json()) as {
            job_ids?: string[];
            facts?: Array<{ text: string; id: string; job_id?: string }>;
            fact_count?: number;
          };
          facts = data.facts || [];
          jobIds = data.job_ids || [];
          factCount = data.fact_count || facts.length;
        } else {
          const errText = await res.text();
          console.warn(`Walrus analyze HTTP ${res.status}:`, errText);
          return { success: false, details: `HTTP ${res.status}: ${errText}` };
        }
      }

      const now = new Date().toISOString();
      for (const f of facts) {
        const jId = f.job_id || f.id;
        this.ledger.push({
          jobId: jId,
          recordType: "fact",
          topic: "Exam Syllabus Fact",
          question: "MemWal Ingestion",
          misconception: "",
          correctFact: f.text,
          severity: "low",
          misses: 0,
          correctStreak: 0,
          namespace,
          chatId,
          timestamp: now,
          status: jId ? "confirmed" : "pending",
        });
      }
      this.saveLedger();
      if (jobIds[0]) void this.pollJobCompletion(jobIds[0]);
      return { success: true, jobIds, facts, factCount: factCount || facts.length, details: `Extracted ${facts.length} facts via MemWal` };
    } catch (err) {
      return { success: false, details: (err as Error).message };
    }
  }

  // ---------------------------------------------------------------------------
  // Reading from Walrus
  // ---------------------------------------------------------------------------

  /** Recall memories by meaning. Falls back to the local cache ONLY on error or when explicitly allowed. */
  async recallDetailed(
    query: string,
    namespace: string = config.defaultSubject,
    chatId?: number,
    options?: { fallbackToLocal?: boolean; limit?: number }
  ): Promise<{ texts: string[]; blobs?: string[]; source: RecallSource; error?: string }> {
    const target = this.getUserNamespace(namespace, chatId);
    let error: string | undefined;
    const limit = options?.limit ?? 50;

    if (this.sdk) {
      try {
        const res = await this.sdk.recall({ query, namespace: target, limit });
        const texts = (res.results ?? []).map((r) => r.text).filter((t): t is string => !!t);
        const blobs = (res.results ?? []).map((r) => r.blob_id).filter((b): b is string => !!b);
        if (texts.length > 0) {
          return { texts, blobs, source: "walrus" };
        }
        if (options?.fallbackToLocal === false) {
          return { texts: [], blobs: [], source: "none" };
        }
      } catch (err) {
        error = (err as Error).message;
      }
    } else {
      try {
        const res = await this.signedFetch("POST", "/api/recall", JSON.stringify({ query, namespace: target, limit }));
        if (res.ok) {
          const data = (await res.json()) as { results?: Array<{ text?: string; blob_id?: string }> };
          const texts = (data.results ?? []).map((r) => r.text).filter((t): t is string => !!t);
          const blobs = (data.results ?? []).map((r) => r.blob_id).filter((b): b is string => !!b);
          if (texts.length > 0) {
            return { texts, blobs, source: "walrus" };
          }
          if (options?.fallbackToLocal === false) {
            return { texts: [], blobs: [], source: "none" };
          }
        } else {
          error = `HTTP ${res.status}`;
        }
      } catch (err) {
        error = (err as Error).message;
      }
    }

    if (options?.fallbackToLocal === false) {
      return { texts: [], blobs: [], source: "none", error };
    }

    console.warn(`⚠️ Walrus recall returned no hits or failed (${error || "empty"}); using local cache for this answer only`);
    const local = this.mistakeRecords(chatId, namespace)
      .filter((r) => r.status !== "mastered")
      .map((r) => `[MISTAKE] Topic: ${r.topic} | Error: ${r.misconception || ""} | Fact: ${r.correctFact || ""}`);
    return { texts: local, source: local.length ? "local-cache" : "none", error };
  }

  async recall(query: string, namespace: string = config.defaultSubject, chatId?: number): Promise<string> {
    return (await this.recallDetailed(query, namespace, chatId)).texts.join("\n");
  }

  private async fetchRemoteEvents(targetNamespace: string): Promise<{ ok: boolean; events: MemoryEvent[]; error?: string }> {
    const queries = [
      "MISTAKE question error fact topic",
      "progress streak and mastered topics",
      "exam facts and syllabus concepts",
      "mistakes, misconceptions and failed questions",
    ];
    const seen = new Set<string>();
    const events: MemoryEvent[] = [];
    let anyOk = false;
    let error: string | undefined;

    for (const query of queries) {
      try {
        let items: Array<{ text: string; blob_id?: string }> = [];
        if (this.sdk) {
          const res = await this.sdk.recall({ query, namespace: targetNamespace, limit: 100 });
          items = (res.results ?? []).map((r) => ({ text: r.text, blob_id: r.blob_id }));
          anyOk = true;
        } else {
          const res = await this.signedFetch("POST", "/api/recall", JSON.stringify({ query, namespace: targetNamespace, limit: 100 }));
          if (!res.ok) {
            error = `HTTP ${res.status}`;
            continue;
          }
          anyOk = true;
          const data = (await res.json()) as { results?: Array<{ text?: string; blob_id?: string }> };
          items = (data.results ?? []).map((r) => ({ text: r.text || "", blob_id: r.blob_id }));
        }

        for (const item of items) {
          if (!item.text || seen.has(item.text)) continue;
          seen.add(item.text);
          const ev = parseMemoryLine(item.text, item.blob_id);
          if (ev) events.push(ev);
        }
      } catch (err) {
        error = (err as Error).message;
      }
      await sleep(200); // be gentle with relayer rate limits
    }
    return { ok: anyOk, events, error };
  }

  /** Replay Walrus events into the local cache. Walrus wins unless the local change is seconds old. */
  private applyReplay(events: MemoryEvent[], course: string, chatId?: number) {
    const { topics, facts } = replayEvents(events);
    const now = Date.now();

    for (const s of topics.values()) {
      const matches = this.mistakeRecords(chatId, course, s.topic);
      if (matches.length > 0) {
        for (const r of matches) {
          const fresh = r.updatedAt && now - Date.parse(r.updatedAt) < FRESH_WRITE_MS;
          if (fresh) continue;
          r.correctStreak = s.streak;
          r.status = s.status;
          if (s.blobId && !r.blobId) r.blobId = s.blobId;
        }
      } else {
        this.ledger.push({
          recordType: "mistake",
          topic: s.topic,
          question: s.question,
          misconception: s.misconception,
          correctFact: s.correctFact,
          severity: s.severity,
          misses: s.misses,
          correctStreak: s.streak,
          namespace: course.toLowerCase(),
          chatId,
          timestamp: s.lastAt ? new Date(s.lastAt).toISOString() : new Date().toISOString(),
          blobId: s.blobId,
          status: s.status,
        });
      }
    }

    for (const f of facts) {
      const exists = this.ledger.some(
        (r) => r.recordType === "fact" && r.chatId === chatId && normNs(r.namespace) === normNs(course) && r.correctFact === f.text
      );
      if (!exists) {
        this.ledger.push({
          recordType: "fact",
          topic: "Exam Syllabus Fact",
          question: "MemWal Ingestion",
          misconception: "",
          correctFact: f.text,
          severity: "low",
          misses: 0,
          correctStreak: 0,
          namespace: course.toLowerCase(),
          chatId,
          timestamp: f.at ? new Date(f.at).toISOString() : new Date().toISOString(),
          blobId: f.blobId,
          status: "confirmed",
        });
      }
    }
    this.saveLedger();
  }

  /**
   * /restore: ask the relayer to re-index the namespace from Walrus blobs, then rebuild learner state
   * ONLY from what Walrus returns. If Walrus returns nothing, this reports nothing.
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
    const target = this.getUserNamespace(namespace, chatId);
    console.log(`🔄 [Walrus Restore] ns=${target}`);

    let restoreOk = false;
    let skipped = 0;
    let failed = 0;
    let relayerTotal = 0;
    let details: string | undefined;

    try {
      let isTruncated = true;
      let pageCount = 0;
      const MAX_RESTORE_PAGES = 10; // Supports up to 1,000 on-chain blobs per namespace

      while (isTruncated && pageCount < MAX_RESTORE_PAGES) {
        pageCount++;
        if (this.sdk) {
          const d = await this.sdk.restore(target, 100);
          restoreOk = true;
          skipped += d.skipped ?? 0;
          failed += d.failed ?? 0;
          relayerTotal = Math.max(relayerTotal, d.total ?? 0);
          isTruncated = Boolean(d.truncated);
        } else {
          const res = await this.signedFetch("POST", "/api/restore", JSON.stringify({ namespace: target, limit: 100 }));
          if (res.ok) {
            const d = (await res.json()) as { skipped?: number; failed?: number; total?: number; truncated?: boolean };
            restoreOk = true;
            skipped += d.skipped ?? 0;
            failed += d.failed ?? 0;
            relayerTotal = Math.max(relayerTotal, d.total ?? 0);
            isTruncated = Boolean(d.truncated);
          } else {
            details = `restore HTTP ${res.status}: ${await res.text()}`;
            break;
          }
        }
      }
    } catch (err) {
      details = (err as Error).message;
    }

    const remote = await this.fetchRemoteEvents(target);
    if (remote.ok) {
      this.applyReplay(remote.events, namespace, chatId);
    }
    this.lastSync.set(`${chatId}:${normNs(namespace)}`, Date.now());

    return {
      success: restoreOk || remote.ok,
      restored: remote.events.length,
      skipped,
      failed,
      total: Math.max(relayerTotal, remote.events.length),
      namespace: target,
      details: details ?? remote.error ?? `Recovered ${remote.events.length} memory entries from Walrus`,
    };
  }

  // ---------------------------------------------------------------------------
  // Learning state
  // ---------------------------------------------------------------------------

  hasWeaknessOnTopic(topic: string, namespace: string, chatId?: number): boolean {
    return this.mistakeRecords(chatId, namespace, topic).some((r) => r.status !== "mastered" && (r.misses || 0) > 0);
  }

  /**
   * Record a correct answer. 3 consecutive correct answers on a topic in recovery = mastered.
   * Each state change is written to Walrus so the streak survives a wiped container.
   */
  async recordCorrectAnswer(
    topic: string,
    namespace: string,
    chatId?: number
  ): Promise<{ newlyMastered: boolean; streak: number }> {
    const matching = this.mistakeRecords(chatId, namespace, topic).filter((r) => r.status !== "mastered");
    if (matching.length === 0) return { newlyMastered: false, streak: 0 };

    const newStreak = Math.max(...matching.map((r) => r.correctStreak || 0)) + 1;
    const at = new Date().toISOString();
    const target = this.getUserNamespace(namespace, chatId);

    if (newStreak >= 3) {
      for (const r of matching) {
        r.correctStreak = 3;
        r.status = "mastered";
        r.updatedAt = at;
      }
      this.saveLedger();
      void this.postRemember(formatMastered(topic, at), target);
      return { newlyMastered: true, streak: 3 };
    }

    for (const r of matching) {
      r.correctStreak = newStreak;
      r.status = "recovering";
      r.updatedAt = at;
    }
    this.saveLedger();
    void this.postRemember(formatProgress(topic, newStreak, at), target);
    return { newlyMastered: false, streak: newStreak };
  }

  /** Weakness briefing for quiz generation. Syncs from Walrus first (cold start and every 5 minutes). */
  async getWeaknessBriefing(subject: string = config.defaultSubject, chatId?: number): Promise<WeaknessBriefing> {
    const key = `${chatId}:${normNs(subject)}`;
    if (chatId) {
      const everSynced = this.lastSync.has(key);
      const stale = Date.now() - (this.lastSync.get(key) || 0) > SYNC_TTL_MS;
      if (!everSynced || stale) {
        try {
          if (!everSynced && this.mistakeRecords(chatId, subject).length === 0) {
            await this.restoreNamespace(subject, chatId); // cold start: re-index + replay
          } else {
            const remote = await this.fetchRemoteEvents(this.getUserNamespace(subject, chatId));
            if (remote.ok) this.applyReplay(remote.events, subject, chatId);
            this.lastSync.set(key, Date.now());
          }
        } catch (e) {
          console.warn("Walrus sync before briefing failed:", (e as Error).message);
          this.lastSync.set(key, Date.now());
        }
      }
    }

    const sevWeight: Record<string, number> = { high: 3, medium: 2, low: 1 };
    const byTopic = new Map<string, StoredBlobRecord[]>();
    for (const r of this.mistakeRecords(chatId, subject)) {
      if ((r.misses || 0) <= 0) continue;
      const k = r.topic.toLowerCase().trim();
      byTopic.set(k, [...(byTopic.get(k) ?? []), r]);
    }

    const weaknesses: WeaknessItem[] = [];
    const mastered: string[] = [];
    for (const recs of byTopic.values()) {
      if (recs.every((r) => r.status === "mastered")) {
        mastered.push(recs[0].topic);
        continue;
      }
      const latest = recs[recs.length - 1];
      weaknesses.push({
        topic: latest.topic,
        misses: recs.reduce((n, r) => n + (r.misses || 1), 0),
        severity: recs.some((r) => r.severity === "high") ? "high" : latest.severity || "medium",
        misconception: latest.misconception || "",
        correct_fact: latest.correctFact || "",
        streak: Math.max(...recs.map((r) => r.correctStreak || 0)),
      });
    }
    weaknesses.sort((a, b) => b.misses * (sevWeight[b.severity] || 2) - a.misses * (sevWeight[a.severity] || 2));

    return { subject, total_mistakes: weaknesses.length, weaknesses: weaknesses.slice(0, 5), mastered };
  }

  // ---------------------------------------------------------------------------
  // Health / ledger
  // ---------------------------------------------------------------------------

  async getHealth(chatId?: number): Promise<{
    status: string;
    reachable: boolean;
    accountId: string;
    walletAddress: string;
    blobCount: number;
    confirmedBlobs: number;
    relayerVersion?: string;
  }> {
    let status = "offline";
    let reachable = false;
    let relayerVersion: string | undefined;

    if (this.sdk) {
      try {
        const h = await this.sdk.health();
        reachable = h.status === "ok";
        status = h.status === "ok" ? "healthy & verified on Walrus Protocol" : `relayer status ${h.status}`;
        relayerVersion = h.version;
      } catch {
        status = "offline";
      }
    } else {
      try {
        const res = await this.signedFetch("GET", "/api/whoami", "", 0);
        reachable = res.ok;
        status = res.ok ? "healthy & verified on Walrus Protocol" : `relayer status ${res.status}`;
      } catch {
        status = "offline";
      }
    }
    const records = chatId ? this.ledger.filter((r) => r.chatId === chatId) : this.ledger;
    return {
      status,
      reachable,
      accountId: this.creds?.accountId || "unconfigured",
      walletAddress: this.creds?.walletAddress || "unconfigured",
      blobCount: records.length,
      confirmedBlobs: new Set(records.filter((r) => r.blobId).map((r) => r.blobId)).size,
      relayerVersion,
    };
  }

  /**
   * One-shot status lookup for a MemWal remember job.
   */
  public async getRememberStatus(jobId: string): Promise<{ status: string; blob_id?: string; error?: string }> {
    if (this.sdk) {
      try {
        const data = await this.sdk.getRememberStatus(jobId);
        return { status: data.status, blob_id: data.blob_id, error: data.error };
      } catch (err) {
        return { status: "error", error: (err as Error).message };
      }
    }
    try {
      const res = await this.signedFetch("GET", `/api/remember/${jobId}`, "");
      if (res.ok) {
        const data = (await res.json()) as { status?: string; blob_id?: string; error?: string };
        return { status: data.status || "unknown", blob_id: data.blob_id, error: data.error };
      }
      return { status: "error", error: `HTTP ${res.status}` };
    } catch (err) {
      return { status: "error", error: (err as Error).message };
    }
  }

  /**
   * Reliable bounded polling for MemWal remember jobs.
   * Stops when confirmed/completed or failed/timed out.
   */
  public async waitForRememberJob(
    jobId: string,
    options?: WaitForRememberJobOptions
  ): Promise<WaitForRememberJobResult> {
    const pollIntervalMs = options?.pollIntervalMs ?? 2500;
    const timeoutMs = options?.timeoutMs ?? 60_000;
    const maxAttempts = options?.maxAttempts ?? Math.ceil(timeoutMs / pollIntervalMs);
    const deadline = Date.now() + timeoutMs;

    let attempts = 0;

    while (Date.now() < deadline && attempts < maxAttempts) {
      attempts++;
      try {
        const data = await this.getRememberStatus(jobId);
        if (data.status === "done" && data.blob_id) {
          const rec = this.ledger.find((r) => r.jobId === jobId);
          if (rec) {
            rec.blobId = data.blob_id;
            this.saveLedger();
          }
          return { status: "done", blobId: data.blob_id, jobId, attempts };
        }
        if (data.status === "failed") {
          return {
            status: "failed",
            jobId,
            error: data.error || "Job reported failed status on Walrus relayer",
            attempts,
          };
        }
      } catch (err) {
        const msg = (err as Error).message || "Transient polling error";
        if (attempts >= maxAttempts || Date.now() >= deadline) {
          return { status: "error", jobId, error: msg, attempts };
        }
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) break;
      await sleep(Math.min(pollIntervalMs, remaining));
    }

    return {
      status: "timeout",
      jobId,
      error: `Job ${jobId} timed out after ${attempts} attempts (${timeoutMs}ms)`,
      attempts,
    };
  }

  /**
   * Backward-compatible alias for waitForRememberJob.
   */
  public async waitForJobCompletion(
    jobId: string,
    maxAttempts = 10,
    intervalMs = 2500
  ): Promise<{ status: string; blobId?: string; error?: string }> {
    const res = await this.waitForRememberJob(jobId, {
      pollIntervalMs: intervalMs,
      timeoutMs: maxAttempts * intervalMs,
      maxAttempts,
    });
    return { status: res.status, blobId: res.blobId, error: res.error };
  }

  /** Resolve blob IDs for recent jobs. Only fills blobId; never changes learning state. */
  private async pollJobCompletion(jobId: string, maxAttempts = 4) {
    await this.waitForRememberJob(jobId, {
      pollIntervalMs: 4000,
      timeoutMs: maxAttempts * 4000,
      maxAttempts,
    });
  }

  async getLedger(chatId?: number): Promise<StoredBlobRecord[]> {
    const pending = this.ledger.filter((r) => r.jobId && !r.blobId && !r.unverified).slice(-MAX_PENDING_POLLS);
    let changed = false;
    for (const rec of pending) {
      try {
        if (this.sdk && rec.jobId) {
          const data = await this.sdk.getRememberStatus(rec.jobId);
          if (data.status === "done" && data.blob_id) {
            rec.blobId = data.blob_id;
            changed = true;
          }
        } else if (rec.jobId) {
          const res = await this.signedFetch("GET", `/api/remember/${rec.jobId}`, "", 0);
          if (res.ok) {
            const data = (await res.json()) as { status?: string; blob_id?: string };
            if (data.status === "done" && data.blob_id) {
              rec.blobId = data.blob_id;
              changed = true;
            }
          }
        }
      } catch {
        // ignore transient poll errors
      }
    }
    if (changed) this.saveLedger();
    return chatId ? this.ledger.filter((r) => r.chatId === chatId) : this.ledger;
  }

  getAllPlatformCourseCodes(): string[] {
    const codes = new Set<string>();
    for (const r of this.ledger) {
      const ns = (r.namespace || "").replace(/^u\d+_/, "").toLowerCase();
      if (ns && /^[a-z]{2,5}\d{2,4}$/i.test(ns)) codes.add(ns);
    }
    return Array.from(codes);
  }
}

export const walrus = new WalrusClient();
