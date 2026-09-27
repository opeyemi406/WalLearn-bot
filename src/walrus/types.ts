export interface MistakeEntry {
  topic: string;
  question: string;
  my_error: string;
  correct: string;
  severity: "high" | "medium" | "low";
  misses: number;
  timestamp?: string;
  blob_id?: string;
  chatId?: number;
}

export interface WeaknessItem {
  topic: string;
  misses: number;
  severity: "high" | "medium" | "low";
  misconception: string;
  correct_fact: string;
  streak?: number; // 0 = unaddressed, 1 = 1/3, 2 = 2/3 passes
}

export interface WeaknessBriefing {
  subject: string;
  total_mistakes: number;
  weaknesses: WeaknessItem[];
  mastered: string[];
}

export interface StoredBlobRecord {
  jobId?: string;
  blobId?: string;
  recordType?: "mistake" | "fact";
  topic: string;
  question?: string;
  misconception?: string;
  correctFact?: string;
  severity?: "high" | "medium" | "low";
  misses?: number;
  correctStreak?: number; // Requires 3 consecutive passes to reach full mastery
  namespace?: string;
  chatId?: number;
  timestamp: string;
  status: "pending" | "confirmed" | "recovering" | "mastered";
}
