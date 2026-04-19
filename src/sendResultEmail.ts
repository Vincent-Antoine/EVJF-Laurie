/** Types du rapport envoyé par e-mail (même structure qu’avant côté quiz). */
export type QuestionAnswerDetail = {
  questionId: string;
  prompt: string;
  chosenIndex: number;
  chosenLabel: string;
  correctIndex: number;
  correctLabel: string;
  ok: boolean;
};

export type QuizResultPayload = {
  completedAt: string;
  score: number;
  maxScore: number;
  details: QuestionAnswerDetail[];
};

/** Destinataires par défaut (chaque adresse reçoit une copie complète). */
const DEFAULT_RECIPIENTS = [
  "vincentcomparato69@gmail.com",
  "lkohlbec@gmail.com",
  "laliaschmitt12@gmail.com",
] as const;

function getRecipients(): string[] {
  const raw = import.meta.env.VITE_RESULT_EMAIL?.trim();
  if (raw) {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [...DEFAULT_RECIPIENTS];
}

function formatFr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("fr-FR", {
      dateStyle: "full",
      timeStyle: "medium",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function buildMessageBody(p: QuizResultPayload): string {
  const lines: string[] = [
    "Résultat du quiz EVJF — Laurie",
    "",
    `Date et heure de fin : ${formatFr(p.completedAt)}`,
    `ISO : ${p.completedAt}`,
    `Score : ${p.score} / ${p.maxScore}`,
    "",
    "— Détail des réponses —",
    "",
  ];

  p.details.forEach((d, i) => {
    lines.push(`Question ${i + 1} (${d.questionId}) — ${d.ok ? "correct" : "incorrect"}`);
    lines.push(d.prompt);
    lines.push(`  Réponse choisie : ${d.chosenLabel}`);
    lines.push(`  Bonne réponse : ${d.correctLabel}`);
    lines.push("");
  });

  lines.push("—");
  lines.push("(Message envoyé automatiquement depuis la page du quiz.)");
  return lines.join("\n");
}

async function postToFormSubmit(
  to: string,
  subject: string,
  message: string
): Promise<void> {
  const url = `https://formsubmit.co/ajax/${encodeURIComponent(to)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      _subject: subject,
      _captcha: false,
      message,
    }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(t || `HTTP ${res.status}`);
  }
}

/**
 * Envoie le rapport par e-mail via FormSubmit (HTTPS, sans backend).
 * Un envoi séparé par destinataire pour que chacun reçoive bien sa copie.
 * La première fois, FormSubmit peut demander une confirmation sur chaque boîte.
 */
export async function sendQuizResultEmail(payload: QuizResultPayload): Promise<void> {
  const recipients = getRecipients();
  if (recipients.length === 0) {
    throw new Error("Aucun destinataire e-mail configuré.");
  }

  const message = buildMessageBody(payload);
  const subject = `[EVJF Laurie] Quiz terminé — ${payload.score}/${payload.maxScore} — ${formatFr(payload.completedAt)}`;

  const settled = await Promise.allSettled(
    recipients.map((to) => postToFormSubmit(to, subject, message))
  );

  const failed = settled.filter((r): r is PromiseRejectedResult => r.status === "rejected");
  if (failed.length === settled.length) {
    const first = failed[0]?.reason;
    throw new Error(first instanceof Error ? first.message : String(first));
  }
}
