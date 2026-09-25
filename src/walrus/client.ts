import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import fs from "fs";
import path from "path";
import { config } from "../config.js";
import { MistakeEntry, WeaknessBriefing, WeaknessItem, StoredBlobRecord } from "./types.js";

const LEDGER_FILE = path.resolve(process.cwd(), "data/mistakes-ledger.json");

export class WalrusClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isConnecting = false;
  private localLedger: StoredBlobRecord[] = [];

  constructor() {
    this.ensureDataDir();
    this.loadLedger();
  }

  private ensureDataDir() {
    const dir = path.dirname(LEDGER_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
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

  private async getClient(): Promise<Client | null> {
    if (this.client) return this.client;
    if (this.isConnecting) {
      // Wait for in-flight connection
      for (let i = 0; i < 20; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (this.client) return this.client;
      }
    }

    this.isConnecting = true;
    try {
      this.transport = new StdioClientTransport({
        command: "npx",
        args: ["-y", "@mysten-incubation/memwal-mcp"],
        env: {
          ...process.env,
          MEMWAL_CREDS_DIR: config.memwalCredsDir,
          MEMWAL_CLIENT_LABEL: "WalLearn Bot",
        },
      });

      const client = new Client(
        { name: "wallearn-bot", version: "1.0.0" },
        { capabilities: {} }
      );

      await client.connect(this.transport);
      this.client = client;
      console.log("✅ Walrus Memory MCP Bridge connected successfully.");
      return this.client;
    } catch (error) {
      console.warn("⚠️ Walrus MCP bridge connection delayed:", (error as Error).message);
      this.client = null;
      return null;
    } finally {
      this.isConnecting = false;
    }
  }

  /**
   * Persist a mistake to Walrus Memory
   */
  async remember(mistake: MistakeEntry, namespace: string = config.defaultSubject): Promise<{ success: boolean; jobId?: string; details?: string }> {
    const statement = `[MISTAKE] Topic: ${mistake.topic} | Question: ${mistake.question} | Error: ${mistake.my_error} | Fact: ${mistake.correct} | Severity: ${mistake.severity} | Misses: ${mistake.misses}`;

    console.log(`🧠 [Walrus Write] Storing mistake in namespace '${namespace}': ${mistake.topic}`);

    let jobId: string | undefined = undefined;
    let details: string | undefined = undefined;

    try {
      const client = await this.getClient();
      if (client) {
        const res = await client.callTool({
          name: "memwal_remember",
          arguments: {
            statement,
            namespace,
          },
        });

        const content = res.content as Array<{ type: string; text: string }>;
        const text = content?.[0]?.text || "";
        details = text;

        // Try extracting jobId or blobId from response
        const jobMatch = text.match(/job[_-]?id[:\s]+([a-zA-Z0-9_-]+)/i);
        if (jobMatch) jobId = jobMatch[1];
      }
    } catch (err) {
      console.warn("Notice: Walrus MCP remember call caught:", (err as Error).message);
      details = (err as Error).message;
    }

    // Always record to local ledger
    this.localLedger.push({
      jobId,
      topic: mistake.topic,
      timestamp: new Date().toISOString(),
      status: jobId ? "confirmed" : "pending",
    });
    this.saveLedger();

    return {
      success: true,
      jobId,
      details,
    };
  }

  /**
   * Recall memories from Walrus Memory
   */
  async recall(query: string, namespace: string = config.defaultSubject): Promise<string> {
    try {
      const client = await this.getClient();
      if (!client) return "";

      const res = await client.callTool({
        name: "memwal_recall",
        arguments: {
          query,
          namespace,
        },
      });

      const content = res.content as Array<{ type: string; text: string }>;
      return content?.[0]?.text || "";
    } catch (err) {
      console.warn("Walrus recall query caught:", (err as Error).message);
      return "";
    }
  }

  /**
   * Generate a cold Weakness Briefing for a subject
   */
  async getWeaknessBriefing(subject: string = config.defaultSubject): Promise<WeaknessBriefing> {
    const rawMemories = await this.recall(
      `repeated mistakes, misconceptions, and failed questions in ${subject}`,
      subject
    );

    const weaknesses: WeaknessItem[] = [];
    const mastered: string[] = [];

    // Parse memories line by line if structured entries exist
    const lines = rawMemories.split("\n");
    for (const line of lines) {
      if (line.includes("[MISTAKE]")) {
        const topicMatch = line.match(/Topic:\s*([^|]+)/i);
        const errorMatch = line.match(/Error:\s*([^|]+)/i);
        const factMatch = line.match(/Fact:\s*([^|]+)/i);
        const severityMatch = line.match(/Severity:\s*([^|]+)/i);
        const missesMatch = line.match(/Misses:\s*(\d+)/i);

        if (topicMatch) {
          weaknesses.push({
            topic: topicMatch[1].trim(),
            misconception: errorMatch ? errorMatch[1].trim() : "",
            correct_fact: factMatch ? factMatch[1].trim() : "",
            severity: (severityMatch?.[1].trim().toLowerCase() as any) || "medium",
            misses: missesMatch ? parseInt(missesMatch[1], 10) : 1,
          });
        }
      } else if (line.toLowerCase().includes("mastered:")) {
        const topicMatch = line.match(/topic:\s*([^|]+)/i);
        if (topicMatch) mastered.push(topicMatch[1].trim());
      }
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
   * Check connection and account health
   */
  async getHealth(): Promise<{ status: string; accountId: string; walletAddress: string; blobCount: number }> {
    return {
      status: "connected",
      accountId: config.walrusAccountId,
      walletAddress: config.walrusWalletAddress,
      blobCount: this.localLedger.length,
    };
  }

  getLedger(): StoredBlobRecord[] {
    return this.localLedger;
  }
}

export const walrus = new WalrusClient();
