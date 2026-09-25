# WalLearn (`@WalLearnBot`) — The AI Study Chatbot with Permanent Memory on Walrus Protocol

> **Submission for Walrus Sessions: Chatbots That Remember**  
> Deployed on Telegram: [@WalLearnBot](https://t.me/WalLearnBot)  
> Built with Google Gemini 3.5 Flash & Walrus Protocol Mainnet.

---

## 🎯 The Problem: AI Study Tools Have Amnesia

Every student knows this pain: you grind past questions and lecture slides for 3 hours, make 8 mistakes, and close the session. Tomorrow, you open your AI study app and it greets you from scratch—re-explaining what you already know while completely forgetting the only thing that decides whether you pass: **what you got wrong**.

Your mistakes—the highest-yield cognitive data in your entire prep—evaporate every single time you close the tab.

## 💡 The Solution: WalLearn

**WalLearn** gives your study sessions permanent on-chain memory on **Walrus Protocol**.

- **Instant Misconception Interception**: Every time you answer a CBT practice question incorrectly, WalLearn diagnoses *why* you failed (distinguishing conceptual gaps from careless slips) and commits an encrypted blob to **Walrus Mainnet** the second it happens.
- **Cold Recall & Weakness Briefing**: When you return in a fresh session, WalLearn recalls your weaknesses cold before you type a word, surfacing a **Weakness Briefing** ranked by $(\text{misses} \times \text{severity})$ with recency weighting.
- **Adaptive 60/30/10 Quizzing**: The question engine automatically weights practice rounds:
  - **60%**: Drilling your known Walrus-recorded weaknesses.
  - **30%**: Fresh material from newly uploaded lecture slides.
  - **10%**: Spot checks on mastered concepts (with demotion rules if failed).
- **Slide Ingestion**: Drop any lecture PDF or notes directly into Telegram to generate CBT questions grounded strictly in your coursework.

---

## ⛓️ On-Chain Proof & Verification (Walrus Mainnet)

| Metric | Verification Details |
|---|---|
| **Telegram Handle** | [@WalLearnBot](https://t.me/WalLearnBot) |
| **Dedicated Sessions Wallet** | `0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2` |
| **MemWalAccount Object** | [`0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140` on Suiscan](https://suiscan.xyz/mainnet/object/0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140) |
| **Delegate Address** | `0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa` |
| **Relayer** | `https://relayer.memory.walrus.xyz` |
| **Primary LLM** | Google Gemini (`google/gemini-3.5-flash-lite` via OpenRouter) — *qualifies for Beyond the Big Two track* |

---

## 📱 Bot Commands

| Command | Action |
|---|---|
| `/start` | Onboarding, overview, and on-chain account link. |
| `/study` or `/prep` | Recalls stored mistakes from Walrus and launches an adaptive CBT quiz. |
| `/briefing` | Displays the cold Weakness Briefing: top failed topics ranked by severity and miss count. |
| `/ledger` or `/proof` | Shows live on-chain status, total Walrus mistake blobs, and explorer links. |
| `/subject <tag>` | Switches active subject namespace (e.g. `/subject pcl301`, `/subject usmle`). |
| **Upload PDF Document** | Ingests lecture slides and generates 5 high-yield CBT questions. |
| **Freeform Chat** | Ask any question; WalLearn answers using your evolved prompt rules, opening with your past mistake history. |

---

## 🛠️ Local Development & Quick Start

### 1. Prerequisites
- Node.js 20+
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- OpenRouter API Key (or Google AI Studio Key)

### 2. Setup
```bash
git clone https://github.com/opeyemi406/WalLearn-bot.git
cd wallearn-bot
npm install
```

### 3. Environment Variables (`.env`)
```env
TELEGRAM_BOT_TOKEN=your_telegram_bot_token
OPENROUTER_API_KEY=your_openrouter_key
AI_MODEL=google/gemini-3.5-flash-lite
MEMWAL_CREDS_DIR=/path/to/.memwal-wallearn
WALRUS_ACCOUNT_ID=0x75a533d83e9fee09e36b29b14e8b093862042ee92b188e5122338da7118be140
WALRUS_WALLET_ADDRESS=0xf3efc1f6d86ea33f736072668549138f00f2ca8fc67962019543e213a0fa2db2
WALRUS_DELEGATE_ADDRESS=0x7dea8c54a7a72c231fa829abed50a47a03b7d1e99e74974bc21773c73490bbaa
WALRUS_RELAYER_URL=https://relayer.memory.walrus.xyz
```

### 4. Run the Bot
```bash
npm start
```
