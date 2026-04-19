export type Question = {
  id: string;
  prompt: string;
  options: [string, string, string];
  correctIndex: 0 | 1 | 2;
};

/** Bonnes réponses : B, B, C, A (indices 1, 1, 2, 0). */
export const QUESTIONS: Question[] = [
  {
    id: "q1",
    prompt:
      'Pour briller dans cette aventure "internationale" en Alsace, quelle qualité va devoir primer chez toi ?',
    options: [
      "Une connaissance pointue de la géographie et des capitales mondiales.",
      "Une capacité légendaire à courir avec un objet insolite entre les mains.",
      "Un accent anglais irréprochable pour impressionner le jury.",
    ],
    correctIndex: 1,
  },
  {
    id: "q2",
    prompt:
      "Puisque Viviane nous ouvre la voie, quel sera l'outil principal de ton futur chef-d'œuvre ?",
    options: [
      "Un sécateur et une patience d'orfèvre pour dompter la nature.",
      "Un fil de fer caché qui fera tenir ton nouveau statut social.",
      "Une pelle et un arrosoir pour laisser une trace de ton passage.",
    ],
    correctIndex: 1,
  },
  {
    id: "q3",
    prompt:
      "Puisque nous serons guidées par toutes les facettes de ta personnalité, quel est l'ingrédient secret qui nous occupera jusqu'au bout de la nuit ?",
    options: [
      "Un cocktail de sérénité et une tisane relaxante pour débriefer de ta vie.",
      "Une réserve illimitée de pansements pour ampoules aux pieds.",
      "Un mélange improbable d'accessoires qui racontent tes 20 dernières années.",
    ],
    correctIndex: 2,
  },
  {
    id: "q4",
    prompt:
      'La question : dans ce "monde blanc", quel sera ton plus grand défi logistique ?',
    options: [
      "Réussir à ne pas glisser au moment de prendre la photo parfaite.",
      "Apprendre à respirer sous l'eau sans faire de bulles.",
      "Garder tes vêtements secs après une bataille acharnée.",
    ],
    correctIndex: 0,
  },
];
