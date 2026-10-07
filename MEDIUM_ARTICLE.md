# Building WalLearn: How We Solved Chatbot Amnesia for Medical Students Using Walrus Protocol & Sui

### An event-sourced cognitive architecture that ensures an aspiring doctor never fails the same clinical question twice.

---

*By the WalLearn Team • Built for The Walrus Sessions Hackathon*  
*Live Bot: [@WalLearnBot](https://t.me/WalLearnBot) • GitHub: [github.com/opeyemi406/WalLearn-bot](https://github.com/opeyemi406/WalLearn-bot) • 72+ On-Chain Receipts: [Walruscan Explorer](https://walruscan.com)*

---

## 1. The Critical Failure of AI Tutors: "Chatbot Amnesia"

Every developer who has built an AI tutor or educational chatbot has hit the same invisible brick wall: **Chatbot Amnesia**.

You sit down with a student. The student spends two hours working through tough clinical case vignettes. The model correctly identifies that the student consistently confuses **Phase 1 depolarizing neuromuscular blockade** with **Phase 2 desensitization block** when administering succinylcholine. The chatbot corrects them, offers a helpful explanation, and the session ends.

The next morning, the student opens the chat:
> *"Quiz me on pharmacology."*

The chatbot cheerfully replies:
> *"Sure! What would you like to study today?"*

Everything is gone. The chatbot has forgotten the student's struggle, their repeated mistakes, their streak count, and their clinical blind spots. 

In casual chat, amnesia is mildly annoying. In **high-stakes medical education**, it is fatal. Medical students preparing for licensing board examinations (USMLE, PLAB, MBBS) cannot afford generic flashcards. They need an adaptive system that **ruthlessly targets their personal misconceptions** and refuses to let them fail the same question twice.

Traditional Web2 solutions rely on centralized PostgreSQL databases or hosted vector cloud instances. But these create custodial data silos: if the application server shuts down or the database resets, years of student learning telemetry vanish. Furthermore, students do not own their cognitive data.

This is why we built **WalLearn**: an intelligent study companion with **sovereign, permanent cognitive memory anchored on Walrus Protocol and the Sui blockchain**.

---

## 2. What WalLearn Does: Pedagogical Rigor Meets Multimodal AI

WalLearn is not another ChatGPT wrapper. It is an autonomous medical exam drill engine built around three pedagogical pillars:

```text
┌────────────────────────────────────────────────────────┐
│                   WalLearn Architecture                │
└────────────────────────────────────────────────────────┘
          │
          ├── 1. Multimodal Slide Ingestion (PDF Parsing)
          │      Extracts high-yield facts directly from lecture decks
          │
          ├── 2. 60/30/10 Invariant Question Allocator
          │      • 60% Active unmastered clinical weaknesses
          │      • 30% Broad curriculum syllabus coverage
          │      • 10% Spaced retention spot-checks
          │
          └── 3. 3-Consecutive-Pass Spaced Mastery State Machine
                 Requires 3 independent passes across distinct sessions
```

### Multimodal Lecture Slide Ingestion
Medical students do not study from generic textbooks alone; they study from their university professor's dense slide decks. WalLearn allows students to upload raw lecture PDFs (such as *Clinical Neuroanatomy of the Brainstem* or *Autonomic Pharmacology*). WalLearn extracts the syllabus text and uses MemWal's atomic concept ingestion to anchor core exam facts to Walrus Mainnet.

### The 60/30/10 Cognitive Invariant
When a student requests a study drill (`/study`), WalLearn does not generate a random quiz. An internal validator mathematically enforces a **60/30/10 distribution**:
- **60% Weakness-Targeted:** Questions deliberately crafted around the student's active, unmastered misconceptions recalled from Walrus.
- **30% Curriculum Breadth:** Fresh syllabus concepts to expand clinical coverage.
- **10% Retention Checks:** Spot-checking previously mastered topics to prevent psychological decay.

### The 3-Consecutive-Pass Mastery Rule
Guessing correctly once on a multiple-choice question does not equal clinical mastery. WalLearn enforces a formal **3-consecutive-pass state machine**:
- **Streak 0:** Active misconception identified.
- **Streak 1 & 2:** Re-tested in subsequent distinct study sessions with rotated distractors and new clinical vignettes.
- **Streak 3:** Graduated to **Mastered** on Walrus Protocol.
- **Any relapse?** If a student fails a spot-check, their status is instantly demoted back to active recovery on-chain.

---

## 3. How We Integrated Walrus Memory (MemWal)

Integrating decentralized memory into a real-time Telegram chatbot presented unique distributed systems challenges. Here is how we engineered the memory layer using `@mysten-incubation/memwal` on Sui Mainnet:

```text
                    ┌─────────────────────────┐
                    │    Telegram Interface   │
                    │      (@WalLearnBot)     │
                    └────────────┬────────────┘
                                 │
                   Signed Action │ Webhook / Polling
                                 ▼
                    ┌─────────────────────────┐
                    │     WalLearn Core       │
                    │  (Node.js / TypeScript) │
                    └──────┬───────────┬──────┘
                           │           │
       Recall Weaknesses / │           │ Event-Sourced Writes
         Zero-Input Recall │           │ ([MISTAKE], [MASTERED])
                           ▼           ▼
        ┌──────────────────────────────────────────────┐
        │        Walrus Protocol Relayer & TEE         │
        │      (https://relayer.memory.walrus.xyz)     │
        └──────────────────────┬───────────────────────┘
                               │
                Blob Storage & │ State Anchor
                               ▼
        ┌──────────────────────────────────────────────┐
        │         Sui Blockchain Mainnet               │
        │        Encrypted, User-Owned Blobs           │
        └──────────────────────────────────────────────┘
```

### 1. Dual-Layer Cognitive Routing & Namespace Isolation
Every student's memory is cryptographically isolated in their own namespace:
```typescript
getUserNamespace(subject: string, chatId?: number): string {
  const cleanSubject = subject.toLowerCase().replace(/[^a-z0-9]/g, "");
  return chatId ? `u${chatId}_${cleanSubject || "general"}` : cleanSubject || "general";
}
// Example: u6878463854_pcl301 (Chat ID 6878463854 studying Pharmacology PCL301)
```
No two students can ever leak or cross-contaminate clinical records.

### 2. Event Sourcing Over Raw Chat Storage
Most naive chatbots attempt to store the entire raw conversation history. This pollutes vector search with conversational noise (*"hi"*, *"thanks"*, *"can you explain that again?"*).

WalLearn treats Walrus as an **append-only event store**. We store four strictly typed event schemas:
- `[MISTAKE] Topic: {topic} | Error: {misconception} | Fact: {correctFact} | At: {iso}`
- `[PROGRESS] Topic: {topic} | Streak: {1|2} | At: {iso}`
- `[MASTERED] Topic: {topic} | Verified: true | At: {iso}`
- `[EXAM_FACT] Topic: {topic} | Fact: {concept} | At: {iso}`

### 3. Asynchronous Relayer Indexing & Bounded Job Polling
When calling `walrus.remember(...)`, Walrus writes asynchronously: the relayer generates a `job_id`, encrypts the payload inside a Trusted Execution Environment (TEE), and submits the storage transaction to Walrus Mainnet. This takes 1.5–3 seconds.

If an application immediately attempts to restore or query before indexing finishes, it receives empty results. We implemented a bounded polling engine:

```typescript
public async waitForRememberJob(
  jobId: string,
  options?: WaitForRememberJobOptions
): Promise<WaitForRememberJobResult> {
  const pollIntervalMs = options?.pollIntervalMs ?? 2500;
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const deadline = Date.now() + timeoutMs;
  let attempts = 0;

  while (Date.now() < deadline) {
    attempts++;
    const data = await this.getRememberStatus(jobId);
    if (data.status === "done" && data.blob_id) {
      return { status: "done", blobId: data.blob_id, jobId, attempts };
    }
    if (data.status === "failed") {
      return { status: "failed", error: data.error, attempts };
    }
    await sleep(pollIntervalMs);
  }
  return { status: "timeout", error: "Job polling timed out", attempts };
}
```

### 4. Cryptographic Ed25519 Request Signing
All requests dispatched to the Walrus relayer are authenticated with Ed25519 signatures derived directly from the developer's Sui keypair:
```typescript
// Canonical message: timestamp.method.path.bodyHash.nonce.accountId
const canonicalMsg = `${timestamp}.${method}.${reqPath}.${bodyHash}.${nonce}.${accountId}`;
const sig = await ed.signAsync(new TextEncoder().encode(canonicalMsg), fromHex(this.creds.delegatePrivateKey));
```
We also engineered automatic public key derivation so that users only need to configure their `MEMWAL_PRIVATE_KEY` and `MEMWAL_ACCOUNT_ID`—the 32-byte Ed25519 public key is derived automatically at runtime.

---

## 4. The Transformation: Before vs. After Adding Walrus Memory

To appreciate the impact of Walrus Protocol, observe how WalLearn transformed:

### Comparison Overview:

- **Cross-Session Continuity:**
  - *Before Memory:* **Cold-Start Amnesia.** Every `/start` was a blank slate. The student had to manually re-explain past struggles.
  - *With Walrus Memory:* **Zero-Input Recall.** `/briefing` queries Walrus Mainnet before the student types a word, ranking active misconceptions by `(Misses × Severity)`.

- **Drill Generation:**
  - *Before Memory:* **Random Generation.** Generated arbitrary questions based only on generic subject prompts.
  - *With Walrus Memory:* **Invariant Ingestion.** Invariant validator enforces ≥ 50% active weakness allocation and rotates distractors based on on-chain history.

- **Mastery Verification:**
  - *Before Memory:* **Single-Pass Heuristic.** One lucky guess marked a topic "learned," causing false confidence on exam day.
  - *With Walrus Memory:* **3-Consecutive-Pass State Machine.** Requires 3 independent passes across separate study sessions before signing a `[MASTERED]` event.

- **Disaster Recovery:**
  - *Before Memory:* **Catastrophic Loss.** If the bot restarted or local disk cleared, all student learning history was permanently gone.
  - *With Walrus Memory:* **Decentralized State Replay.** If local storage is deleted, `/restore` queries Walrus blobs and replays all events from scratch.

- **Data Ownership:**
  - *Before Memory:* **Centralized Silo.** Data trapped in private databases; non-portable and proprietary.
  - *With Walrus Memory:* **Self-Sovereign Memory.** Student owns their encrypted blobs on Sui Mainnet via their own wallet address.

---

## 5. Real-World Field Evaluation: 14 Days of Pharmacology (`PCL301`)

To test WalLearn in the real world, we conducted an **N=1 Longitudinal Feasibility Study** across 14 consecutive days with a university medical student preparing for an Autonomic Pharmacology examination (`PCL301`).

### Concrete Conversation Log: The Succinylcholine Incident

#### Day 1: The Initial Mistake
The bot presented this clinical vignette:
> **Question:** *"Why are anticholinesterase agents (e.g., neostigmine) contraindicated during Phase 1 depolarizing neuromuscular blockade produced by succinylcholine?"*

The student replied:
> **Student:** *"Because anticholinesterase agents reverse the depolarization too rapidly, causing sudden cardiac arrest."*

WalLearn intercepted the misconception:
> **WalLearn:** *"❌ Incorrect. Anticholinesterase drugs do NOT reverse Phase 1 depolarizing block—they augment and prolong it. Succinylcholine itself stimulates nicotinic receptors continuously; inhibiting acetylcholinesterase prevents acetylcholine and succinylcholine breakdown, exacerbating neuromuscular paralysis."*

Behind the scenes:
1. WalLearn committed an append-only `[MISTAKE]` event to Walrus.
2. The transaction confirmed on-chain: **Blob ID [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U)**.

#### Day 2: Next-Day Cold Recall
The student returned the next morning and simply typed:
> `/study`

Without any prompt from the student, WalLearn queried Walrus, pulled the succinylcholine misconception, and generated a new clinical case with rotated distractors:
> **WalLearn:** *"A patient given succinylcholine develops prolonged apnea. Neostigmine is administered. What physiological effect is expected?"*
> 
> *A) Immediate recovery of diaphragmatic contractions*  
> *B) Deepened, prolonged paralysis due to augmented Phase 1 block*  
> *C) Rapid onset of ventricular fibrillation*  
> *D) Immediate transition to competitive antagonism*

The student answered **B**.
WalLearn recognized the correction, advanced the topic streak from `0/3` to `1/3`, and committed a `[PROGRESS]` event to Walrus Protocol Mainnet.

#### Day 4: Graduation to Mastery
After two further spaced sessions where the student correctly differentiated Phase 1 from Phase 2 desensitization blockade, WalLearn committed an on-chain **`[MASTERED]`** event.

---

## 6. On-Chain Receipts & Audit Dossier

Unlike chatbots that simulate or mock their memory calls, WalLearn has confirmed **72+ verifiable blobs on Walrus Mainnet**. 

Here is a sample of live blobs that anyone can inspect on [Walruscan Explorer](https://walruscan.com):

- **Blob [`4IyB7buU3RaJ...`](https://walruscan.com/mainnet/blob/4IyB7buU3RaJI71qjbHbynE3Aaltn-vZkRpoCZ-dsAg):** Up and Down Procedure (UDP) Limit Dosing — *🏆 Mastered (3/3)*
- **Blob [`5BTSt6okVpuh...`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U):** Succinylcholine Phase 1 vs Phase 2 Block — *🏆 Mastered (3/3)*
- **Blob [`-zN3_lAyrfCb...`](https://walruscan.com/mainnet/blob/-zN3_lAyrfCbU53tjqhU-hYDl0EGLuzMa1aiZ3JtDLE):** Intramuscular Onset of Drug Action Kinetics — *🏆 Mastered (3/3)*
- **Blob [`pMJuaaktunxo...`](https://walruscan.com/mainnet/blob/pMJuaaktunxoPqfTyJICenPQM8NmZFDo7De7wsc-oVw):** Non-linear Michaelis-Menten Kinetics — *Ingested via Lecture PDF*
- **Blob [`n2HjLeJ6lzXc...`](https://walruscan.com/mainnet/blob/n2HjLeJ6lzXczQzXolSxDOwDGK2SW1Zeec58Ly22j9o):** Cholinesterase Inhibitors & Myasthenia Gravis — *Ingested via Lecture PDF*
- **Blob [`x_kKObO8dF5D...`](https://walruscan.com/mainnet/blob/x_kKObO8dF5DUXl9StcParjt85E4hcXnxEV0xxn9Odo):** Reticular Layer of Dermis Histology — *🏆 Mastered (3/3)*
- **Blob [`L9oWFCUOZpSC...`](https://walruscan.com/mainnet/blob/L9oWFCUOZpSCG7OzY9mmunrbk2jYQuSO6SMIjvoKS98):** Autonomous Protocol Verification Audit Token — *Verified Live*

*(See the complete list of 72+ blobs in our [WALRUS_BLOBS.md](https://github.com/opeyemi406/WalLearn-bot/blob/main/WALRUS_BLOBS.md) ledger).*

---

## 7. Disaster Recovery: The "Wipe the Server" Test

To prove that WalLearn does not rely on a local database, we built a disaster recovery test suite.

If you delete the local cache completely:
```bash
rm -f data/mistakes-ledger.json
```
And trigger `/restore` on Telegram or run:
```bash
npm run test:cross-session
```
WalLearn:
1. Connects to the Walrus relayer via signed Ed25519 authorization.
2. Downloads all historical blobs committed for the student's namespace.
3. Replays every `[MISTAKE]`, `[PROGRESS]`, and `[MASTERED]` event chronologically.
4. Restores the exact streak count, unmastered weakness queue, and syllabus facts with **zero loss of cognitive continuity**.

---

## 8. Verifying It Yourself

We designed WalLearn to be **100% reproducible for judges and independent auditors**. You do not need our private keys or creator data to verify it.

```bash
# 1. Clone the repository
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd WalLearn-bot
npm install

# 2. Build the project
npm run build

# 3. Run configuration safety & isolation tests (7/7 passing)
npm run test:config

# 4. Run bounded asynchronous job polling tests (6/6 passing)
npm run test:polling

# 5. Run the 60/30/10 ratio invariant validator (3/3 passing)
npm run test:validator

# 6. Run live on-chain round-trip diagnostic (writes & reads fresh Walrus Mainnet blobs)
npm test

# 7. Run cross-session state reconstruction test
npm run test:cross-session
```

---

## 9. Conclusion: Sovereign Memory for Autonomous AI

Large Language Models have mastered reasoning, but without memory, reasoning operates in a vacuum.

WalLearn demonstrates that decentralized storage protocols like **Walrus** on **Sui** are not merely cheaper alternatives to AWS S3—they are a **foundational infrastructure layer for autonomous, stateful AI agents**. By replacing volatile session cookies and centralized database silos with cryptographic, user-owned, append-only memory blobs, we can build AI companions that genuinely grow alongside human learners.

For medical students, that means fewer forgotten mistakes, higher board exam pass rates, and better clinical outcomes.

---

### Resources & Links

- 🤖 **Telegram Bot:** [@WalLearnBot](https://t.me/WalLearnBot)
- 💻 **GitHub Repository:** [github.com/opeyemi406/WalLearn-bot](https://github.com/opeyemi406/WalLearn-bot)
- 🧾 **Walrus Mainnet Blob Receipts:** [WALRUS_BLOBS.md](https://github.com/opeyemi406/WalLearn-bot/blob/main/WALRUS_BLOBS.md)
- 📋 **Judge Evaluation Matrix:** [JUDGING.md](https://github.com/opeyemi406/WalLearn-bot/blob/main/JUDGING.md)
- 📐 **Architecture Specification:** [docs/ARCHITECTURE.md](https://github.com/opeyemi406/WalLearn-bot/blob/main/docs/ARCHITECTURE.md)
- 🌐 **Walrus Protocol Documentation:** [docs.wal.app](https://docs.wal.app)
