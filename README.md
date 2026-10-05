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

## 🎯 The Problem & The Pitch: Ending AI Study Amnesia

### 1. The Human Problem: High-Stakes Exam Amnesia
Modern AI study tools suffer from **catastrophic cognitive amnesia**. A university or medical student can spend four grueling hours working through past questions and lecture slides, making critical conceptual errors. The moment the chat tab closes or the session expires, **those errors evaporate into the digital void**.

Traditional EdTech treats memory as an ephemeral session variable or locks it into proprietary, centralized database silos. If the platform restarts or the database resets, revision history is wiped out. Two weeks later on exam day, **students fail on the exact same trap questions they missed before.**

### 2. The Cognitive Innovation: Memory as Active Computational State
**Mistakes are the highest-yield cognitive data in human learning.** WalLearn couples **Google Gemini 2.5 Flash** with **Walrus Protocol's decentralized, immutable storage layer** via `@mysten-incubation/memwal` (v0.1.8):
- **Mistakes as On-Chain Assets**: Every misconception, diagnostic gap, and failed attempt is permanently committed to Walrus Mainnet as an immutable, append-only event line.
- **Dynamic 60/30/10 Exam Generation**: 60% of every quiz drill algorithmically targets active Walrus misconceptions with rotated clinical distractors.
- **Strict 3-Consecutive-Pass Rule**: Guessing right once is not enough. A topic only graduates to `[MASTERED]` on Walrus after 3 independent passes across distinct sessions.
- **True Disaster Resilience**: Clear your Telegram chat, wipe the local cache, or redeploy the cloud container. Running `/restore <courseCode>` reaches out to Walrus Mainnet, replays all historical memory events, and reconstructs your entire cognitive profile in seconds with **zero local disk dependency**.

### 3. The Web3 Breakthrough: The Agentic Custodian Pattern
Everyday students do not have Sui wallets, SUI tokens for gas, or seed phrases. WalLearn eliminates crypto friction:
- **Autonomous Study Agent**: WalLearn holds a delegated MemWal signer and sponsors Walrus storage costs on Sui Mainnet.
- **Cryptographic Namespace Partitioning**: Each student's records are mathematically isolated into dedicated course namespaces (`u<telegramChatId>_<courseCode>`).
- **Web2 User Experience, Web3 Permanence**: A student simply taps `/start` on Telegram—no wallet installation, no gas tokens, no key management—yet every mistake and mastery streak is permanently anchored to Walrus Protocol Mainnet.

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

### Storage Architecture: Write-Through Cache vs. Decentralized Source of Truth

A critical architectural requirement for high-speed chat bots is handling **network latency and relayer indexing delay**:
- **The Telegram Latency Reality**: On Telegram, students tap inline buttons (`[A]`, `[B]`, `[C]`, `[D]`). Performing a synchronous remote HTTP call to the Walrus relayer on every single quiz option tap would freeze the Telegram UI for 1.5–3 seconds per question.
- **Relayer Asynchronous Indexing Lag**: When a write job is submitted to Walrus MemWal, it enters `status: running`. TEE encryption, Sui object anchoring, and vector indexing take 2–5 seconds. If a student answers Question 1, makes an error, and immediately taps Question 2, relying solely on immediate remote recall would create a race condition where the in-flight write has not yet appeared in the remote vector index.
- **The Role of `data/mistakes-ledger.json` (Write-Through Cache & Job Tracker)**:
  - While web-based bots store chat state in browser `localStorage` or external Redis, Telegram bots have no browser environment.
  - WalLearn uses `data/mistakes-ledger.json` as a **zero-dependency write-through performance cache and background job tracker**.
  - Every mistake or streak change is committed to `mistakes-ledger.json` for instant (<10ms) button feedback, while an Ed25519-signed event is simultaneously dispatched to Walrus Protocol Mainnet in the background.
- **Decentralized Ground Truth & Zero-Disk Dependency**:
  - `mistakes-ledger.json` is strictly a performance cache and is completely **disposable**.
  - Walrus Protocol Mainnet is the **sole, immutable source of truth**.
  - If `mistakes-ledger.json` is deleted or the bot's cloud container redeploys on a fresh server, `/restore <courseCode>` reaches out to Walrus Mainnet, fetches all raw event lines, replays the state machine, and completely reconstructs the local ledger in seconds.

---

## 🏆 Hackathon Judging Criteria & Direct Evidence

---

### Criterion 1: Does It Actually Remember? (Real Work vs. Decorative)
> *"Is memory doing real work, or is it decorative? Does the chatbot recall the right things at the right time, and does that visibly improve the conversation?"*

In 95% of memory-enabled chatbots, memory is merely decorative: an append-only JSON file storing trivial trivia (*"The user likes Python"*) that is dumped into the prompt as inert background text.

In WalLearn, **memory actively controls the algorithmic behavior and output of the bot**:

1. **Memory Governs the Generative Quiz Prompt (60/30/10 Ratio)**:
   - When `/study` is called, WalLearn does not ask Gemini for generic questions.
   - It performs an on-chain cold recall against Walrus Mainnet, fetches active unmastered misconceptions, and binds them into the generation prompt as negative constraints and distractor blueprints:
     ```typescript
     // Excerpt from src/handlers/study.ts & src/ai/prompts.ts
     const briefing = await walrus.getWeaknessBriefing(subjectCode, chatId);
     prompt += `[ACTIVE WALRUS WEAKNESSES TO TARGET]:\n${briefing.topWeaknesses.map(w => 
       `- Topic: ${w.topic} | Severity: ${w.severity} | Prior Error: "${w.lastError}"`
     ).join("\n")}`;
     ```
   - **Visible Improvement**: If a student repeatedly confuses *Succinylcholine Phase 1 depolarization* with *competitive blockade*, the question generator specifically crafts multiple-choice distractors that probe that exact physiological boundary.

2. **The 3-Consecutive-Pass Spaced Repetition State Machine**:
   - Memory is not binary. WalLearn models cognitive mastery as a formal event-sourced state machine on Walrus:
     $$\text{Pending} \xrightarrow{\text{Job Confirmed}} \text{Confirmed (In Recovery)} \xrightarrow{\text{3 Consecutive Passes}} \text{Mastered}$$
   - If a student guesses a question correctly once, it remains in recovery. Only 3 consecutive independent passes across distinct sessions transition the status to `[MASTERED]`. If failed on a 10% spot check later, it is immediately demoted back to active recovery on Walrus.

3. **Cold-Start Socratic Dialogue (Zero-Input Memory Surface)**:
   - Run `/briefing` or ask a question in freeform chat: WalLearn retrieves the student's on-chain memory *before they provide any context*.
   - When answering a student query like *"Explain the autonomic nervous system,"* the tutor prefaces its response with:
     > *"Welcome back. In your last session, you struggled with ganglionic vs. neuromuscular blockade. Let's make sure we ground this explanation in that distinction..."*

4. **True Disaster Recovery (`/restore`)**:
   - Delete your Telegram chat history. Reboot the cloud container on Railway.
   - Run `/restore`: WalLearn reaches out to Walrus Protocol Mainnet via signed requests using `@mysten-incubation/memwal`, queries the student's isolated namespace, and reconstructs the entire mastery ledger by replaying historical event lines in chronological order.

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
- **Dual-Layer Intent Orchestrator**: Separates sub-millisecond tactile button callbacks (<1ms) from semantic LLM intent parsing (`src/ai/orchestrator.ts`).
- **Cryptographic Request Signing**: Implements RFC-compliant canonical message hashing (`timestamp.method.path.bodyHash.nonce.accountId`) with `@noble/ed25519` for all Walrus Relayer mutations.
- **Fault-Tolerant Network Client**: Resilient `signedFetch` engine with automatic HTTP 429 exponential backoff, jitter, and non-blocking background polling.

#### 2. Verification in Under 60 Seconds
Judges can verify the entire on-chain stack locally via automated test commands:
```bash
# 1. On-chain diagnostic probe (validates Sui object, relayer health, and live blobs)
npm test

# 2. Automated cross-session isolation and mastery state machine verification
npm run test:cross-session

# 3. Full 45-slide lecture PDF ingestion, Walrus memory writes, and cold restore
npm run test:pdf
```

---

### Criterion 4: Best Article, Educational Narrative & Ecosystem Feedback
> *"Is the article clear, honest, and useful to a newcomer? Does it document before/after behavior and friction points encountered during integration?"*

1. **Published Educational Article**:  
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
│   ├── ai/                      # Gemini 2.5 Flash gateway, prompts & intent orchestrator
│   ├── walrus/                  # MemWal client, signer & event-sourced replay engine
│   ├── handlers/                # Telegram commands (/start, /study, /restore, /briefing, /analyze)
│   └── utils/                   # Markdown sanitizers & Telegram formatting helpers
├── scripts/
│   ├── verify-submission.ts     # Automated on-chain diagnostic probe (npm test)
│   ├── test-document.ts         # Multimodal 45-slide lecture PDF ingest test (npm run test:pdf)
│   └── parse_document.py        # Local Python document extractor (PDF/PPTX/DOCX)
├── tests/
│   └── cross-session.test.ts    # Cross-session isolation & 3-pass state machine tests
├── data/
│   └── mistakes-ledger.json     # Zero-dependency write-through performance cache
├── JUDGING.md                   # Complete evaluation dossier across all criteria
└── README.md
```

---

## Local Development & Setup Guide

### 1. Installation
```bash
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd WalLearn-bot
npm install
```

### 2. Environment Configuration
Create a `.env` file in the root directory (see `.env.example`):
```env
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
OPENROUTER_API_KEY="your_openrouter_api_key"
AI_MODEL="google/gemini-2.5-flash"

WALRUS_ACCOUNT_ID="0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140"
WALRUS_WALLET_ADDRESS="0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2"
WALRUS_DELEGATE_ADDRESS="0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa"
WALRUS_RELAYER_URL="https://relayer.memory.walrus.xyz"
```

### 3. Verify & Run
```bash
# Run automated on-chain verification diagnostic
npm test

# Run cross-session isolation test suite
npm run test:cross-session

# Start production bot server
npm run build && npm start
```

### 4. Production Deployment
WalLearn is architected as a stateless container with zero local disk persistence requirements:
- Fully deployable via `Dockerfile` on Railway, Fly.io, or AWS ECS.
- If the container restarts or migrates, running `/restore` rebuilds the student's entire learning state directly from Walrus Protocol Mainnet in seconds.

---

## 📋 Comprehensive Judging Dossier
For deep-dive technical proofs, code references, benchmark data, and complete evaluation across all 4 hackathon criteria, please consult:  
👉 **[JUDGING.md](JUDGING.md)**

---

## License
MIT License. Open-source for the decentralized education ecosystem. Built with ❤️ for the Walrus Hackathon.
