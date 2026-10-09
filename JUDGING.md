# 🏆 WalLearn — Hackathon Judging & Audit Dossier

> **Hackathon Track:** Walrus Sessions: *Chatbots That Remember* (DeepSurge)
> **Sub-Track:** Beyond the Big Two (`google/gemini-2.5-flash` via OpenRouter on Node.js/TypeScript)
> **Production Bot:** [@WalLearnBot](https://t.me/WalLearnBot) (Live 24/7 on Railway)
> 🎥 **Demo Video:** [Watch Live Walkthrough on YouTube](https://youtu.be/Fhf1N7epjBc)
> ✍️ **Published Article:** [Read Deep Dive on Medium](https://medium.com/@opeyemi406/building-wallearn-how-we-solved-chatbot-amnesia-for-university-students-using-walrus-memory-0de459ac8b71)
> **Repository:** [opeyemi406/WalLearn-bot](https://github.com/opeyemi406/WalLearn-bot)
> **Reference Deployed Instance:** Sui Object [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140`](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140)

---

## 1. Executive Summary

WalLearn demonstrates that decentralized memory on Walrus Protocol can serve as an **active computational state engine** rather than passive chat trivia:
- **Algorithmic Question Control:** Memory directly controls multiple-choice question generation, enforcing a **60/30/10 ratio** (60% unmastered Walrus weaknesses, 30% new syllabus facts, 10% review).
- **Formal State Machine:** Spaced repetition enforces a **3-consecutive-pass rule** across distinct sessions before graduating a topic to `[MASTERED]` on Walrus. Spot-check failures demote back to recovery.
- **Decentralized Disaster Recovery:** `/restore` queries Walrus Mainnet, fetches raw event lines, and rebuilds learner state with zero local database dependency.

---

## 2. Official Criteria Mapping Matrix

| Criterion | What Judges Look For | WalLearn Implementation | Verifiable Evidence |
|---|---|---|---|
| **1. Does It Actually Remember?** | Real computational work vs. decorative chat logs. | Generative quiz weighting (`src/ai/prompts.ts`), invariant validator (`src/ai/validator.ts`), event-sourced state replay (`src/walrus/memory-events.ts`). | `npm run test:validator`<br>`npm run test:cross-session` |
| **2. Real-World Use & Impact** | Real deployment, real users, before/after difference. | Public bot [@WalLearnBot](https://t.me/WalLearnBot) tested across pharmacology (`PCL301`, `PCL302`) & anatomy (`ANA201`). Documented N=1 longitudinal study. | [docs/CASE-STUDY.md](docs/CASE-STUDY.md)<br>Live Telegram Bot<br>[On-Chain Blob Sample](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U) |
| **3. Build Quality & Reproducibility** | Official MemWal SDK, clean architecture, automated tests. | Official `@mysten-incubation/memwal` (v0.1.8), Ed25519 canonical request signer, bounded job waiting, strict credential isolation. | `npm test`<br>`npm run test:config`<br>`npm run test:polling`<br>`npm run test:pdf` |
| **4. Best Article & Ecosystem Feedback** | Clear educational article and actionable feedback. | Published Medium article on building with MemWal; structured feedback on SDK ESM exports, cursor pagination on restore, and semantic distance filters. | [Published Medium Deep Dive](https://medium.com/@opeyemi406/building-wallearn-how-we-solved-chatbot-amnesia-for-university-students-using-walrus-memory-0de459ac8b71)<br>See Section 6 below |

### Before vs. After Comparative Matrix (Criterion 2 Evidence)

| Evaluation Dimension | Standard Ephemeral Chatbots (Before) | WalLearn with Walrus Memory (After) | Verification Mechanism |
|---|---|---|---|
| **Memory Model** | **Volatile Context:** State cleared on session timeout or container restart. | **Cryptographic Event Streams:** State transitions committed to Walrus Mainnet. | Auditable on Walruscan (72+ on-chain blobs in WALRUS_BLOBS.md). |
| **Drill Allocation** | **Unconstrained Prompting:** Repetitive questions prone to prompt drift. | **Algorithmic Invariant:** $\ge 50\%$ allocation to active Walrus weakness topics. | Programmatic validator (`npm run test:validator`). |
| **Continuity** | **Cold-Start Amnesia:** User must re-explain mistakes from the beginning. | **Zero-Input Recall:** `/briefing` surfaces weaknesses before any prompt. | Verified locally (`npm run test:cross-session`). |
| **Mastery Verification** | **Single-Pass Heuristic:** One correct guess marks topic mastered. | **3-Consecutive-Pass Rule:** 3 verified passes across distinct sessions. | Deterministic state machine unit tests. |
| **Disaster Recovery** | **Irrevocable Loss:** Deleted chat history permanently destroys profile. | **Decentralized State Replay:** `/restore` rebuilds state from Walrus blobs. | Verified by wiping cache and running `/restore`. |
| **Study Efficiency** | **Unfocused Revision:** Student repeats known mistakes on exam day. | **Targeted Convergence:** Drills prioritize unmastered misconceptions. | University student field study ([docs/CASE-STUDY.md](docs/CASE-STUDY.md)). |

---

## 3. Verification Quick-Start for Judges

### Verification Modes:
- **Mode A: Independent Judge Verification (Default):** Runs against the judge's own configured MemWal account in `.env`. Generates dynamic, isolated test namespaces (`u<chatId>_audit<nonce>`) and writes/recalls fresh test events. Has zero dependency on creator data.
- **Mode B: Reference Production Verification (Optional):** Validates the deployed hackathon instance via `PRODUCTION_MEMWAL_ACCOUNT_ID=0x... npm run test:production`.

```bash
# 1. Configuration safety & zero creator fallback test (7/7 passing)
npm run test:config

# 2. 60/30/10 ratio invariant validator test (3/3 passing)
npm run test:validator

# 3. Bounded MemWal job polling, timeout, and failure handling test (6/6 passing)
npm run test:polling

# 4. Live on-chain protocol diagnostic (writes & recalls from fresh audit namespace)
npm test

# 5. Account-independent cross-session isolation test
npm run test:cross-session

# 6. Full lecture PDF ingestion, confirmed writes, and restore verification
npm run test:pdf -- "tests/fixtures/sample-lecture.pdf"
```

---

## 4. Expected Test Outputs

- **`npm run test:config`**: Validates that missing credentials throw clear configuration errors, delegate keys cannot pair with mismatched accounts, and zero creator IDs or namespaces are hardcoded.
- **`npm run test:validator`**: Asserts that `validateQuizDistribution()` enforces $\ge 50\%$ weakness allocation and automatically repairs ratio drift.
- **`npm run test:polling`**: Validates that `waitForRememberJob()` resolves terminal `done` states, exits immediately on `failed` status, bounds timeouts without hanging, and rejects zero-entry restores.
- **`npm test`**: Dispatches a live fact to Walrus Mainnet, polls confirmation, retrieves the decrypted memory via remote TEE recall, and rebuilds the state with zero disk dependency.
- **`npm run test:pdf`**: Parses document slides, generates CBT questions via Gemini 2.5 Flash, confirms both MemWal writes, tests 3-pass mastery progression, and validates `/restore`.

---

## 5. Architectural Evidence & Source Index

| Component | Source File | Key Architectural Role |
|---|---|---|
| **Credential Isolation** | [`src/config.ts`](src/config.ts) | Strict environment validation; no silent defaults to creator accounts. |
| **MemWal SDK Client** | [`src/walrus/client.ts`](src/walrus/client.ts) | Official SDK integration, Ed25519 canonical signer, bounded polling (`waitForRememberJob`). |
| **Event Replay Engine** | [`src/walrus/memory-events.ts`](src/walrus/memory-events.ts) | Parses `[MISTAKE]`, `[PROGRESS]`, `[MASTERED]`, and `[EXAM_FACT]` lines for deterministic state recovery. |
| **Invariant Validator** | [`src/ai/validator.ts`](src/ai/validator.ts) | Programmatic post-generation enforcement of the 60/30/10 cognitive question ratio. |
| **Document Pipeline** | [`scripts/test-document.ts`](scripts/test-document.ts) | Full-deck slide ingestion, confirmed write polling, and strict restore validation. |

---

## 6. Ecosystem Feedback & Track Compliance

### Beyond the Big Two Track Compliance
- Uses **Google Gemini 2.5 Flash** (via OpenRouter) on Node.js/TypeScript rather than Anthropic or OpenAI. Demonstrates that Walrus Memory acts as a universal, model-agnostic substrate.

### Actionable MemWal SDK Feedback Submitted:
1. **SDK ESM Export Mapping:** `@mysten-incubation/memwal` (v0.1.8) lacks CommonJS export fallbacks, causing `ERR_PACKAGE_PATH_NOT_EXPORTED` in mixed build tooling. Adding dual CJS/ESM exports resolves packaging issues.
2. **Restore Keyset Pagination:** `sdk.restore(namespace, limit)` currently performs a single-shot inspection without keyset cursors. Adding pagination cursors ensures deterministic recovery for large namespaces.
3. **Semantic Distance Thresholds:** Exposing `maxDistance` parameters on `sdk.recall()` allows developers to tune sensitivity for short academic terms.
4. **[Bug Bounty Issue #1155](https://github.com/MystenLabs/MemWal/issues/1155):** `MemWal.create()` missing `accountId` validation bug where unset or missing account IDs silently generate corrupted Ed25519 canonical signatures containing `"undefined"` and trigger misleading 401 AUTH_REJECTED relayer errors.

---

## 7. Known Limitations & Technical Disclosures

- **Asynchronous TEE Indexing Lag:** MemWal write jobs confirm on Walrus Mainnet within ~1.5–3 seconds before remote vector indexing settles. Test suites use bounded retries (`waitForRememberJob`) to ensure accurate validation.
- **Write-Through Performance Cache:** `data/mistakes-ledger.json` serves as a disposable performance cache to eliminate Telegram UI button latency. Walrus Protocol Mainnet is the sole durable source of truth.
- **Relayer Rate Limiting:** `WalrusClient` implements automatic exponential backoff for HTTP 429 status codes.

---

## 8. Reference Production Deployment Artifacts

The table below documents the live public production deployment of `@WalLearnBot` on Sui Mainnet:

| Artifact | Production Explorer URL |
|---|---|
| **Sui MemWalAccount Object** | [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140`](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140) |
| **Dedicated Sessions Wallet** | [`0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2`](https://suiscan.xyz/mainnet/account/0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2) |
| **Sample Blobs on Walruscan** | [`5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U`](https://walruscan.com/mainnet/blob/5BTSt6okVpuhzpzS1wcmFvh5Kx863nki2avsXIKzt7U) • [`qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4`](https://walruscan.com/mainnet/blob/qSrxQx_AHWUZTZ4C1DtG-zSrQZxDC_nXhAqaL53y--4) • [`ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0`](https://walruscan.com/mainnet/blob/ANLFQFfrtYu9mXBHhnQ9CeTq0bNmsybDkWqBf-bxrM0) |

---

## 9. Extended Documentation Links

- 🎥 **[YouTube Demo Video](https://youtu.be/Fhf1N7epjBc)** — Live end-to-end recording of WalLearn in action.
- ✍️ **[Medium Technical Article](https://medium.com/@opeyemi406/building-wallearn-how-we-solved-chatbot-amnesia-for-university-students-using-walrus-memory-0de459ac8b71)** — Published technical article detailing architecture, before/after impact, and real session evidence.
- 📖 **[README.md](README.md)** — Project overview, bot commands, and onboarding guide.
- 🔗 **[WALRUS_BLOBS.md](WALRUS_BLOBS.md)** — Audit log of 72+ confirmed Walrus Mainnet blob receipts with clickable explorer links.
- 📐 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Complete architectural diagrams, event schemas, and signer specs.
- 📊 **[docs/CASE-STUDY.md](docs/CASE-STUDY.md)** — University student longitudinal field study (`PCL301`) and comparative analysis.
