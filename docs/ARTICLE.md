# Building WalLearn: How We Solved Chatbot Amnesia for Medical Students Using Walrus Protocol & Sui

*An event-sourced cognitive architecture that ensures an aspiring doctor never fails the same clinical question twice.*

---

![WalLearn Banner](https://raw.githubusercontent.com/opeyemi406/WalLearn-bot/main/docs/banner.png)

> **Live Telegram Bot:** [@WalLearnBot](https://t.me/WalLearnBot)  
> **Open-Source Codebase:** [github.com/opeyemi406/WalLearn-bot](https://github.com/opeyemi406/WalLearn-bot)  
> **On-Chain Audit Dossier:** [72+ Confirmed Blobs on Walruscan](https://github.com/opeyemi406/WalLearn-bot/blob/main/WALRUS_BLOBS.md)  
> **Model:** Google Gemini 2.5 Flash via OpenRouter *(Beyond the Big Two Track)*  
> **Storage Layer:** Walrus Protocol Mainnet via `@mysten-incubation/memwal` (Sui Blockchain)  

---

## 1. The Critical Failure of AI Tutors: "Chatbot Amnesia"

Every developer who has built an AI tutor or educational chatbot has hit the same invisible brick wall: **Chatbot Amnesia**.

You sit down with a student. The student spends two hours working through tough clinical case vignettes. The model correctly identifies that the student consistently confuses **Phase 1 depolarizing neuromuscular blockade** with **Phase 2 desensitization block** when administering succinylcholine. The chatbot corrects them, offers a helpful explanation, and the session ends.

The next morning, the student opens the chat:
> *"Quiz me on pharmacology."*

The chatbot cheerfully replies:
> *"Sure! What would you like to study today?"*

Everything is gone. The chatbot has forgotten the student's struggle, their repeated mistakes, their streak count, and their clinical blind spots. 

In casual chat, amnesia is mildly annoying. In **high-stakes medical education**, it is fatal. Medical students preparing for board exams (USMLE, PLAB, MBBS) cannot afford generic flashcards. They need an adaptive system that **ruthlessly targets their personal misconceptions** and refuses to let them fail the same question twice.

Traditional Web2 solutions rely on centralized PostgreSQL/pgvector databases or hosted Pinecone instances. But these create custodial data silos: if the app shuts down or the database wipes, years of student learning telemetry vanish. Furthermore, students do not own their cognitive data.

This is why we built **WalLearn**: an intelligent study companion with **sovereign, permanent cognitive memory anchored on Walrus Protocol and the Sui blockchain**.

---

## 2. What WalLearn Does: Pedagogical Rigor Meets Multimodal AI

WalLearn is not another ChatGPT wrapper. It is an autonomous medical exam drill engine built around three pedagogical pillars:

```
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
Medical students do not study from generic textbooks alone; they study from their university professor's dense slide decks. WalLearn allows students to upload raw lecture PDFs (e.g., *Clinical Neuroanatomy of the Brainstem* or *Autonomic Pharmacology*). WalLearn extracts the syllabus text and uses MemWal's atomic concept ingestion to anchor core exam facts to Walrus Mainnet.

### The 60/30/10 Cognitive Invariant
When a student requests a study drill (`/study`), WalLearn does not generate a random quiz. An internal validator (`src/ai/validator.ts`) mathematically enforces a **60/30/10 distribution**:
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

```
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
Most naive chatbots attempt to store the entire raw conversation history. This pollutes vector search with conversational fluff (*"hi"*, *"thanks"*, *"can you explain that again?"*).

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

| Dimension | Before Memory (Standard Ephemeral Bot) | After Memory (WalLearn + Walrus Protocol) |
| :--- | :--- | :--- |
| **Cross-Session Continuity** | **Cold-Start Amnesia:** Every `/start` is a blank slate. The student must manually re-explain past struggles. | **Zero-Input Recall:** `/briefing` queries Walrus Mainnet before the student types a word, ranking active misconceptions by $(Misses \times Severity)$. |
| **Drill Generation** | **Random Generation:** Generates arbitrary questions based only on generic subject prompts. | **Invariant Ingestion:** Invariant validator enforces $\ge 50\%$ active weakness allocation + rotates distractors based on on-chain history. |
| **Mastery Verification** | **Single-Pass Heuristic:** One lucky guess marks a topic "learned," causing false confidence on exam day. | **3-Consecutive-Pass State Machine:** Requires 3 independent passes across separate study sessions before signing a `[MASTERED]` event. |
| **Disaster Recovery** | **Catastrophic Loss:** If the bot restarts or local disk clears, all student learning history is permanently gone. | **Decentralized State Replay:** If local storage is deleted, `/restore` queries Walrus blobs and replays all events from scratch. |
| **Data Ownership** | **Centralized Silo:** Data trapped in private databases; non-portable and proprietary. | **Self-Sovereign Memory:** Student owns their encrypted blobs on Sui Mainnet via their own wallet address. |

---

## 5. Real-World Field Session: Live Ingestion & CBT Drill on Pharmacology (`PCL301`)

To validate WalLearn's end-to-end memory loop, we recorded a live study session with a medical student preparing for **PCL301: Evaluation of Drug Toxicity**. The session captured the complete cognitive lifecycle: multimodal ingestion of raw course slides, autonomous cold recall of past struggles from Walrus Mainnet, targeted adaptive questioning, and real-time on-chain state updates.

### Phase 1: Ingestion & Autonomous Walrus Recall

The student sets the active course to **PCL301 - Evaluation of Drug Toxicity**, creating the isolated Sui namespace `pcl301`. Next, the student uploads their university lecture slide deck: **`PCL 301 Evaluation of Drug toxicity (2).pptx`** (2.3 MB).

WalLearn ingests and processes all **104 slides**, grounding the syllabus facts. When the student taps **⚡ 5 Questions (Sprint)**, WalLearn immediately queries Walrus Protocol before generating the drill:

> **WalLearn:** *"🧠 Recalling your past mistakes from Walrus for PCL301 - Evaluation of Drug toxicity (2)..."*  
> **WalLearn:** *"🎯 Starting 5-Question Drill: PCL301 - Evaluation of Drug toxicity (2)*  
> *📎 Source: PCL 301 Evaluation of Drug toxicity (2).pptx*  
> *Recalled 2 active weak topics from Walrus Mainnet. Applying 60/30/10 drill ratio...*  
> *⏳ Generating 5 questions via Gemini 2.5 Flash..."*

Notice what happened: without the student typing a single word about their history, WalLearn recovered two unmastered clinical topics from previous study sessions and dynamically allocated them into the 5-question sprint.

---

### Phase 2: Live CBT Drill & Conversation Log

#### Question 1: Identifying a New Misconception (Renal Elimination)
The bot presents the first clinical vignette:

> **WalLearn:**  
> 📖 **PCL301 · Question 1 of 5 CBT Mode**  
> 🎯 **Topic:** Renal Elimination  
> ———  
> *A new drug is being investigated for its elimination profile. It is observed that the drug has very high lipid solubility. Based on the principles of renal elimination, what would be the expected consequence for this drug's excretion rate?*  
>  
> A. Increased excretion due to enhanced glomerular filtration.  
> B. Rapid excretion due to active tubular secretion.  
> C. Slow excretion due to passive reabsorption in the tubules.  
> D. Excretion rate is unaffected by lipid solubility.  

The student taps **A**. WalLearn immediately intercepts the misconception:

> **WalLearn:**  
> ❌ **INCORRECT**  
> ———  
> • **Your Choice:** A. Increased excretion due to enhanced glomerular filtration.  
> • **Correct Answer:** C. Slow excretion due to passive reabsorption in the tubules.  
>  
> ⚠️ **Misconception Diagnosis:**  
> High lipid solubility promotes reabsorption, not increased filtration or excretion. Glomerular filtration is primarily based on molecular size and protein binding.  
>  
> 💡 **Flashcard Fact:**  
> Drugs with high lipid solubility are passively reabsorbed in the renal tubules, leading to slower excretion rates.  
> ———  
> 🧠 **Walrus Mainnet Persistence:**  
> • **Topic:** Renal Elimination  
> • **Status:** ✅ Committed to Walrus Mainnet Memory  
> • **Job ID:** `5a1e7326-40a0-4e36-a781-f9b3c04678b9`  
> • **On-Chain Account:** View on Suiscan  

Within milliseconds, WalLearn dispatches an Ed25519-signed `[MISTAKE]` event to the Walrus relayer. The failure is now indelibly recorded under the student's namespace on Sui.

---

#### Question 2: Memory in Action — Recovery of a Recalled Weak Topic
Because WalLearn recalled past struggles during initialization, Question 2 directly tests one of those prior weaknesses: the **Up and Down Procedure (UDP)** in acute toxicology.

> **WalLearn:**  
> 📖 **PCL301 · Question 2 of 5 CBT Mode**  
> 🎯 **Topic:** Range Finding Tests - Up and Down Procedure  
> ———  
> *In the Up and Down Procedure (UDP) for acute oral toxicology, a dose of 175 mg/kg is administered to the first animal. If this animal survives for 48 hours after administration, what is the next step in the procedure?*  
>  
> A. The experiment is concluded as the substance has minimal toxicity.  
> B. The dose is decreased and administered to a second animal.  
> C. The dose is increased and administered to a second animal.  
> D. Three more animals are immediately given the same dose.  

The student taps **C**.

> **WalLearn:**  
> ✅ **CORRECT!**  
> **Your choice:** C. The dose is increased and administered to a second animal.  
>  
> 💡 **Key Concept:** In the Up and Down Procedure, if an animal survives the administered dose, the dose is increased for the next animal; if it dies, the dose is decreased.  
> ———  
> 📈 **RECOVERY IN PROGRESS (1/3 Passes) 🎯**  
> *Great progress! You previously struggled with Range Finding Tests - Up and Down Procedure. Pass this topic 2 more times in future drills to achieve full mastery!*  

**This is the crux of WalLearn:** The system did not simply say "Correct." It verified that the student had previously failed this topic, advanced their on-chain recovery counter from 0 to 1, and informed them of the 2 remaining passes needed for permanent mastery.

---

#### Question 3: Routes of Drug Administration
The drill continues to test curriculum breadth:

> **WalLearn:**  
> 📖 **PCL301 · Question 3 of 5 CBT Mode**  
> 🎯 **Topic:** Routes of Drug Administration  
> ———  
> *Which of the following routes of drug administration is designed to avoid the hepatic first-pass effect to a significant extent?*  
>  
> A. Oral RODA  
> B. Rectal RODA  
> C. Intramuscular RODA  
> D. Subcutaneous RODA  

The student taps **C**.

> **WalLearn:**  
> ❌ **INCORRECT**  
> ———  
> • **Your Choice:** C. Intramuscular RODA  
> • **Correct Answer:** B. Rectal RODA  
>  
> ⚠️ **Misconception Diagnosis:**  
> Intramuscular administration bypasses the GI tract and liver initially, but the question asks for a route that avoids the first-pass effect, and rectal administration is specifically mentioned as doing so to some extent.  
>  
> 💡 **Flashcard Fact:**  
> Rectal administration can bypass the liver to some extent, thereby reducing the first-pass hepatic metabolism of drugs.  
> ———  
> 🧠 **Walrus Mainnet Persistence:**  
> • **Topic:** Routes of Drug Administration  
> • **Status:** ✅ Committed to Walrus Mainnet Memory  
> • **Job ID:** `40b3b088-8f3f-4dd9-a937-9c81fedd3c5d`  
> • **On-Chain Account:** View on Suiscan  

A second `[MISTAKE]` event is signed and anchored on Walrus with Job ID `40b3b088-8f3f-4dd9-a937-9c81fedd3c5d`.

---

#### Question 4: Parenteral Routes - Intravenous
The drill rolls forward into parenteral kinetics:

> **WalLearn:**  
> 📖 **PCL301 · Question 4 of 5 CBT Mode**  
> 🎯 **Topic:** Parenteral Routes - Intravenous  
> ———  
> *According to the lecture, what is a key disadvantage of intravenous (IV) drug administration?*  
>  
> A. Slow onset of action, making it unsuitable for emergencies.  
> B. Lower bioavailability compared to other parenteral routes.  
> C. Greater risk of adverse effects due to rapid high concentrations.  
> D. Limited to small quantities of drug administration.  

---

### What This Real-World Run Demonstrates

This session provides unambiguous evidence of WalLearn operating in the wild:

1. **Zero Cold-Start Friction:** 104 PowerPoint lecture slides ingested in seconds, producing questions directly grounded in the professor's material.
2. **Autonomous Cognitive Continuity:** WalLearn proactively queried Walrus Mainnet before the drill started, recalling 2 unmastered weaknesses.
3. **Provable Cryptographic Persistence:** Both mistakes were committed asynchronously to Walrus with verified Job IDs (`5a1e7326-40a0-4e36-a781-f9b3c04678b9` and `40b3b088-8f3f-4dd9-a937-9c81fedd3c5d`).
4. **Active 3-Pass State Transition:** Answering Question 2 correctly immediately triggered `RECOVERY IN PROGRESS (1/3 Passes)`, mathematically proving that WalLearn tracks long-term mastery across disjoint sessions.

---

## 6. Conclusion: Sovereign Memory for Autonomous AI

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
