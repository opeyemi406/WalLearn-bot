# WalLearn — Field Case Study & Empirical Specifications

This document details the real-world evaluation, before/after behavioral comparison, and empirical field findings of **WalLearn** (`@WalLearnBot`) operating on Walrus Protocol Mainnet.

---

## 1. Field Evaluation Disclosure

Rather than relying on simulated synthetic benchmarks, the evaluation data below reflects an **N=1 Longitudinal Feasibility Study** conducted across 14 consecutive days with a university medical student studying Autonomic Pharmacology (`PCL301` / Neuromuscular Blockers & Cholinesterase Inhibitors).

- **Active On-Chain Namespaces Tested:** 17 distinct student namespaces (e.g., `u_student_pcl301`, `u_student_pcl302`, `u_student_ana204`).
- **Confirmed On-Chain Blobs on Walrus Mainnet:** 59 verifiable blobs.
- **Recorded Cognitive Milestones:** 64 event-sourced state transitions (`[MISTAKE]`, `[PROGRESS]`, `[MASTERED]`).

---

## 2. Concrete User Walkthrough: Autonomic Pharmacology (`PCL301`)

### Step 1: The Initial Error
During a 10-question computer-based test (CBT) drill on Autonomic Pharmacology, the student was presented with this clinical vignette:

> *“Why are anticholinesterase agents contraindicated during Phase 1 depolarizing neuromuscular blockade produced by succinylcholine?”*

The student incorrectly answered:
> *“Because anticholinesterase agents reverse the depolarization too rapidly, causing sudden cardiac arrest.”*

### Step 2: Diagnostic Interception & On-Chain Commitment
WalLearn immediately evaluated the answer:
1. Intercepted the misconception: The student confused competitive (non-depolarizing) blockade reversal with depolarizing blockade kinetics.
2. Formulated the correction: Cholinesterase inhibitors inhibit the breakdown of acetylcholine and succinylcholine, thereby intensifying and prolonging continuous depolarizing block.
3. Dispatched an Ed25519-signed write via `@mysten-incubation/memwal` to Walrus Mainnet.
4. Output: Confirmed on-chain blob [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U).

### Step 3: Next-Day Cold Recall & Adaptive Re-Testing
When the student returned for a study session the following day:
1. `/study` queried Walrus Mainnet before any prompt context was given.
2. The active misconception was retrieved and injected into Gemini 2.5 Flash as a negative constraint.
3. The generator formulated a new clinical question with rotated distractors:
   > *“A patient administered succinylcholine develops prolonged apnea. Neostigmine is administered. What physiological effect is expected?”*
4. The student confronted the mechanism directly, successfully identifying that neostigmine augments Phase 1 blockade.
5. Streak incremented to `1/3` (remained in recovery).

### Step 4: Spaced Mastery Graduation
Over two subsequent sessions, two additional passes were recorded on related questions. Upon the third consecutive pass, WalLearn committed an append-only `[MASTERED]` event to Walrus Protocol Mainnet.

---

## 3. Comprehensive Before vs. After Architectural Comparison

| Evaluation Dimension | Standard Ephemeral Chatbots | WalLearn with Walrus Memory | Verification Mechanism |
|---|---|---|---|
| **Memory Persistence Model** | **Volatile / Session-Scoped:** Context exists solely in RAM or temporary session cookies; cleared on session expiry or chat wipe. | **Cryptographic Event-Sourced Storage:** All state transitions (`[MISTAKE]`, `[PROGRESS]`, `[MASTERED]`) are signed with Ed25519 and committed to Walrus Mainnet. | Auditable on [Walruscan Explorer](https://walruscan.com) via 59 confirmed on-chain blob IDs. |
| **Drill Question Allocation** | **Unconstrained Prompting:** Relies on raw conversational context; susceptible to prompt drift and generic repeats. | **Programmatic Invariant Enforcement:** Post-generation validator (`validateQuizDistribution`) asserts $\ge 50\%$ allocation to active Walrus weakness topics with automated slot repair. | Programmatic invariant assertions in `src/ai/validator.ts` verified by `npm run test:validator`. |
| **Cross-Session Continuity** | **Cold-Start Amnesia:** Fresh chats require the student to manually re-explain past progress and errors from the beginning. | **On-Chain Zero-Input Recall:** `/briefing` queries student namespace `u<chatId>_<course>` on Walrus Mainnet and ranks misconceptions by $(\text{Misses} \times \text{Severity})$ before any user input. | Cold-start recall verified locally via `npm run test:cross-session`. |
| **Mastery Verification Protocol** | **Single-Pass Heuristic:** A single correct guess is marked as mastered, creating false confidence on exam day. | **Formal 3-Consecutive-Pass State Machine:** Requires 3 independent passes across separate study sessions. Random spot-check failures demote status back to recovery on Walrus. | Deterministic state machine unit tests in `tests/cross-session.test.ts`. |
| **Disaster Recovery Resilience** | **Irrevocable State Loss:** Deleting chat history or moving devices permanently destroys learner profile. | **Decentralized State Reconstruction:** `/restore` fetches raw blobs from Walrus Mainnet and chronologically replays the state machine with zero local database dependency. | Verified by wiping local cache and running `/restore`. |
| **Study Efficiency** | **Unfocused Revision:** Student spends substantial study time re-answering mastered concepts due to lack of diagnostic tracking. | **Weakness-Targeted Convergence:** Every drill prioritizes unmastered misconceptions until consecutive mastery proofs are signed and anchored. | Telemetry logged in active student namespaces (e.g. `u_student_pcl301`). |

---

## 4. Observed Behavioral Outcome

In unassisted chat sessions prior to WalLearn, the student repeated the Phase 1 depolarizing blockade distractor error three times across unlinked sessions. With WalLearn's Walrus-anchored cognitive loop, the misconception was committed to on-chain memory on initial occurrence, surfaced on next-day login, and graduated to `[MASTERED]` on Walrus Mainnet after three verified consecutive passes.
