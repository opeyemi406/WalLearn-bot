export interface MistakeEntry {
  topic: string;
  question: string;
  my_error: string;
  correct: string;
  severity: "high" | "medium" | "low";
  misses: number;
  timestamp?: string;
  blob_id?: string;
}

export interface WeaknessItem {
  topic: string;
  misses: number;
  severity: "high" | "medium" | "low";
  misconception: string;
  correct_fact: string;
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
  topic: string;
  question?: string;
  misconception?: string;
  correctFact?: string;
  severity?: "high" | "medium" | "low";
  misses?: number;
  namespace?: string;
  timestamp: string;
  status: "pending" | "confirmed";
}
