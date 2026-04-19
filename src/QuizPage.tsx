import { motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatedBackground } from "./components/AnimatedBackground";
import { FeedbackOverlay } from "./components/FeedbackOverlay";
import { sendQuizResultEmail, type QuestionAnswerDetail } from "./sendResultEmail";
import type { Question } from "./quizData";
import { QUESTIONS } from "./quizData";
import {
  clearProgress,
  isQuizCompleted,
  loadProgress,
  markQuizCompleted,
  saveProgress,
  type QuizProgress,
} from "./storage";

const IMG_GOOD = "/upload/good_two.png";
const IMG_BAD = "/upload/bad_two.png";

/** Pilules vert / bleu / violet + fond léger (inchangé). */
const OPTION_PILL_STYLES: { border: string; background: string }[] = [
  { border: "2px solid #22b86a", background: "rgba(34, 184, 106, 0.14)" },
  { border: "2px solid #3b82f6", background: "rgba(59, 130, 246, 0.12)" },
  { border: "2px solid #9333ea", background: "rgba(147, 51, 234, 0.11)" },
];

function answerDetail(q: Question, choiceIndex: number): QuestionAnswerDetail {
  return {
    questionId: q.id,
    prompt: q.prompt,
    chosenIndex: choiceIndex,
    chosenLabel: q.options[choiceIndex],
    correctIndex: q.correctIndex,
    correctLabel: q.options[q.correctIndex],
    ok: choiceIndex === q.correctIndex,
  };
}

function finalMessage(score: number): string {
  if (score >= 3) {
    return "Bravo, très belles déductions ! Rendez-vous dans quelques jours pour découvrir ce que nous t’avons préparé…";
  }
  return "Bonnes pistes ! Mais il faudra attendre encore quelques jours pour découvrir à quelle sauce tu seras mangée …";
}

export default function QuizPage() {
  const [blocked, setBlocked] = useState(false);
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [answeredForStep, setAnsweredForStep] = useState(false);
  const [feedback, setFeedback] = useState<
    null | { ok: boolean; scoreAfter: number; chosenLabel?: string }
  >(null);
  const [finished, setFinished] = useState(false);
  const [mailStatus, setMailStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  const sessionAnswersRef = useRef<QuestionAnswerDetail[]>([]);

  useEffect(() => {
    if (isQuizCompleted()) {
      setBlocked(true);
      const s = localStorage.getItem("evjf_quiz_v1_score");
      if (s != null) setScore(Number(s) || 0);
      return;
    }
    const p = loadProgress();
    if (!p) return;
    setStarted(true);
    setQuestionIndex(p.questionIndex);
    setScore(p.score);
    const current = QUESTIONS[p.questionIndex];
    const hasAnswered = !!current && p.answeredIds.includes(current.id);
    setAnsweredForStep(hasAnswered);
    if (p.pending && current && p.pending.questionId === current.id) {
      setFeedback({
        ok: p.pending.ok,
        scoreAfter: p.score,
        chosenLabel: p.pending.chosenLabel,
      });
    }
  }, []);

  const q = QUESTIONS[questionIndex];

  const persistFull = useCallback(
    (
      patch: Partial<QuizProgress> &
        Pick<QuizProgress, "questionIndex" | "score" | "answeredIds">
    ) => {
      const full: QuizProgress = {
        questionIndex: patch.questionIndex,
        score: patch.score,
        answeredIds: patch.answeredIds,
        pending: patch.pending === undefined ? null : patch.pending,
      };
      saveProgress(full);
    },
    []
  );

  const handleStart = () => {
    sessionAnswersRef.current = [];
    setStarted(true);
    persistFull({
      questionIndex: 0,
      score: 0,
      answeredIds: [],
      pending: null,
    });
  };

  const handlePick = (choiceIndex: number) => {
    if (!q || answeredForStep || feedback) return;
    const ok = choiceIndex === q.correctIndex;
    const nextScore = score + (ok ? 1 : 0);
    setAnsweredForStep(true);
    setScore(nextScore);
    sessionAnswersRef.current.push(answerDetail(q, choiceIndex));
    const answeredIds = Array.from(new Set([...(loadProgress()?.answeredIds ?? []), q.id]));
    setFeedback({
      ok,
      scoreAfter: nextScore,
      ...(ok ? { chosenLabel: q.options[choiceIndex] } : {}),
    });
    persistFull({
      questionIndex,
      score: nextScore,
      answeredIds,
      pending: {
        questionId: q.id,
        ok,
        ...(ok ? { chosenLabel: q.options[choiceIndex] } : {}),
      },
    });
  };

  const handleContinue = () => {
    const p = loadProgress();
    const currentScore = feedback?.scoreAfter ?? p?.score ?? score;

    setFeedback(null);

    if (questionIndex >= QUESTIONS.length - 1) {
      try {
        localStorage.setItem("evjf_quiz_v1_score", String(currentScore));
      } catch {
        /* ignore */
      }
      const completedAt = new Date().toISOString();
      const report = {
        completedAt,
        score: currentScore,
        maxScore: QUESTIONS.length,
        details: [...sessionAnswersRef.current],
      };
      setScore(currentScore);
      markQuizCompleted();
      clearProgress();
      setFinished(true);
      setMailStatus("sending");
      void sendQuizResultEmail(report)
        .then(() => setMailStatus("sent"))
        .catch(() => setMailStatus("error"));
      return;
    }

    const next = questionIndex + 1;
    setQuestionIndex(next);
    setAnsweredForStep(false);
    persistFull({
      questionIndex: next,
      score: currentScore,
      answeredIds: p?.answeredIds ?? [],
      pending: null,
    });
  };

  const overlaySrc = feedback?.ok ? IMG_GOOD : IMG_BAD;
  const isLastQuestion = questionIndex >= QUESTIONS.length - 1;
  const continueLabel = isLastQuestion ? "Voir le résultat" : "Question suivante";

  const formBlock = (
    <motion.main
      initial={{ opacity: 0, y: 28 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
      style={{
        position: "relative",
        zIndex: 10,
        width: "100%",
        maxWidth: "min(520px, 100%)",
        margin: "0 auto",
        padding: "clamp(1rem, 4vw, 1.75rem)",
      }}
    >
      <div className="evjf-content-shell" style={{ position: "relative" }}>
        <motion.header
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          style={{ textAlign: "center", marginBottom: 0 }}
        >
          <h1
            className="evjf-quiz-title"
            style={{
              margin: 0,
              maxWidth: "28ch",
              marginLeft: "auto",
              marginRight: "auto",
              fontSize: "clamp(1.15rem, 4.2vw, 1.55rem)",
            }}
          >
            Qu'as-tu compris de nos petites histoires contées par mail ces dernières semaines ?
          </h1>
          <p
            className="evjf-quiz-sub"
            style={{
              margin: "1rem 0 0",
              fontSize: "clamp(0.88rem, 2.3vw, 0.98rem)",
              lineHeight: 1.55,
              maxWidth: "38rem",
              marginLeft: "auto",
              marginRight: "auto",
            }}
          >
            Quatre questions, trois choix, une seule tentative par question — et une seule partie
            pour toi. Attention retient bien tes réponses.
          </p>
        </motion.header>

        {!started && !blocked && !finished && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.45 }}
            style={{ marginTop: "1.5rem" }}
          >
            <p
              className="evjf-body-text"
              style={{ margin: 0, lineHeight: 1.55, textAlign: "center", fontWeight: 500 }}
            >
              Prête ? Une fois lancée, tu ne pourras pas recommencer le quiz depuis cet appareil.
            </p>
            <motion.button
              type="button"
              className="evjf-btn-primary"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleStart}
              style={{ marginTop: "1.15rem" }}
            >
              Commencer
            </motion.button>
          </motion.div>
        )}

        {started && !finished && q && (
          <motion.section
            key={q.id}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            style={{
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(0, 31, 63, 0.1)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: "1.05rem",
                gap: "0.75rem",
                fontSize: "0.82rem",
                color: "var(--evjf-muted)",
                fontWeight: 600,
              }}
            >
              <span>
                Question {questionIndex + 1} / {QUESTIONS.length}
              </span>
              <span>Score : {score}</span>
            </div>
            <p
              className="evjf-question-prompt"
              style={{
                fontSize: "clamp(0.98rem, 2.8vw, 1.1rem)",
                margin: "0 0 1.15rem",
              }}
            >
              {q.prompt}
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.7rem" }}>
              {q.options.map((label, idx) => {
                const disabled = answeredForStep || !!feedback;
                const pill = OPTION_PILL_STYLES[idx % OPTION_PILL_STYLES.length];
                return (
                  <motion.button
                    key={idx}
                    type="button"
                    className="evjf-option-pill"
                    whileHover={disabled ? undefined : { x: 4 }}
                    whileTap={disabled ? undefined : { scale: 0.99 }}
                    disabled={disabled}
                    onClick={() => handlePick(idx)}
                    style={{
                      border: disabled ? "2px solid rgba(0, 31, 63, 0.12)" : pill.border,
                      background: disabled ? "rgba(0, 31, 63, 0.045)" : pill.background,
                      color: "var(--evjf-text)",
                      cursor: disabled ? "default" : "pointer",
                      opacity: disabled ? 0.52 : 1,
                      fontWeight: 500,
                      boxShadow: disabled ? "none" : "0 1px 3px rgba(0, 31, 63, 0.06)",
                    }}
                  >
                    {label}
                  </motion.button>
                );
              })}
            </div>
          </motion.section>
        )}

        {finished && (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(0, 31, 63, 0.1)",
              textAlign: "center",
            }}
          >
            <h2
              className="evjf-quiz-title"
              style={{
                fontSize: "clamp(1.25rem, 3.8vw, 1.5rem)",
                margin: "0 0 0.65rem",
                fontWeight: 700,
              }}
            >
              C’est dans la boîte !
            </h2>
            <p className="evjf-body-text" style={{ fontSize: "1.05rem", margin: "0 0 0.85rem", fontWeight: 600 }}>
              Ton score : {score} / {QUESTIONS.length}
            </p>
            <p className="evjf-dim" style={{ margin: 0, lineHeight: 1.55 }}>
              {finalMessage(score)}
            </p>
            {mailStatus === "sending" && (
              <p className="evjf-dim" style={{ margin: "1rem 0 0", fontSize: "0.92rem" }}>
                Envoi du récapitulatif à l’organisateur…
              </p>
            )}
            {mailStatus === "sent" && (
              <p className="evjf-dim" style={{ margin: "1rem 0 0", fontSize: "0.92rem" }}>
                Le détail de ta partie a été envoyé par e-mail à tes superbes témoins.
              </p>
            )}
            {mailStatus === "error" && (
              <p style={{ margin: "1rem 0 0", fontSize: "0.9rem", color: "#b91c1c" }}>
                L’envoi automatique a échoué (réseau ou blocage). Préviens l’organisateur si besoin.
              </p>
            )}
          </motion.section>
        )}

        {blocked && (
          <motion.section
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            style={{
              marginTop: "1.5rem",
              paddingTop: "1.5rem",
              borderTop: "1px solid rgba(0, 31, 63, 0.1)",
              textAlign: "center",
            }}
          >
            <h2
              className="evjf-quiz-title"
              style={{
                fontSize: "clamp(1.2rem, 3.5vw, 1.4rem)",
                margin: "0 0 0.65rem",
                fontWeight: 700,
              }}
            >
              Tu as déjà joué
            </h2>
            <p className="evjf-dim" style={{ margin: 0, lineHeight: 1.55 }}>
              Une seule tentative est autorisée.
              {typeof localStorage.getItem("evjf_quiz_v1_score") === "string" && (
                <>
                  {" "}
                  Ton dernier score enregistré :{" "}
                  <strong style={{ color: "var(--evjf-text)" }}>
                    {localStorage.getItem("evjf_quiz_v1_score")} / {QUESTIONS.length}
                  </strong>
                  .
                </>
              )}
            </p>
          </motion.section>
        )}
      </div>
    </motion.main>
  );

  return (
    <div style={{ position: "relative", minHeight: "100vh", paddingBottom: "2rem" }}>
      <AnimatedBackground />
      <div
        style={{
          position: "relative",
          zIndex: 10,
          isolation: "isolate",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "1rem",
        }}
      >
        {formBlock}
      </div>

      <FeedbackOverlay
        open={!!feedback}
        isCorrect={feedback?.ok ?? false}
        imageSrc={overlaySrc}
        continueLabel={continueLabel}
        chosenAnswerText={feedback?.chosenLabel}
        onContinue={handleContinue}
      />
    </div>
  );
}
