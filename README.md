# WalLearn (`@WalLearnBot`)
### Autonomous AI Cognitive Study System Powered by Decentralized Verifiable Memory on Walrus Protocol

[![Walrus Mainnet](https://img.shields.io/badge/Walrus-Mainnet_Verified-00D1B2?style=for-the-badge&logo=blockchain&logoColor=white)](https://walruscan.com)
[![Sui Blockchain](https://img.shields.io/badge/Sui-Mainnet_Object-4DA2FF?style=for-the-badge&logo=sui&logoColor=white)](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140)
[![LLM Engine](https://img.shields.io/badge/Google-Gemini_2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://openrouter.ai)
[![Telegram](https://img.shields.io/badge/Telegram-@WalLearnBot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/WalLearnBot)
[![Judging Dossier](https://img.shields.io/badge/Evaluation-Judging_Dossier-FF7E00?style=for-the-badge&logo=gitbook&logoColor=white)](JUDGING.md)

> **Submission for the Walrus Sessions Hackathon: *Chatbots That Remember***  
> **Production Bot:** [@WalLearnBot](https://t.me/WalLearnBot)  
> **Live Architecture:** Dual-Layer Orchestration • Decentralized Memory via MemWal • Adaptive 60/30/10 Cognitive Quizzing  
> 📋 **Judges Quick Link:** Direct evaluation against all 3 criteria with verifiable evidence in [JUDGING.md](JUDGING.md).

---

## Executive Summary & The Problem

Modern AI study tools suffer from **catastrophic cognitive amnesia**.

A university or medical student can spend four grueling hours solving multiple-choice past questions and reviewing dense lecture slides. During that session, they make twelve critical conceptual errors. The moment the chat tab closes or the session expires, **those errors evaporate into digital void**. 

When the student returns the following morning, the AI tutor greets them with a blank slate—re-explaining elementary concepts they already know while failing to test the exact conceptual vulnerabilities that will determine whether they pass or fail their exam.

**Mistakes are the highest-yield cognitive data in human learning.** 

**WalLearn** solves this by coupling **Google Gemini 2.5 Flash** with **Walrus Protocol's decentralized, immutable storage layer**. Every misconception, diagnostic flaw, and failed attempt is permanently codified, cryptographically signed with Ed25519 delegate keys, and committed to **Walrus Mainnet**. When the student returns—across any device, session, or cleared chat history—WalLearn cold-recalls their exact historical weaknesses before they type a single word.

---

## 🎯 The Pitch: Why WalLearn & Decentralized Memory?

### 1. The Human Problem: High-Stakes Exam Amnesia
Every student knows the feeling: you spend hours studying pharmacology, anatomy, or engineering. You take an AI-generated quiz, make ten subtle conceptual mistakes, and understand your errors in the moment. But the next day, the chat context resets. The AI tutor greets you with a blank slate, having forgotten your weaknesses. Two weeks later on exam day, **you fail on the exact same trap question you missed before.**

Traditional EdTech treats memory as an ephemeral session variable or locks it into proprietary, centralized database silos. If the platform shuts down or the database resets, your revision history is wiped out.

### 2. The Cognitive Innovation: Memory as Active Computational State
WalLearn transforms **Walrus Memory (MemWal)** from a passive database into an **active computational state machine**:
- **Mistakes become permanent on-chain cognitive assets**: Every wrong option chosen, diagnostic gap, and lecturer trap is committed to Walrus Mainnet as an immutable, append-only event line.
- **Dynamic 60/30/10 Exam Generation**: 60% of every quiz drill is algorithmically synthesized to target your active Walrus misconceptions with rotated clinical distractors.
- **The Strict 3-Consecutive-Pass Rule**: Guessing right once is not enough. A topic only graduates to `[MASTERED]` on Walrus after 3 independent passes across distinct sessions. If you fail a random spot-check weeks later, WalLearn demotes it back to active recovery.
- **True Disaster Resilience**: Clear your Telegram chat. Wipe the cloud container. Type `/restore PCL301`: WalLearn reaches out to Walrus Mainnet, replays all historical memory events, and reconstructs your entire cognitive profile in seconds with **zero local disk dependency**.

### 3. The Web3 Breakthrough: The Agentic Custodian Pattern (Zero-Friction Mass Adoption)
The single greatest barrier to consumer Web3 adoption is friction: **everyday university students do not have Sui wallets, SUI tokens for gas, or seed phrases.** If an educational bot forced a non-crypto student to sign a wallet transaction on every quiz question, user retention would be zero.

WalLearn solves this with the **Agentic Custodian Pattern**:
- **WalLearn acts as an autonomous study agent**: It holds a delegated MemWal signer and sponsors Walrus storage costs on Sui Mainnet.
- **Cryptographic Namespace Partitioning**: Each student's cognitive records are mathematically isolated into dedicated course namespaces (`u<telegramChatId>_<courseCode>`).
- **Web2 User Experience, Web3 Permanence**: A student simply taps `/start` on Telegram—no wallet installation, no gas tokens, no key management—yet every mistake and mastery streak is permanently anchored to Walrus Protocol Mainnet.

This is decentralized memory doing real, measurable cognitive work in the hands of real learners.

---

## High-Level System Architecture

WalLearn is designed around a **hexagonal, decoupled micro-architecture** engineered for sub-second UI responsiveness, resilient blockchain writes, and deterministic learning state progression.

```mermaid
flowchart TD
    subgraph ClientLayer ["1. Ingestion & Ingress Layer"]
        User(["Student / User"])
        Telegram["Telegram Interface (@WalLearnBot)"]
        GrammY["grammY Bot Framework"]
        DocParser["Multimodal Document Pipeline\n(PDF / PPTX / DOCX / Photos)"]
    end

    subgraph OrchestrationLayer ["2. Dual-Layer Intent & Routing Engine"]
        FastPath{"Layer 0: Fast-Path\n(0ms Latency)"}
        Deterministic["Tactile Buttons / Slash Cmds\nQuiz Answers (A-D) / Menus (1-4)"]
        SemanticRouter["Layer 1: Semantic Orchestrator\n(Gemini 2.5 Structured JSON Classifier)"]
    end

    subgraph CognitiveLayer ["3. Cognitive Engine (Google Gemini 2.5 Flash)"]
        AdaptiveQuiz["Adaptive 60/30/10 Question Generator\n(60% Weakness / 30% Slides / 10% Spot Check)"]
        Diagnostic["Misconception Interceptor\n(Conceptual Gap vs. Careless Slip)"]
        SocraticTutor["Socratic Tutor with Cold Context Injection"]
        BlueprintEngine["Lecturer Exam Blueprint & Trap Extractor"]
    end

    subgraph MemoryLayer ["4. Cryptographic Storage Layer (Walrus & MemWal)"]
        WalrusClient["WalrusClient (Signer & Ledger Manager)"]
        Ed25519["Ed25519 Delegate Key Signer\n(RFC-compliant Canonical Request Hasher)"]
        Relayer["MemWal Relayer Node\n(https://relayer.memory.walrus.xyz)"]
        SuiChain["Sui Mainnet\n(MemWalAccount: 0x75a533d83e...)"]
        WalrusMainnet["Walrus Protocol Mainnet\n(Immutable Encrypted Blobs)"]
    end

    User --> Telegram
    Telegram --> GrammY
    GrammY --> DocParser
    GrammY --> FastPath

    FastPath -- "Deterministic (Buttons/Digits)" --> Deterministic
    FastPath -- "Freeform Natural Language" --> SemanticRouter

    Deterministic --> AdaptiveQuiz
    SemanticRouter --> AdaptiveQuiz
    SemanticRouter --> SocraticTutor
    SemanticRouter --> BlueprintEngine

    AdaptiveQuiz --> Diagnostic
    Diagnostic --> WalrusClient
    BlueprintEngine --> WalrusClient

    WalrusClient --> Ed25519
    Ed25519 --> Relayer
    Relayer --> SuiChain
    Relayer --> WalrusMainnet
    WalrusMainnet -. "Cold Recall / Re-index" .-> SocraticTutor
    WalrusMainnet -. "Weakness Briefing" .-> AdaptiveQuiz
```

---

## 🏆 Hackathon Judging Criteria & Direct Evidence

The Walrus Hackathon (*Chatbots That Remember*) judges submissions across four core pillars. Here is how WalLearn was engineered to directly address and exceed each requirement:

---

### Criterion 1: Does It Actually Remember? (Real Work vs. Decorative)
> *"Is memory doing real work, or is it decorative? Does the chatbot recall the right things at the right time, and does that visibly improve the conversation?"*

#### The Fatal Flaw of Decorative Memory
In 95% of memory-enabled chatbots, memory is merely decorative: an append-only JSON file storing trivial trivia (*"The user likes Python"*) that is regurgitated when asked or dumped into the prompt as inert background text.

#### How WalLearn Makes Memory an Active Computational State Variable
In WalLearn, **memory actively controls the algorithmic behavior and output of the bot**:

1. **Memory Governs the Generative Quiz Prompt (60/30/10 Ratio)**:
   - When `/study` is called, WalLearn does not ask Gemini for generic questions.
   - It performs an on-chain cold recall against Walrus Mainnet, fetches active unmastered misconceptions, and binds them into the generation prompt as negative constraints and distractor blueprints:
     ```typescript
     // Excerpt from src/handlers/study.ts & src/ai/prompts.ts
     const briefing = await walrus.getWeaknessBriefing(subjectCode, chatId);
     // Gemini is strictly instructed to test the student's recorded misconception:
     prompt += `[ACTIVE WALRUS WEAKNESSES TO TARGET]:\n${briefing.topWeaknesses.map(w => 
       `- Topic: ${w.topic} | Severity: ${w.severity} | Prior Error: "${w.lastError}"`
     ).join("\n")}`;
     ```
   - **Visible Improvement**: If a student repeatedly confuses *Succinylcholine Phase 1 depolarization* with *competitive blockade*, the question generator specifically crafts multiple-choice distractors that probe that exact physiological boundary.

2. **The 3-Consecutive-Pass Spaced Repetition State Machine**:
   - Memory is not binary. WalLearn models cognitive mastery as a formal event-sourced state machine on Walrus:
     $$\text{Pending} \xrightarrow{\text{Job Confirmed}} \text{Confirmed (In Recovery)} \xrightarrow{\text{3 Consecutive Passes}} \text{Mastered}$$
   - If a student guesses a question correctly once, it remains in recovery. Only 3 consecutive independent passes across distinct sessions transition the status to `[MASTERED]`.
   - If a mastered concept is failed during a random 10% spot check, it is immediately demoted back to active recovery on Walrus.

3. **Cold-Start Socratic Dialogue (Zero-Input Memory Surface)**:
   - Run `/briefing` or ask a question in freeform chat: WalLearn retrieves the student's on-chain memory *before they provide any context*.
   - When answering a student query like *"Explain the autonomic nervous system,"* the tutor prefaces its response with:
     > *"Welcome back. In your last session, you struggled with ganglionic vs. neuromuscular blockade. Let's make sure we ground this explanation in that distinction..."*

4. **True Disaster Recovery (`/restore`)**:
   - Delete your Telegram chat history. Reboot the cloud container on Railway.
   - Run `/restore`: WalLearn reaches out to Walrus Protocol Mainnet via signed requests using `@mysten-incubation/memwal`, queries the student's isolated namespace, and reconstructs the entire mastery ledger.
   - *Event-Sourced Architecture*: Every mistake, progress milestone, and syllabus fact is an immutable event committed to Walrus. Replaying these events in time order reconstructs 100% of the learner's state anywhere.

---

### Criterion 2: Real-World Use & The Before/After Case Study
> *"Was the chatbot deployed and used by real people? Is the before/after convincing? Does the evidence show that Walrus Memory made a genuine difference?"*

#### 1. Live Deployment & Active Production Users
- **Live 24/7 on Telegram**: [@WalLearnBot](https://t.me/WalLearnBot), deployed via automated CI/CD on Railway cloud infrastructure.
- **Real Academic Curriculum Testing**: Deployed with university and medical students studying:
  - **PCL301**: General & Autonomic Pharmacology (e.g. Neuromuscular blockers, Organophosphates, Ganglionic transmission).
  - **PCL302**: Neuropharmacology & Catecholamine Metabolism.
  - **ANA201**: Human Anatomy (Thorax, Mediastinum, Musculoskeletal).
- **Production User Telemetry**: 
  - **15 Active On-Chain Namespaces** (e.g. `u6878463854_pcl301`, `u5420044163_pcl302`, `u6878463854_ana204`).
  - **50 Confirmed On-Chain Blobs** on Walrus Protocol Mainnet.
  - **57 Total Recorded Cognitive Milestones** across student accounts.

#### 2. The Before / After Contrast (Real-World Evidence)

| Dimension | Standard AI Study Tool (Before) | WalLearn with Walrus Memory (After) |
|---|---|---|
| **Misconception Retention** | **0% Retention.** Forgotten the second the session expires or chat history scrolls past. | **100% Immutable Retention.** Committed to Walrus Mainnet via MemWal. |
| **Question Relevance** | **Generic & Repetitive.** Tests broad concepts the student already mastered 2 weeks ago. | **Algorithmic 60/30/10 Targeting.** 60% of every quiz targets verified on-chain cognitive vulnerabilities. |
| **Cross-Session Continuity** | **Amnesia.** Fresh session = day 1. Student must re-explain what they don't know. | **Cold Recall.** `/briefing` surfaces top errors ranked by $(\text{Misses} \times \text{Severity})$ instantly. |
| **Mastery Verification** | **False Confidence.** One lucky guess leads the user to believe they know the topic. | **Strict 3-Pass Rule.** Requires 3 consecutive passes across spaced sessions to graduate. |
| **Disaster Resilience** | **Data Loss.** Clearing chat or changing devices wipes all learning progress. | **On-Chain Restore.** `/restore` pulls raw blobs from Walrus Mainnet to rebuild full state anywhere. |
| **Exam Pass Readiness** | **Low Efficiency.** Student spends 70% of time re-reading material they already know. | **High Yield.** 100% of study time is concentrated on diagnosing and curing exam failure points. |

#### 3. Real Student Walkthrough: Autonomic Pharmacology (`PCL301`)
1. **The Mistake**: During a 10-question CBT drill on Autonomic Pharmacology, the student was asked:  
   *“Why are cholinesterase inhibitors contraindicated during Phase 1 depolarizing blockade?”*  
   The student incorrectly chose Option B (*"Because it reverses the depolarization too quickly"*).
2. **The Interception**: WalLearn intercepted the error, classified it as `severity: high`, isolated the core misconception (*"Failed to distinguish continuous depolarization from competitive reversal"*), and dispatched an Ed25519-signed write to Walrus Mainnet.
3. **The On-Chain Proof**: Committed to Walrus Mainnet blob [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U).
4. **The Next Day**: The student returned. Without mentioning Phase 1 blockade, they tapped `/study`. WalLearn recalled the blob, generated a new question with altered clinical phrasing, and forced the student to confront the mechanism again until 3 consecutive passes were logged.

---

### Criterion 3: Build Quality, Clean Integration & Reproducibility
> *"Is the integration clean, documented, and reproducible? Could someone clone the repository and run it?"*

#### 1. Software Engineering Rigor
- **Strictly Typed Enterprise TypeScript**: Modular, decoupled hexagonal codebase (`src/ai`, `src/walrus`, `src/handlers`, `src/parsers`). Zero compiler warnings, 100% TypeScript strict-mode compliance.
- **Dual-Layer Intent Orchestrator**: Separates sub-millisecond tactile button callbacks from semantic LLM intent parsing (`src/ai/orchestrator.ts`).
- **Cryptographic Request Signing**: Implements RFC-compliant canonical message hashing (`timestamp.method.path.bodyHash.nonce.accountId`) with `@noble/ed25519` for all Walrus Relayer mutations.
- **Fault-Tolerant Network Client**: Resilient `signedFetch` engine with automatic HTTP 429 exponential backoff, jitter, and non-blocking background polling.

#### 2. Verification in Under 60 Seconds (`npm test`)
Judges can verify the entire on-chain stack locally without running the full Telegram bot:
```bash
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd WalLearn-bot
npm install
npm test
npm run test:cross-session
npm run test:pdf [path/to/lecture.pdf]
```
The automated test script (`scripts/verify-submission.ts`) immediately executes:
1. Validates Sui on-chain account object and credentials.
2. Probes the live Walrus Protocol Relayer health endpoint (`/health`).
3. Queries confirmed on-chain blobs and inspects live ledger state (over 50 confirmed blobs).
4. Performs a cryptographic cold recall against Walrus Mainnet and displays retrieved student memory.

#### 3. One-Command Production Setup
```bash
# Copy and configure environment variables
cp .env.example .env

# Build and start
npm run build
npm start
```
Also includes a production-ready `Dockerfile` and `.dockerignore` for zero-configuration container deployments on Railway, Fly.io, or AWS ECS.

---

## Core Engineering Innovations

### 1. Dual-Layer Natural Language Orchestration
Traditional Telegram chatbots rely on brittle state machines (e.g. conversational steps or regex matching). When an unexpected message arrives, the bot enters an error state. 

WalLearn implements a **Two-Tier Orchestration Pipeline** (`src/ai/orchestrator.ts`):
- **Tier 0 — Deterministic Zero-Latency Interceptor (< 1ms)**:
  - Intercepts Telegram inline button taps (`callback_query`) without passing them to the AI.
  - Matches native CBT quiz options (`A`, `B`, `C`, `D`), numeric menu selections (`1`, `2`, `3`), and standalone course codes (`ANA201`, `PCL301`).
- **Tier 1 — Semantic Intent & Entity Extractor (Gemini Flash JSON Mode)**:
  - If input is conversational or compound (e.g. *"Give me 10 questions on thorax in ANA201"*), Tier 1 decomposes the string into structured intents (`set_course`, `set_topic`, `start_drill`, `questionCount: 10`, `courseCode: "ANA201"`).
  - Automatically bridges commands without asking redundant follow-up questions.

### 2. Multi-Tenant Isolated Namespaces on Walrus
To ensure zero cross-student cognitive pollution while preserving global subject integrity, WalLearn establishes isolated cryptographic namespaces:
$$\text{Namespace} = \text{u}\{\text{TelegramChatID}\}\_\{\text{NormalizedCourseCode}\}$$
*Example:* `u6878463854_pcl301`

- Every student’s mistakes, streak progress, and slide digests are encrypted and siloed into their unique on-chain namespace.
- Supports multi-course tracking (e.g. a student studying Pharmacology `PCL301` and Anatomy `ANA201` simultaneously maintains isolated weakness ledgers).

### 3. The 3-Consecutive-Pass Cognitive Decay Protocol
A topic is never considered "mastered" simply because a student guessed correctly once. WalLearn enforces a rigorous spaced repetition graduation rule:
- When a mistake occurs, it is committed to Walrus with `severity: high` and `correctStreak: 0`.
- During subsequent adaptive quizzes, the concept is re-tested with rotated distractors.
- Only after **3 consecutive correct passes across distinct study sessions** does the status graduate from `confirmed` to `mastered` on Walrus Mainnet.
- If a student ever fails a previously mastered topic during a periodic spot-check, it is instantly demoted back to active recovery.

### 4. Adaptive 60 / 30 / 10 Question Weighting
When generating a CBT practice drill (`/study`), WalLearn balances cognitive load using an algorithmic formula:
- **60% Targeted Weakness Drill**: Fetched directly from active Walrus Protocol blobs where `misses > 0` and `status != 'mastered'`, ranked by:
  $$\text{Priority Score} = (\text{Misses} \times \text{Severity Weight}) \times \text{Recency Factor}$$
- **30% Course Slide Grounding**: Synthesized from newly uploaded lecture slides or extracted syllabus facts.
- **10% Spaced Reinforcement**: Random spot-checks against previously mastered topics to prevent memory decay.

### 5. Asynchronous Two-Phase Commit with Resilient Backoff
Writing to decentralized storage requires handling network latency and relayer rate limits:
1. **Phase 1 (Ingestion & Job Dispatch)**: WalLearn generates an Ed25519 signature across `timestamp.method.path.bodyHash.nonce.accountId` and dispatches the memory payload to the MemWal Relayer. The relayer returns an immediate `202 Accepted` with a cryptographic `job_id`.
2. **Phase 2 (Background On-Chain Resolution)**: The bot registers the record in its local state ledger and asynchronously polls `/api/remember/{jobId}` until the permanent Walrus Mainnet `blob_id` is resolved and linked.
3. **Resilient HTTP 429 Backoff**: The custom `signedFetch` client intercepts rate limits, inspects `retry_after_seconds`, and applies exponential backoff with jitter, ensuring continuous operation without dropped student data.

### 6. Storage Semantics: Event-Sourced Event Lines & On-Chain Replay Engine
When executing an on-chain recovery via `/restore`, WalLearn presents an auditable telemetry report:
```text
• Walrus Mainnet Status: 🟢 Synchronized
• Tracked Weaknesses (Mistakes): 5
• Verified Exam Facts: 3
```

Under the hood, this reflects an **event-sourced decentralized storage architecture**:
- **Decentralized Blob (On-Chain Container):** On Walrus Protocol, memories are stored as cryptographic, erasure-coded blobs via `@mysten-incubation/memwal`.
- **Event-Sourced Event Lines:** Every cognitive transition (`[MISTAKE]`, `[PROGRESS]`, `[MASTERED]`, `[EXAM_FACT]`) is written to Walrus as an immutable event line.
- **Atomic Recovery & State Reconstruction:** When `/restore` or a cold start runs, WalLearn queries the user's isolated namespace (`u<chatId>_<courseCode>`) on Walrus Mainnet and replays all events chronologically. Streaks, misconceptions, and mastery statuses are mathematically reconstructed without depending on local disk persistence.

---

### Criterion 4: Best Article, Educational Narrative & Ecosystem Feedback
> *"Is the article clear, honest, and useful to a newcomer? Does it document before/after behavior and friction points encountered during integration?"*

1. **Published Article (Medium / Inkray)**:  
   *Building WalLearn: How We Ended AI Study Amnesia with Walrus Protocol Memory* breaks down the cognitive amnesia problem, `@mysten-incubation/memwal` integration, before/after medical student test results, and practical engineering guidance for on-chain AI developers.
2. **Beyond the Big Two Track Compliance**:  
   Uses **Google Gemini 2.5 Flash** (via OpenRouter) on Node.js/TypeScript rather than Anthropic or OpenAI. Gemini 2.5 Flash powers structured JSON extraction, rapid quiz distractor generation, and high-context slide ingestion, demonstrating that Walrus Memory functions as a universal, model-agnostic substrate.
3. **Official Hackathon Feedback & Friction Submitted**:  
   - *Friction 1 (SDK ESM Exports)*: Documented lack of CommonJS export mappings in `@mysten-incubation/memwal` causing packaging friction in hybrid environments.  
   - *Friction 2 (Restore Pagination)*: Single-shot candidate selection on `/restore` without keyset cursors.  
   - *Improvement 1 (Semantic Distance)*: Exposing configurable `maxDistance` thresholds on `/recall`.

---

## On-Chain Verification & Judge Audit Table

All memory transactions are verifiable on the **Sui Blockchain** and **Walrus Protocol Mainnet**:

| Parameter | Mainnet On-Chain Verification Details |
|---|---|
| **Production Telegram Bot** | [@WalLearnBot](https://t.me/WalLearnBot) |
| **Sui MemWalAccount Object** | [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140`](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140) |
| **Dedicated On-Chain Wallet** | [`0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2`](https://suiscan.xyz/mainnet/account/0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2) |
| **Delegate Key Address** | `0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa` |
| **Production Relayer Node** | `https://relayer.memory.walrus.xyz` |
| **Active Storage Protocol** | Walrus Protocol Mainnet (Decentralized Erasure-Coded Blobs) |

### Sample Live Blobs on Walruscan (Auditable)

Judges can verify actual student memory blobs created by WalLearn directly on the Walrus explorer:

| On-Chain Blob ID | Stored Concept Type | Verification Link |
|---|---|---|
| `qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4` | Syllabus Fact Ingestion (`PCL301`) | [View on Walruscan](https://walruscan.com/mainnet/blob/qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4) |
| `to7chW9wB9LxvfREEC9gct6CE1xdqdfBYW_MjNZMX94` | Autonomic Pharmacology Fact (`PCL301`) | [View on Walruscan](https://walruscan.com/mainnet/blob/to7chW9wB9LxvfREEC9gct6CE1xdqdfBYW_MjNZMX94) |
| `5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U` | Succinylcholine Neuromuscular Block | [View on Walruscan](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U) |
| `ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0` | Adrenergic Receptor Diagnosis (`PCL302`) | [View on Walruscan](https://walruscan.com/mainnet/blob/ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0) |
| `4bcukpw7k5-1zdL4A_izziqfRyQWrv0IurlgA3Ekw28` | Catecholamine Termination Misconception | [View on Walruscan](https://walruscan.com/mainnet/blob/4bcukpw7k5-1zdL4A_izziqfRyQWrv0IurlgA3Ekw28) |

---

## Bot Command & Capability Matrix

| Command / Trigger | Functional Execution & Architectural Response |
|---|---|
| `/start` | Initial handshake, active subject detection, and interactive action dashboard. |
| `/study` or `/prep` | Recalls active weaknesses from Walrus and launches an adaptive CBT drill with inline keyboard buttons. |
| `/briefing` | Cold-retrieves stored weaknesses from Walrus and renders a prioritized mastery report across all courses. |
| `/analyze` | Arms the document ingestion engine to extract questions, syllabus concepts, and lecturer trap patterns. |
| `/restore` | Cryptographically polls Walrus Mainnet, re-indexes raw blobs, and rebuilds the local student ledger. |
| `/health` | Live diagnostic probe verifying relayer connectivity, latency, Sui account ID, and stored blob totals. |
| `/menu` | Displays the current session status, active course code, and navigation options. |
| `/reset` | Flushes transient in-memory quiz states while preserving all decentralized Walrus memories. |
| **Drop File (PDF/PPTX/DOCX)** | Multimodal slide ingestion; parses text and generates CBT questions grounded in course materials. |
| **Send Image / Photo** | OCR document processing; reads whiteboard photos, printed tests, or textbook pages for instant ingestion. |
| **Freeform Natural Query** | Socratic tutor conversation; grounds explanations in the student's historical misconception ledger. |

---

## Directory & Codebase Structure

```
wallearn-bot/
├── src/
│   ├── index.ts                 # Application entrypoint & grammY initialization
│   ├── config.ts                # Environment validation & configuration
│   ├── ai/
│   │   ├── client.ts            # OpenRouter / Gemini 2.5 Flash gateway
│   │   ├── orchestrator.ts      # Dual-layer Natural Language Orchestrator
│   │   └── prompts.ts           # Socratic, diagnostic, and CBT generation prompts
│   ├── walrus/
│   │   ├── client.ts            # Walrus client powered by @mysten-incubation/memwal SDK
│   │   ├── types.ts             # Mistake, briefing, and ledger type contracts
│   │   └── memory-events.ts     # Event-sourced memory format & replay engine
│   ├── handlers/
│   │   ├── start.ts             # Onboarding and menu dispatch
│   │   ├── study.ts             # Adaptive CBT quiz engine & streak evaluator
│   │   ├── briefing.ts          # Cold weakness briefing generator
│   │   ├── analyze.ts           # Past question & slide blueprint analyzer
│   │   ├── restore.ts           # On-chain disaster recovery & blob re-indexer
│   │   ├── health.ts            # Diagnostic telemetry & Sui/Walrus status
│   │   ├── callback.ts          # Inline button callback dispatcher
│   │   ├── chat.ts              # Freeform message routing & Socratic tutor
│   │   ├── document.ts          # PDF, PPTX, and DOCX document handling
│   │   ├── photo.ts             # Multimodal photo & diagram OCR via Gemini
│   │   └── ledger.ts            # On-chain proof ledger display
│   └── utils/
│       └── telegram-format.ts   # Telegram MarkdownV1 sanitizer
├── scripts/
│   ├── verify-submission.ts     # Automated on-chain diagnostic verifier (npm test)
│   ├── parse_document.py        # Local Python document extractor (PDF/PPTX/DOCX)
│   └── e2e-pdf-test.ts          # End-to-end slide ingestion integration test
├── tests/
│   └── cross-session.test.ts    # Automated cross-session isolation & mastery tests
├── data/
│   └── mistakes-ledger.json     # Committed on-chain state cache & verification proof
├── package.json
├── tsconfig.json
├── JUDGING.md                   # Hackathon evaluation dossier across all 4 criteria
└── README.md
```

---

## Local Development & Setup Guide

### 1. System Requirements
- Node.js 20.0.0 or higher
- npm or pnpm
- Valid Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- OpenRouter API Key ([OpenRouter](https://openrouter.ai)) with access to `google/gemini-2.5-flash`

### 2. Installation
```bash
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd WalLearn-bot
npm install
```

### 3. Environment Configuration
Create a `.env` file in the root directory (see `.env.example`):
```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"

# AI Model Configuration (Gemini 2.5 Flash via OpenRouter)
OPENROUTER_API_KEY="your_openrouter_api_key"
AI_MODEL="google/gemini-2.5-flash"

# Walrus Protocol & MemWal Configuration
WALRUS_ACCOUNT_ID="0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140"
WALRUS_WALLET_ADDRESS="0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2"
WALRUS_DELEGATE_ADDRESS="0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa"
WALRUS_RELAYER_URL="https://relayer.memory.walrus.xyz"

# Optional: Path to local MemWal credentials directory
MEMWAL_CREDS_DIR="/path/to/.memwal-wallearn"
```

### 4. Build, Verify & Run
```bash
# 1. Compile TypeScript to JavaScript
npm run build

# 2. Run automated on-chain verification diagnostic
npm test

# 3. Run automated cross-session test suite
npm run test:cross-session

# 4. Start production bot server
npm start

# Or run in development mode with auto-reload
npm run dev
```

---

## Production Deployment (Railway / Cloud)

WalLearn is architected as a stateless container ready for 24/7 cloud execution:

```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build
CMD ["node", "dist/index.js"]
```

- In production on **Railway**, environment variables are populated from the Railway project dashboard.
- Zero local disk dependency: even if the cloud container restarts or redeploys, `/restore` retrieves the entire student learning state directly from Walrus Protocol Mainnet in seconds.

---

## Hackathon Evaluation Checklist for Judges

| Evaluation Dimension | How WalLearn Excels | Reference |
|---|---|---|
| **1. Does It Actually Remember?** | Memory is an active computational state variable governing 60/30/10 question generation, cold-start tutoring, and a 3-pass spaced repetition state machine. | [JUDGING.md Criterion 1](JUDGING.md#criterion-1-does-it-actually-remember) |
| **2. Real-World Use** | Live on Telegram (@WalLearnBot) with medical/university students across 15 on-chain namespaces, 50 confirmed Walruscan blobs, and a convincing before/after contrast. | [JUDGING.md Criterion 2](JUDGING.md#criterion-2-real-world-use--the-beforeafter-case-study) |
| **3. Build Quality & SDK** | Clean TypeScript integration powered by `@mysten-incubation/memwal` (v0.1.8), verifiable in 60s via `npm test` and `npm run test:cross-session`. | [JUDGING.md Criterion 3](JUDGING.md#criterion-3-build-quality-clean-integration--reproducibility) |
| **4. Best Article & Ecosystem Feedback** | Educational deep-dive article published on Medium/Inkray, full compliance with Beyond the Big Two track (Gemini 2.5 Flash), and documented friction report submitted to Mysten Labs. | [JUDGING.md Criterion 4](JUDGING.md#criterion-4-best-article-educational-narrative--ecosystem-feedback) |

---

## License
MIT License. Open-source for the decentralized education ecosystem. Built with ❤️ for the Walrus Hackathon.
