# WalLearn (`@WalLearnBot`)
### Autonomous AI Cognitive Study System Powered by Decentralized Verifiable Memory on Walrus Protocol

[![Walrus Mainnet](https://img.shields.io/badge/Walrus-Mainnet_Verified-00D1B2?style=for-the-badge&logo=blockchain&logoColor=white)](https://walruscan.com)
[![Sui Blockchain](https://img.shields.io/badge/Sui-Mainnet_Object-4DA2FF?style=for-the-badge&logo=sui&logoColor=white)](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140)
[![LLM Engine](https://img.shields.io/badge/Google-Gemini_2.5_Flash-8E75B2?style=for-the-badge&logo=google&logoColor=white)](https://openrouter.ai)
[![Telegram](https://img.shields.io/badge/Telegram-@WalLearnBot-2CA5E0?style=for-the-badge&logo=telegram&logoColor=white)](https://t.me/WalLearnBot)
[![Judging Dossier](https://img.shields.io/badge/Evaluation-Judging_Dossier-FF7E00?style=for-the-badge&logo=gitbook&logoColor=white)](JUDGING.md)

> **Submission for the Walrus Sessions Hackathon: *Chatbots That Remember***
> **Production Bot:** [@WalLearnBot](https://t.me/WalLearnBot) | **Primary AI Model:** `google/gemini-2.5-flash` via OpenRouter
> 🎥 **Demo Video:** [Watch Live Walkthrough on YouTube](https://youtu.be/Fhf1N7epjBc)
> ✍️ **Technical Article:** [Read Published Deep Dive on Medium](https://medium.com/@opeyemi406/building-wallearn-how-we-solved-chatbot-amnesia-for-university-students-using-walrus-memory-0de459ac8b71)
> 📋 **Judges Quick Link:** Direct evaluation against all 4 criteria with auditable test evidence in [JUDGING.md](JUDGING.md).

---

## 1. Project Overview

**WalLearn** is an autonomous AI cognitive study assistant on Telegram that cures chatbot amnesia using decentralized, verifiable memory on Walrus Protocol. Powered by **Google Gemini 2.5 Flash** and `@mysten-incubation/memwal` (v0.1.8), WalLearn transforms student mistakes into immutable on-chain event streams, enforces an adaptive 60/30/10 weakness-targeted question ratio, and enables true cross-session disaster recovery with zero dependency on centralized databases.

---

## 2. Problem & Solution

### The Problem: AI Study Amnesia
Standard conversational study tools treat memory as volatile session context. When a chat expires, a container restarts, or a student switches devices, prior diagnostic mistakes vanish. Students waste hours re-answering mastered concepts while repeating the exact same conceptual trap questions on exam day.

### The Solution: Mistakes as On-Chain Assets
WalLearn commits every misconception, recovery streak, and mastery milestone to Walrus Protocol Mainnet as an Ed25519-signed, append-only event line. Each student's cognitive state is cryptographically siloed (`u<telegramChatId>_<courseCode>`). The bot sponsors Walrus storage on Sui Mainnet, providing frictionless Web2 onboarding on Telegram with immutable Web3 persistence.

---

## 3. How Walrus Memory Drives Learning

Memory in WalLearn is an **active computational state variable**, not decorative chat trivia:

1. **Adaptive 60/30/10 Question Allocation:** 60% of drill questions programmatically target active Walrus weaknesses with rotated clinical distractors; 30% introduce syllabus concepts; 10% spot-check mastered topics. Enforced post-generation via `validateQuizDistribution()`.
2. **3-Consecutive-Pass Mastery State Machine:** Guessing correctly once does not clear an error. Topics only graduate to `[MASTERED]` on Walrus after 3 independent passes across separate sessions. Spot-check failures demote status back to recovery.
3. **Zero-Input Cold Recall & Disaster Recovery (`/restore`):** When a student returns, `/briefing` surfaces active weaknesses before any user input. If chat history is cleared or cloud servers redeploy, `/restore` replays raw Walrus blobs to reconstruct learner profiles in seconds with zero disk dependency.

---

## 4. Bot Commands & Core Capabilities

| Trigger / Command | Function & On-Chain Execution |
|---|---|
| `/start` | Onboarding dashboard, active subject selection, and quick actions. |
| `/study` or `/prep` | Recalls active weaknesses from Walrus and launches an adaptive 60/30/10 drill. |
| `/briefing` | Cold-retrieves stored weaknesses from Walrus and renders a prioritized weakness report. |
| `/analyze` | Arms multimodal document ingestion (PDF, PPTX, DOCX, photos) to extract syllabus facts. |
| `/restore` | Replays historical event lines from Walrus Mainnet to reconstruct local learner state. |
| `/health` | Diagnostic probe verifying relayer reachability, latency, and active Sui account ID. |
| **Drop File / Image** | Ingests lecture slides or notes and generates grounded practice questions. |

---

## 5. Architecture Summary

WalLearn utilizes a decoupled architecture designed for sub-second Telegram responsiveness and reliable blockchain writes:
- **Layer 0 (Fast-Path):** Intercepts inline keyboard taps (`[A]`, `[B]`, `[C]`, `[D]`) for sub-millisecond UI feedback.
- **Layer 1 (Semantic Router):** Classifies freeform student queries with Gemini 2.5 Flash and injects prior misconceptions.
- **Cryptographic Storage:** Signs canonical mutation requests via `@noble/ed25519` for the official MemWal relayer.
- **Write-Through Performance Cache:** `data/mistakes-ledger.json` serves strictly as a temporary runtime write-through cache and job log. Walrus Protocol Mainnet is the sole authoritative ground truth.

*(For full architecture diagrams and event schemas, see [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).)*

---

## 6. Installation & Local Setup

### 1. Clone & Install
```bash
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd WalLearn-bot
npm install
npm run build
```

### 2. Environment Configuration (`.env`)
Create a `.env` file in the root directory (see `.env.example`):
```env
TELEGRAM_BOT_TOKEN="your_telegram_bot_token"
OPENROUTER_API_KEY="your_openrouter_api_key"
AI_MODEL="google/gemini-2.5-flash"

# Option A: Local credentials directory (credentials.json)
MEMWAL_CREDS_DIR="~/.memwal-wallearn"

# OR Option B: Discrete environment variables (Same Sui account)
MEMWAL_PRIVATE_KEY="your_64_char_hex_ed25519_private_key"
MEMWAL_ACCOUNT_ID="0xYOUR_SUI_MEMWAL_ACCOUNT_ID"
MEMWAL_SERVER_URL="https://relayer.memory.walrus.xyz"
```
> ⚠️ **Security Notice:** Never commit `.env` or reveal private keys. All identity fields must belong to the **same** Sui account.

---

## 7. Judge Verification Commands

Judges can verify the entire test suite locally using their own credentials. Tests use ephemeral audit namespaces (`u<chatId>_audit<nonce>`) and do not depend on creator memories:

```bash
# 1. On-chain protocol diagnostic (relayer health & live round-trip memory recall)
npm test

# 2. Configuration safety & credential isolation test suite (7/7 passing)
npm run test:config

# 3. 60/30/10 ratio invariant validator test with programmatic slot repair
npm run test:validator

# 4. Bounded MemWal job polling, timeout, and failure handling test (6/6 passing)
npm run test:polling

# 5. Account-independent cross-session isolation and state machine suite
npm run test:cross-session

# 6. Multimodal lecture PDF ingestion, confirmed writes, and restore verification
npm run test:pdf -- "path/to/any/lecture.pdf"

# 7. (Optional) Production deployed account verification
PRODUCTION_MEMWAL_ACCOUNT_ID=0x... PRODUCTION_CHAT_ID=... npm run test:production
```

---

## 8. Deployment (Railway 24/7)

WalLearn is pre-configured for automated cloud deployment via `railway.json`:
1. Connect this repository to [Railway](https://railway.app).
2. Set `TELEGRAM_BOT_TOKEN`, `OPENROUTER_API_KEY`, and `MEMWAL_CREDENTIALS_JSON` in Railway Variables.
3. Railway automatically builds the container (Node 20 + Python + pypdf) and deploys 24/7.
4. Clean container startup: runtime ledger cache is initialized empty; all student states are restored from Walrus on demand.

---

## 9. Troubleshooting & Technical Considerations

- **Asynchronous Relayer Indexing:** When writing to MemWal, job confirmation takes 1.5–3 seconds for TEE encryption and vector indexing. Test scripts use bounded polling (`waitForRememberJob`) to ensure writes confirm before testing recall or restore.
- **Rate Limits (HTTP 429):** The `WalrusClient` implements automatic exponential backoff and respects relayer `Retry-After` headers.
- **Read-Only Filesystem:** If local cache writes are blocked by container permissions, WalLearn continues normal operation by reading directly from Walrus Mainnet.

---

## 10. Extended Documentation

- 🎥 **[YouTube Demo Video](https://youtu.be/Fhf1N7epjBc)** — Live end-to-end recording of WalLearn in action.
- ✍️ **[Medium Technical Article](https://medium.com/@opeyemi406/building-wallearn-how-we-solved-chatbot-amnesia-for-university-students-using-walrus-memory-0de459ac8b71)** — Published technical article detailing architecture, before/after impact, and real session evidence.
- 📋 **[JUDGING.md](JUDGING.md)** — Evidence-first evaluation dossier mapped to all 4 hackathon criteria.
- 🔗 **[WALRUS_BLOBS.md](WALRUS_BLOBS.md)** — Audit log of 72+ confirmed Walrus Mainnet blob receipts with clickable explorer links.
- 📐 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)** — Technical specification, dual-layer routing, and event-sourcing schemas.
- 📊 **[docs/CASE-STUDY.md](docs/CASE-STUDY.md)** — University student longitudinal field study (`PCL301`) and before/after comparison.

---

## License
MIT License. Open-source for the decentralized education ecosystem. Built for the Walrus Sessions Hackathon.
