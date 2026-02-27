export type ExecutionTarget = "local" | "edge";

export interface IntentAnalysis {
  target: ExecutionTarget;
  confidence: number;
  reasoning: string;
  originalTask: string;
}

const EDGE_KEYWORDS = [
  "edge", "cloud", "global", "cean", "pályázat", "kutatás", "research", "scrape", 
  "harvester", "deploy", "worker", "pályázatfigyelő", "grant", "ev hunter"
];

const LOCAL_KEYWORDS = [
  "local", "fájl", "file", "test", "teszt", "build", "typescript", "python", 
  "git", "commit", "local machine", "rendszer", "system", "számla", "invoice"
];

export function analyzeIntent(task: string): IntentAnalysis {
  const normalizedTask = task.toLowerCase();
  
  let edgeScore = 0;
  let localScore = 0;

  EDGE_KEYWORDS.forEach(kw => {
    if (normalizedTask.includes(kw)) edgeScore++;
  });

  LOCAL_KEYWORDS.forEach(kw => {
    if (normalizedTask.includes(kw)) localScore++;
  });

  // Default to local if no clear indicator
  let target: ExecutionTarget = "local";
  let confidence = 0.7;
  let reasoning = "Alapértelmezett helyi végrehajtás";

  if (edgeScore > localScore) {
    target = "edge";
    confidence = 0.8 + (Math.min(edgeScore, 2) * 0.1);
    reasoning = "Felhő/Edge specifikus kulcsszavak azonosítva";
  } else if (localScore > edgeScore) {
    target = "local";
    confidence = 0.8 + (Math.min(localScore, 2) * 0.1);
    reasoning = "Helyi rendszer műveletekre utaló kulcsszavak";
  } else if (edgeScore > 0 && localScore > 0) {
    // Conflict - prefer local for safety or edge if both mentioned
    target = "local";
    confidence = 0.5;
    reasoning = "Vegyes kulcsszavak, megerősítés javasolt";
  }

  return {
    target,
    confidence,
    reasoning,
    originalTask: task
  };
}
