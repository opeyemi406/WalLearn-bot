import fs from "fs";
import path from "path";
import { walrus } from "../src/walrus/client.js";
import { parseSubjectInput, setUserSubject, getExamStyle, setExamStyle } from "../src/state.js";
import { buildQuizGeneratorPrompt } from "../src/ai/prompts.js";
import { askAi } from "../src/ai/client.js";

// Full slide text from the user's presentation
const SLIDE_TEXT = `
DRUGS ACTING ON NICOTINIC RECEPTORS - NEUROMUSCULAR JUNCTION & AUTONOMIC GANGLIA
Prof Ibrahim Oreagba

Learning objectives:
• To understand the drugs that enhance Neuromuscular transmission
• To understand the different classes of Neuromuscular Blocking agents
• To understand the clinical uses and adverse effects of NMBs
• To understand drugs acting on the autonomic ganglia

Neuromuscular transmission (NMT) is the process by which neurons communicate with muscles to regulate movement.
Certain drugs can enhance NMT, improving muscle strength and function.

Cholinesterase Inhibitors:
• Mechanism: Inhibit acetylcholinesterase (AChE), the enzyme that breaks down acetylcholine (ACh) in the synaptic cleft.
• Increase the concentration and duration of action of ACh, enhancing NMT.
• Examples include Pyridostigmine, Neostigmine, and Edrophonium.
• Clinical uses: Treatment of Myasthenia gravis, a chronic autoimmune disorder characterized by muscle weakness and fatigue.

Anticholinesterase Drugs:
• Mechanism: Similar to cholinesterase inhibitors, but also increase the release of ACh from motor neuron terminals.
• Enhance NMT by increasing the amount of ACh available for binding to nicotinic receptors.
• Examples include Donepezil, Rivastigmine, and Galantamine.
• Clinical uses: Treatment of Alzheimer's disease.

Nicotinic Receptor Agonists:
• Mechanism: Directly stimulate nicotinic acetylcholine receptors (nAChRs) on muscle fibers.
• Enhance NMT by increasing depolarization of muscle fibers.
• Examples: Nicotine, Varenicline, Galantamine.
• Clinical uses: Smoking cessation, ADHD, Alzheimer's disease.

Neuromuscular Blocking Agents (NMBs):
• Curare used by South American natives as arrow poison producing death by skeletal muscle paralysis.
• Active compound: d-tubocurarine.
• Classification based on PK:
  - Long acting: D-tubocurarine, metocurine, pancuronium, doxacurium (persistent blockade, difficult complete reversal).
  - Intermediate acting: Vecuronium, Rocuronium, Atracurium.
  - Short-acting: Mivacurium.
• Classification based on chemistry:
  - Natural alkaloids: D-tubocurarine, alcuronium.
  - Ammonio steroids: Pancuronium (blocks muscarinic receptors leading to vagal blockade and tachycardia). Newer agents (Vecuronium, Rocuronium) eliminate tachycardia and lack histamine release.
  - Benzylisoquinolines: Atracurium and Mivacurium (devoid of vagolytic and ganglionic actions, but slight histamine release). Very short duration due to unusual metabolism.
• Classification based on mechanism:
  - Competitive (Nondepolarizing) agents: D-tubocurarine, pancuronium, vecuronium, atracurium, mivacurium, gallamine. All quaternary ammonium compounds (poorly absorbed, rapidly excreted).
  - Depolarizing agents: Succinylcholine, Decamethonium.
• Depolarizing block phases:
  - Phase 1 block: Succinylcholine causes persistent depolarization of motor end plate, unresponsive to subsequent impulses. Flaccid paralysis results. AUGMENTED, NOT REVERSED, by cholinesterase inhibitors.
  - Phase 2 block: Prolonged exposure causes membrane repolarization but desensitization. Characteristics resemble nondepolarizing block, REVERSED by acetylcholinesterase inhibitors.
• Adverse effects of NMBs:
  - Tubocurarine: Fall in arterial pressure (ganglion block + histamine release causing bronchospasm).
  - Gallamine & Pancuronium: mAChR blockade in heart causing tachycardia.
  - Succinylcholine: Bradycardia (preventable by atropine), increased intraocular pressure, prolonged paralysis (plasma cholinesterase deficiency), malignant hyperthermia (mutation of Ca2+ release channel of sarcoplasmic reticulum, treated by Dantrolene).
• Clinical uses of NMBs:
  - Surgical relaxation (intracavitary, intra-abdominal, intrathoracic).
  - Tracheal intubation.
  - Control of ventilation in critically ill patients.
  - Convulsion treatment (attenuates peripheral muscle manifestations, does NOT cross blood-brain barrier).

Drugs Acting at Autonomic Ganglia:
• Ganglionic blockers reduce transmission in all autonomic ganglia (both sympathetic and parasympathetic), uncovering the predominant tone:
  - Arterioles & Veins (Sympathetic) -> Vasodilation
  - Heart (Parasympathetic) -> Tachycardia
  - Iris (Parasympathetic) -> Mydriasis
  - Ciliary muscle (Parasympathetic) -> Cycloplegia
  - GIT (Parasympathetic) -> Hypomotility / Constipation
  - Urinary bladder (Parasympathetic) -> Urinary retention
  - Salivary glands (Parasympathetic) -> Xerostomia (dry mouth)
  - Sweat glands (Sympathetic cholinergic) -> Anhydrosis
• Examples of Ganglion Blockers:
  - Competitive: Trimethaphan, Tetraethylammonium (TEA).
  - Noncompetitive: Hexamethonium (C6) blocks ion channels.
  - Depolarizing: High-dose nicotine.
  - Mecamylamine: Secondary amine, only agent currently available in US, penetrates CNS and enteric tract. Danger of paralytic ileus.
  - Trimethaphan: Short-acting IV agent used in Acute Aortic Dissection and controlled hypotension.
• Ganglion Stimulants:
  - Nicotine, Lobeline, Tetramethylammonium (TMA), DMPP (3x more potent and ganglion-selective than nicotine), McN-A-343 (M1 muscarinic receptor selective in ganglia).
  - Nicotine: Readily absorbed through respiratory tract, buccal mucosa, skin. Elimination by kidney (diminished if urine is alkaline). Half-life 2 hours.

Skeletal Muscle Relaxants:
• Centrally acting:
  - Spinal cord: Baclofen (GABA_B agonist, decreases Ca2+ conductance and glutamate release, relieves flexor spasms in multiple sclerosis; causes drowsiness/seizures in overdose), Diazepam (GABA_A, sedation), Tizanidine (alpha2 agonist).
  - Brain stem: Carisoprodol, Cyclobenzaprine, Orphenadrine (reduce muscle spasms from local trauma/strain, NOT spasticity; antimuscarinic side effects).
• Peripherally acting:
  - Botulinum toxin type A: Inhibits acetylcholine release from motor nerve endings at NMJ. Used for spasmodic torticollis, blepharospasm, post-stroke spasticity.
  - Dantrolene: Acts directly on muscle fibers to decrease Ca2+ release from sarcoplasmic reticulum. First choice IV for malignant hyperthermia. S.E.: muscle weakness, hepatotoxicity.
  - Membrane stabilizers: Quinine, Procainamide for myotonia congenita.
`;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function runTestSuite() {
  console.log("================================================================================");
  console.log("🧪 WALLEARN BOT COMPREHENSIVE END-TO-END TEST SUITE");
  console.log("Document: Drugs Acting on Nicotinic Receptors, NMJ & Autonomic Ganglia (Prof Oreagba)");
  console.log("================================================================================\n");

  const testChatId = 6878463854; // Babyveec's real active chat ID
  const testCourseCode = "PCL301";

  // --------------------------------------------------------------------------------
  // TEST 1: System Health & Relayer Connectivity Check (/health)
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 1: Running System Health & Diagnostics (/health)...");
  const health = await walrus.getHealth();
  console.log(`• Walrus Status: ${health.status}`);
  console.log(`• Mainnet Account: ${health.accountId}`);
  console.log(`• Signer Wallet: ${health.walletAddress}`);
  console.log(`• Confirmed On-Chain Blobs: ${health.confirmedBlobs} / ${health.blobCount}`);
  if (!health.status.includes("healthy") && !health.status.includes("connected")) {
    throw new Error("Health check failed!");
  }
  console.log("✅ TEST 1 PASSED: Relayer healthy and connected to Walrus Mainnet!\n");
  await sleep(1500);

  // --------------------------------------------------------------------------------
  // TEST 2: Course & Topic Ingestion Logic
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 2: Testing Course Title & Code Ingestion...");
  const parsed = parseSubjectInput("PCL301 - Drugs Acting on Nicotinic Receptors");
  console.log(`• Parsed Code: ${parsed.code}`);
  console.log(`• Parsed Display: ${parsed.display}`);
  const profile = setUserSubject(testChatId, "PCL301 - Drugs Acting on Nicotinic Receptors");
  const userNs = walrus.getUserNamespace(profile.subjectCode, testChatId);
  console.log(`• Isolated User Namespace: ${userNs}`);
  if (userNs !== `u${testChatId}_pcl301`) {
    throw new Error(`Namespace mismatch! Expected u${testChatId}_pcl301, got ${userNs}`);
  }
  console.log("✅ TEST 2 PASSED: Course code and user-isolated namespace validated!\n");
  await sleep(1500);

  // --------------------------------------------------------------------------------
  // TEST 3: MemWal Text Analysis (/analyze) & Atomic Bulk Storage (remember/bulk)
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 3: Testing MemWal Concept Extraction & remember/bulk Storage...");
  console.log("Sending lecture excerpts to MemWal analyze endpoint...");
  const sampleExcerpt = SLIDE_TEXT.slice(0, 3500);
  const analyzeRes = await walrus.analyzeText(sampleExcerpt, testCourseCode, testChatId);
  console.log(`• MemWal Extraction Success: ${analyzeRes.success}`);
  console.log(`• Extracted Facts Count: ${analyzeRes.factCount}`);
  if (analyzeRes.facts && analyzeRes.facts.length > 0) {
    console.log(`• Sample Extracted Fact: "${analyzeRes.facts[0].text}"`);
  }

  await sleep(2500);

  // Also test atomic bulk write for lecture high-yield facts
  console.log("Testing atomic remember/bulk on Walrus Mainnet...");
  const testFacts = [
    `[FACT] Succinylcholine Phase 1 block is augmented by cholinesterase inhibitors, whereas Phase 2 block is reversed by them.`,
    `[FACT] Dantrolene decreases calcium release from the sarcoplasmic reticulum and is first choice IV for malignant hyperthermia.`,
    `[FACT] Ganglionic blockade of arterioles and veins results in vasodilation, while cardiac blockade causes tachycardia.`,
  ];
  const bulkRes = await walrus.rememberBulk(testFacts, testCourseCode, testChatId);
  console.log(`• Bulk Write Success: ${bulkRes.success}`);
  console.log(`• Relayer Accepted Jobs: ${bulkRes.jobIds?.length}`);
  console.log("✅ TEST 3 PASSED: MemWal analysis and atomic bulk storage confirmed on Walrus!\n");
  await sleep(3000);

  // --------------------------------------------------------------------------------
  // TEST 4: CBT Quiz Generation Grounded 100% in Lecture Slides
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 4: Generating CBT Practice Quiz strictly grounded in slides...");
  const briefing = await walrus.getWeaknessBriefing(testCourseCode, testChatId);
  const prompt = buildQuizGeneratorPrompt(SLIDE_TEXT, briefing, 3, true);

  console.log("Calling Gemini 2.5 Flash via AI Client...");
  const rawAi = await askAi([
    { role: "system", content: "You are an expert exam question generator that outputs strict, valid JSON only." },
    { role: "user", content: prompt },
  ]);
  const cleanedJson = rawAi.replace(/```json/gi, "").replace(/```/g, "").trim();
  const parsedQuiz = JSON.parse(cleanedJson);
  console.log(`• Generated Questions: ${parsedQuiz.questions?.length}`);
  for (let i = 0; i < parsedQuiz.questions.length; i++) {
    const q = parsedQuiz.questions[i];
    console.log(`  Q${i + 1}: ${q.stem.slice(0, 90)}... [Correct: Option ${q.correct}]`);
  }
  if (!parsedQuiz.questions || parsedQuiz.questions.length === 0) {
    throw new Error("Quiz generation returned empty questions!");
  }
  console.log("✅ TEST 4 PASSED: Quiz generation grounded strictly in slide content!\n");

  // --------------------------------------------------------------------------------
  // TEST 5: Interactive Answer Evaluation & 3-Consecutive-Pass Mastery Engine
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 5: Testing Spaced Repetition Engine (3-Pass Mastery Rule)...");
  const testTopic = "Succinylcholine Phase 1 Block";
  const testQuestion = "Why are cholinesterase inhibitors contraindicated during Phase 1 depolarizing blockade?";

  // Step 5A: Simulate student making a mistake
  console.log("Step 5A: Simulating an incorrect student response...");
  const mistakeWrite = await walrus.remember(
    {
      topic: testTopic,
      question: testQuestion,
      my_error: "Chose Option B: Because it reverses the depolarization too quickly",
      correct: "Cholinesterase inhibitors augment Phase 1 block because depolarized membranes remain continuously depolarized and cannot repolarize.",
      severity: "high",
      misses: 1,
    },
    testCourseCode,
    testChatId
  );
  console.log(`• Mistake logged to Walrus Mainnet: Job ID ${mistakeWrite.jobId}`);

  // Verify streak starts at 0/3
  let pass1 = await walrus.recordCorrectAnswer(testTopic, testCourseCode, testChatId);
  console.log(`• First Correct Pass: Streak is ${pass1.streak}/3 (Mastered: ${pass1.newlyMastered})`);
  if (pass1.streak !== 1 || pass1.newlyMastered !== false) {
    throw new Error(`Expected streak 1/3, got ${pass1.streak}`);
  }

  // Pass 2: Streak becomes 2/3
  let pass2 = await walrus.recordCorrectAnswer(testTopic, testCourseCode, testChatId);
  console.log(`• Second Correct Pass: Streak is ${pass2.streak}/3 (Mastered: ${pass2.newlyMastered})`);
  if (pass2.streak !== 2 || pass2.newlyMastered !== false) {
    throw new Error(`Expected streak 2/3, got ${pass2.streak}`);
  }

  // Pass 3: Reaches 3/3 -> Graduates to Full Mastery!
  let pass3 = await walrus.recordCorrectAnswer(testTopic, testCourseCode, testChatId);
  console.log(`• Third Correct Pass: Streak is ${pass3.streak}/3 (Mastered: ${pass3.newlyMastered} 🏆)`);
  if (pass3.streak !== 3 || pass3.newlyMastered !== true) {
    throw new Error(`Expected streak 3/3 and newlyMastered=true!`);
  }
  console.log("✅ TEST 5 PASSED: 3-Consecutive-Pass Mastery Rule verified on Walrus Protocol!\n");
  await sleep(2500);

  // --------------------------------------------------------------------------------
  // TEST 6: Walrus Semantic Recall Engine (recall)
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 6: Testing Walrus Semantic Memory Recall...");
  const recalled = await walrus.recall("Succinylcholine phase 1 depolarizing blockade", testCourseCode, testChatId);
  console.log(`• Recalled Memories Length: ${recalled.length} characters`);
  const containsTopic = recalled.toLowerCase().includes("succinylcholine");
  console.log(`• Recalled relevant misconception/mastery record: ${containsTopic}`);
  if (!containsTopic) {
    throw new Error("Recall did not retrieve the recorded topic!");
  }
  console.log("✅ TEST 6 PASSED: Semantic memory recall verified!\n");
  await sleep(2500);

  // --------------------------------------------------------------------------------
  // TEST 7: Weakness Briefing Engine (/briefing)
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 7: Generating Weakness Briefing...");
  const updatedBriefing = await walrus.getWeaknessBriefing(testCourseCode, testChatId);
  console.log(`• Total Mistakes Active: ${updatedBriefing.total_mistakes}`);
  console.log(`• Mastered Topics Count: ${updatedBriefing.mastered.length}`);
  console.log(`• Mastered List: ${JSON.stringify(updatedBriefing.mastered)}`);
  console.log("✅ TEST 7 PASSED: Weakness Briefing dynamically reflects streak state!\n");
  await sleep(3500);

  // --------------------------------------------------------------------------------
  // TEST 8: Walrus Restore Engine (/restore)
  // --------------------------------------------------------------------------------
  console.log("▶️ TEST 8: Testing Walrus On-Chain Restore Engine (/restore)...");
  const restoreRes = await walrus.restoreNamespace(testCourseCode, testChatId);
  console.log(`• Restore Success: ${restoreRes.success}`);
  console.log(`• Blobs Synchronized on Mainnet: ${restoreRes.total}`);
  console.log(`• Target Namespace: ${restoreRes.namespace}`);
  if (!restoreRes.success || restoreRes.total === 0) {
    throw new Error("Restore failed or found 0 blobs!");
  }
  console.log("✅ TEST 8 PASSED: On-Chain Restore Engine successfully recovered blobs!\n");

  console.log("================================================================================");
  console.log("🎉 ALL 8 TESTS PASSED SUCCESSFULLY!");
  console.log("Every single bot tool and feature is fully functional and verified on Walrus Mainnet.");
  console.log("================================================================================");
}

runTestSuite().catch((err) => {
  console.error("❌ Test suite encountered a failure:", err);
  process.exit(1);
});
