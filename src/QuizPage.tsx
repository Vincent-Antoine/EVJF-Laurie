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
        width: "min(520px, 100%)",
        margin: "0 auto",
        padding: "clamp(1.25rem, 4vw, 2rem)",
      }}
    >
      <motion.header
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        style={{ textAlign: "center", marginBottom: "1.75rem" }}
      >
        <div
          style={{
            display: "inline-block",
            fontSize: "clamp(1.75rem, 5vw, 2.35rem)",
            fontWeight: 700,
            letterSpacing: "0.02em",
            color: "var(--evjf-text)",
          }}
        >
          Qu'as-tu compris de nos petites histoires contées par mail ces dernières semaines ?{" "}
        </div>
        <p
          style={{
            margin: "0.75rem 0 0",
            color: "var(--evjf-muted)",
            fontSize: "1.02rem",
            lineHeight: 1.45,
          }}
        >
          Quatre questions, trois choix, une seule tentative par question — et une seule partie
          pour toi. Attention retient bien tes réponses.
        </p>
      </motion.header>

      {!started && !blocked && !finished && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            borderRadius: "1.25rem",
            padding: "1.75rem",
            background: "var(--evjf-card)",
            border: "1px solid var(--evjf-border)",
            boxShadow: "var(--evjf-shadow)",
          }}
        >
          <p style={{ marginTop: 0, lineHeight: 1.5, color: "var(--evjf-text)" }}>
            Prête ? Une fois lancée, tu ne pourras pas recommencer le quiz depuis cet appareil.
          </p>
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStart}
            style={{
              marginTop: "1rem",
              width: "100%",
              padding: "0.95rem",
              fontSize: "1.05rem",
              fontWeight: 600,
              border: "none",
              borderRadius: "999px",
              cursor: "pointer",
              color: "#fff",
              background: "var(--evjf-accent)",
            }}
          >
            Commencer
          </motion.button>
        </motion.div>
      )}

      {started && !finished && q && (
        <motion.section
          key={q.id}
          initial={{ opacity: 0, x: 24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.45 }}
          style={{
            borderRadius: "1.25rem",
            padding: "1.5rem",
            background: "var(--evjf-card)",
            border: "1px solid var(--evjf-border)",
            boxShadow: "var(--evjf-shadow)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "baseline",
              marginBottom: "1rem",
              gap: "0.75rem",
            }}
          >
            <span style={{ fontSize: "0.85rem", color: "var(--evjf-muted)" }}>
              Question {questionIndex + 1} / {QUESTIONS.length}
            </span>
            <span style={{ fontSize: "0.85rem", color: "var(--evjf-muted)" }}>
              Score : {score}
            </span>
          </div>
          <h1
            style={{
              fontSize: "1.2rem",
              fontWeight: 600,
              margin: "0 0 1.25rem",
              lineHeight: 1.35,
            }}
          >
            {q.prompt}
          </h1>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
            {q.options.map((label, idx) => {
              const disabled = answeredForStep || !!feedback;
              return (
                <motion.button
                  key={idx}
                  type="button"
                  whileHover={disabled ? undefined : { x: 4 }}
                  whileTap={disabled ? undefined : { scale: 0.99 }}
                  disabled={disabled}
                  onClick={() => handlePick(idx)}
                  style={{
                    textAlign: "left",
                    padding: "0.85rem 1rem",
                    borderRadius: "0.85rem",
                    border: "1px solid var(--evjf-border)",
                    background: disabled ? "#f5f5f7" : "#fafafa",
                    color: "var(--evjf-text)",
                    fontSize: "1rem",
                    cursor: disabled ? "default" : "pointer",
                    opacity: disabled ? 0.55 : 1,
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
            borderRadius: "1.25rem",
            padding: "1.75rem",
            background: "var(--evjf-card)",
            border: "1px solid var(--evjf-border)",
            boxShadow: "var(--evjf-shadow)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.6rem",
              margin: "0 0 0.75rem",
              fontWeight: 700,
            }}
          >
            C’est dans la boîte !
          </h2>
          <p style={{ fontSize: "1.15rem", margin: "0 0 1rem", fontWeight: 600 }}>
            Ton score : {score} / {QUESTIONS.length}
          </p>
          <p style={{ margin: 0, lineHeight: 1.55, color: "var(--evjf-muted)" }}>
            {finalMessage(score)}
          </p>
          {mailStatus === "sending" && (
            <p style={{ margin: "1rem 0 0", fontSize: "0.95rem", color: "var(--evjf-muted)" }}>
              Envoi du récapitulatif à l’organisateur…
            </p>
          )}
          {mailStatus === "sent" && (
            <p style={{ margin: "1rem 0 0", fontSize: "0.95rem", color: "var(--evjf-muted)" }}>
              Le détail de ta partie a été envoyé par e-mail.
            </p>
          )}
          {mailStatus === "error" && (
            <p style={{ margin: "1rem 0 0", fontSize: "0.92rem", color: "#b91c1c" }}>
              L’envoi automatique a échoué (réseau ou blocage). Préviens l’organisateur si besoin.
            </p>
          )}
        </motion.section>
      )}

      {blocked && (
        <motion.section
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          style={{
            borderRadius: "1.25rem",
            padding: "1.75rem",
            background: "var(--evjf-card)",
            border: "1px solid var(--evjf-border)",
            boxShadow: "var(--evjf-shadow)",
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "1.5rem",
              margin: "0 0 0.75rem",
              fontWeight: 700,
            }}
          >
            Tu as déjà joué
          </h2>
          <p style={{ margin: 0, lineHeight: 1.55, color: "var(--evjf-muted)" }}>
            Une seule tentative est autorisée.
            {typeof localStorage.getItem("evjf_quiz_v1_score") === "string" && (
              <>
                {" "}
                Ton dernier score enregistré :{" "}
                <strong>
                  {localStorage.getItem("evjf_quiz_v1_score")} / {QUESTIONS.length}
                </strong>
                .
              </>
            )}
          </p>
        </motion.section>
      )}
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
