import { AnimatePresence, motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useRef } from "react";

type ConfettiOpts = NonNullable<Parameters<typeof confetti>[0]>;

type Props = {
  open: boolean;
  isCorrect: boolean;
  imageSrc: string;
  continueLabel: string;
  /** Affiché uniquement si la réponse est bonne : rappel du libellé choisi. */
  chosenAnswerText?: string;
  onContinue: () => void;
};

function fireConfetti() {
  const count = 160;
  const defaults = { origin: { y: 0.72 }, zIndex: 60 };

  function shoot(partial: Partial<ConfettiOpts>) {
    confetti({ ...defaults, ...partial });
  }

  shoot({ particleCount: count, spread: 100, startVelocity: 38 });
  shoot({ particleCount: 55, angle: 55, spread: 50, scalar: 0.85 });
  shoot({ particleCount: 55, angle: 125, spread: 50, scalar: 0.85 });
  shoot({
    particleCount: 40,
    spread: 120,
    startVelocity: 28,
    ticks: 220,
    colors: ["#ff6b9d", "#ffd93d", "#6bcb77", "#4d96ff", "#c084fc"],
  });
}

export function FeedbackOverlay({
  open,
  isCorrect,
  imageSrc,
  continueLabel,
  chosenAnswerText,
  onContinue,
}: Props) {
  const confettiDone = useRef(false);

  useEffect(() => {
    if (!open) {
      confettiDone.current = false;
      return;
    }
    if (!isCorrect) return;
    if (confettiDone.current) return;
    confettiDone.current = true;
    const id = requestAnimationFrame(() => fireConfetti());
    return () => cancelAnimationFrame(id);
  }, [open, isCorrect]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 50,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.25rem",
            background: "rgba(255, 248, 242, 0.55)",
            backdropFilter: "blur(16px) saturate(1.2)",
            WebkitBackdropFilter: "blur(16px) saturate(1.2)",
          }}
        >
          <motion.div
            initial={{ scale: 0.88, opacity: 0, y: 24 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className="evjf-content-shell"
            style={{
              width: "min(420px, 100%)",
              textAlign: "center",
              padding: "clamp(1.35rem, 4vw, 1.75rem)",
            }}
          >
            <h2
              id="feedback-title"
              className="evjf-quiz-title"
              style={{
                fontSize: "clamp(1.35rem, 3.5vw, 1.5rem)",
                margin: "0 0 1rem",
                fontWeight: 700,
              }}
            >
              {isCorrect ? "Bravo !" : "Oups…"}
            </h2>

            {isCorrect && chosenAnswerText && (
              <motion.p
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.06 }}
                className="evjf-dim"
                style={{
                  margin: "0 0 1rem",
                  fontSize: "1rem",
                  lineHeight: 1.45,
                }}
              >
                Tu as choisi :{" "}
                <span style={{ fontWeight: 700, color: "var(--evjf-text)" }}>{chosenAnswerText}</span>
              </motion.p>
            )}

            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              style={{
                borderRadius: "1rem",
                overflow: "hidden",
                marginBottom: "1.25rem",
                border: "1px solid rgba(0, 31, 63, 0.1)",
              }}
            >
              <img
                src={imageSrc}
                alt=""
                style={{
                  width: "100%",
                  height: "auto",
                  display: "block",
                  verticalAlign: "middle",
                }}
              />
            </motion.div>
            <motion.button
              type="button"
              className="evjf-btn-primary"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={onContinue}
            >
              {continueLabel}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
