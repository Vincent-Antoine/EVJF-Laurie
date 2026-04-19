const STORAGE_KEY = "evjf_quiz_v1_done";
const COOKIE_NAME = "evjf_quiz_v1_done";
const PROGRESS_KEY = "evjf_quiz_v1_progress";

export type QuizProgress = {
  questionIndex: number;
  score: number;
  answeredIds: string[];
  /** Si présent, l’utilisateur doit valider le feedback avant la suite */
  pending?: {
    questionId: string;
    ok: boolean;
    /** Libellé de la réponse choisie (bonne réponse uniquement, pour l’overlay). */
    chosenLabel?: string;
  } | null;
};

function setCookie(name: string, value: string, maxAgeSeconds: number) {
  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${maxAgeSeconds}; Path=/; SameSite=Lax`;
}

export function isQuizCompleted(): boolean {
  try {
    if (localStorage.getItem(STORAGE_KEY) === "1") return true;
  } catch {
    /* ignore */
  }
  return document.cookie.split(";").some((c) => {
    const [k, v] = c.trim().split("=");
    return decodeURIComponent(k) === COOKIE_NAME && decodeURIComponent(v || "") === "1";
  });
}

export function markQuizCompleted(): void {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    /* ignore */
  }
  setCookie(COOKIE_NAME, "1", 60 * 60 * 24 * 400);
}

export function loadProgress(): QuizProgress | null {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as QuizProgress;
    if (
      typeof p.questionIndex !== "number" ||
      typeof p.score !== "number" ||
      !Array.isArray(p.answeredIds)
    ) {
      return null;
    }
    return p;
  } catch {
    return null;
  }
}

export function saveProgress(p: QuizProgress): void {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* ignore */
  }
}

export function clearProgress(): void {
  try {
    localStorage.removeItem(PROGRESS_KEY);
  } catch {
    /* ignore */
  }
}
