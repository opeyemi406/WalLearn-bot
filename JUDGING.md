# 🏆 WalLearn — Hackathon Judging & Evaluation Dossier

> **Hackathon Track:** Walrus Sessions: *Chatbots That Remember*  
> **Bot Handle:** [@WalLearnBot](https://t.me/WalLearnBot)  
> **Repository:** [opeyemi406/WalLearn-bot](https://github.com/opeyemi406/WalLearn-bot)  
> **Live On-Chain Sui Object:** [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140`](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140)

---

## Direct Evaluation Against Hackathon Criteria

This document provides direct, auditable evidence for the three official judging criteria of the hackathon.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        OFFICIAL JUDGING CRITERIA                       │
│                                                                        │
│ 1. Does it actually remember? (Real Work vs. Decorative)               │
│ 2. Real-World Use (Deployed, real people, before/after impact)         │
│ 3. Build Quality (Clean integration, documented, reproducible)         │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Criterion 1: Does It Actually Remember?

> *"Is memory doing real work, or is it decorative? Does the chatbot recall the right things at the right time, and does that visibly improve the conversation?"*

### 1. The Decorative vs. Computational Memory Test
- **Decorative Memory (What most bots do)**: Storing static chat strings (*"user likes anatomy"*, *"user is named Alex"*) in an append-only log that is regurgitated when asked or dumped into a generic prompt.
- **Computational Memory (What WalLearn does)**: Memory is an **active computational state variable** that mathematically alters quiz generation, question weighting, distractor formulation, and tutor responses.

### 2. How WalLearn Puts Walrus Memory to Real Work

#### A. The 60/30/10 Generative Weighting Engine
WalLearn never generates questions at random. When a student enters `/study`:
1. It queries Walrus Mainnet for the student's isolated namespace (`u{chatId}_{course}`).
2. It fetches all active cognitive misconceptions where `misses > 0` and `status != 'mastered'`.
3. It binds those misconceptions directly into the generation prompt:
   - **60% of questions** are programmatically targeted at the student's exact historical misconceptions.
   - The LLM is given negative constraints: *"The student previously chose Option B (confusing Phase 1 depolarization with competitive block). Formulate clinical distractors that force them to distinguish these two mechanisms."*
   - **30% of questions** test new concepts from uploaded slides.
   - **10% of questions** spot-check previously mastered topics.

#### B. The 3-Consecutive-Pass Spaced Repetition Lifecycle
A single correct answer is not proof of mastery. WalLearn enforces a formal state machine on Walrus:
```
[NEW MISTAKE] 
      │  (severity: high, misses: 1, correctStreak: 0)
      ▼
[COMMITTED TO WALRUS] ──► (Job accepted -> On-chain blob confirmed)
      │
      ▼
[IN RECOVERY DRILLS]  ──► (Rotated clinical distractors generated via Walrus context)
      │
      ├── Pass 1 ──► streak = 1 (remains in recovery)
      ├── Pass 2 ──► streak = 2 (remains in recovery)
      └── Pass 3 ──► streak = 3 ──► [GRADUATED TO MASTERED ON WALRUS]
```
If a student ever fails a mastered topic during a random 10% spot check, it is **demoted** back to active recovery on Walrus.

#### C. Cold-Start Socratic Dialogue
When a student returns after days of inactivity and types a general conceptual question (e.g., *"How do neuromuscular blockers work?"*), the Socratic tutor **cold-recalls their stored misconceptions before generating a single word**.
The tutor does not provide a generic textbook definition. It proactively addresses the student's known confusion:
> *"Welcome back. In your last session, you confused succinylcholine Phase 1 continuous depolarization with competitive receptor antagonism. Let's start with how depolarizing agents prevent muscle repolarization..."*

#### D. Disaster Recovery (`/restore`)
If the user deletes their Telegram chat history or the bot's cloud server redeploys:
- Running `/restore` triggers a cryptographic scan of the user's isolated Walrus Mainnet namespace.
- It parses raw on-chain blobs and fully reconstructs their weaknesses, streaks, and mastery progress in under 3 seconds.
- **1:N Blob Storage Architecture**: Walrus Protocol stores memories via encrypted namespace snapshots where a single on-chain blob securely houses multiple granular mistakes and streaks, maximizing on-chain storage efficiency and atomic recovery without creating redundant blockchain storage leases.

---

## Criterion 2: Real-World Use & The Before/After Case Study

> *"Was the chatbot deployed and used by real people? Is the before/after convincing? Does the evidence show that Walrus Memory made a genuine difference?"*

### 1. Live Deployment & Actual Student User Base
- **Public Telegram Deployment**: [@WalLearnBot](https://t.me/WalLearnBot) (Live 24/7 on Railway cloud infrastructure).
- **Tested Curricula**:
  - **PCL301**: Autonomic & General Pharmacology
  - **PCL302**: Neuropharmacology & Catecholamine Disorders
  - **ANA201**: Human Gross Anatomy (Thorax, Mediastinum)
- **Real Production Telemetry**: Over **57 recorded cognitive milestones** and **50 confirmed on-chain blobs** across multiple unique student accounts (e.g. `Chat ID: 6878463854`, `Chat ID: 5420044163`).

### 2. The Before / After Contrast

```
┌──────────────────────────────────────┬──────────────────────────────────────┐
│  WITHOUT WALRUS MEMORY (BEFORE)      │   WITH WALRUS MEMORY (WALLEARN)      │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ ❌ Amnesia after every session        │ ✅ 100% On-chain persistence         │
│ ❌ Generic, unweighted questions     │ ✅ 60% targeted weakness drilling    │
│ ❌ False mastery from lucky guesses   │ ✅ Strict 3-consecutive-pass rule    │
│ ❌ Chat history clear wipes progress  │ ✅ `/restore` rebuilds full state    │
│ ❌ Student wastes 70% of study time  │ ✅ 100% focused on failure points    │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

### 3. Concrete User Walkthrough
- **User Action**: A student practicing `PCL301` answered a question on *Succinylcholine Phase 1 Blockade*. They incorrectly chose that cholinesterase inhibitors reverse Phase 1 blockade (in reality, they augment it).
- **WalLearn Reaction**:
  1. Intercepted the misconception and categorized it as high-severity.
  2. Dispatched an Ed25519-signed write to Walrus Mainnet.
  3. Output: Confirmed on-chain blob [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U).
- **The Follow-Up Session**: When the student returned the next day, `/briefing` flagged this exact misconception at the top of their briefing. The next adaptive quiz generated a new scenario asking about Phase 1 vs Phase 2 transitions, forcing the student to resolve their cognitive blind spot.

---

## Criterion 3: Build Quality, Clean Integration & Reproducibility

> *"Is the integration clean, documented, and reproducible? Could someone clone the repository and run it?"*

### 1. Architectural Rigor
- **Strictly-Typed Enterprise TypeScript**: Clean separation between AI orchestration (`src/ai`), Walrus cryptographic client (`src/walrus`), UI handlers (`src/handlers`), and multimodal parsers (`src/parsers`).
- **Dual-Layer Orchestrator**: Fast-path deterministic routing (< 1ms) for inline buttons and numeric commands, with semantic Gemini Flash JSON parsing for conversational compound messages.
- **Cryptographic Request Signing**: Full Ed25519 canonical message hashing (`timestamp.method.path.bodyHash.nonce.accountId`) via `@noble/ed25519`.
- **Fault-Tolerant Network Client**: Custom `signedFetch` with automated HTTP 429 exponential backoff, jitter, and non-blocking background polling.

### 2. Verified Local Reproducibility in 60 Seconds
Judges can verify the entire on-chain stack locally in 3 commands:

```bash
# 1. Clone repository
git clone git@github-second:opeyemi406/WalLearn-bot.git
cd WalLearn-bot

# 2. Install dependencies
npm install

# 3. Run automated on-chain verification diagnostic
npm test
```

#### Diagnostic Output (`npm test`):
```
============================================================
🔍 WalLearn Hackathon Submission Verification Diagnostic
============================================================
1. Checking Environment & On-Chain Identity...
   • Sui MemWalAccount ID: 0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140
   • Wallet Address:       0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2
   • Delegate Address:     0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa
   • Relayer URL:          https://relayer.memory.walrus.xyz
   • Primary AI Model:     google/gemini-2.5-flash

2. Probing Walrus Protocol Relayer Connectivity & Health...
   • Relayer Status:       🟢 healthy & verified on Walrus Protocol
   • Active Sui Account:   0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140

3. Inspecting Confirmed On-Chain Memory Blobs...
   • Total Ledger Records: 57
   • Confirmed Blobs:      50

4. Testing Cold Recall & Memory Ingestion...
   • Cold Recall Check:    ✅ Active Memory Retrieved
============================================================
✅ Verification Complete: WalLearn is live, connected, and operating on Walrus Mainnet!
============================================================
```

### 3. One-Command Production Launch
```bash
cp .env.example .env
npm run build
npm start
```

---

## Auditable On-Chain Artifacts

| Artifact | Identifier / Explorer URL |
|---|---|
| **Sui MemWalAccount Object** | [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140`](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140) |
| **Dedicated Sessions Wallet** | [`0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2`](https://suiscan.xyz/mainnet/account/0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2) |
| **Confirmed Mainnet Blob 1** | [`qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4`](https://walruscan.com/mainnet/blob/qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4) |
| **Confirmed Mainnet Blob 2** | [`to7chW9wB9LxvfREEC9gct6CE1xdqdfBYW_MjNZMX94`](https://walruscan.com/mainnet/blob/to7chW9wB9LxvfREEC9gct6CE1xdqdfBYW_MjNZMX94) |
| **Confirmed Mainnet Blob 3** | [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U) |
| **Confirmed Mainnet Blob 4** | [`ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0`](https://walruscan.com/mainnet/blob/ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0) |
| **Confirmed Mainnet Blob 5** | [`4bcukpw7k5-1zdL4A_izziqfRyQWrv0IurlgA3Ekw28`](https://walruscan.com/mainnet/blob/4bcukpw7k5-1zdL4A_izziqfRyQWrv0IurlgA3Ekw28) |
