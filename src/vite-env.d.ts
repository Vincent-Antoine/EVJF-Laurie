/// <reference types="vite/client" />

interface ImportMetaEnv {
  /**
   * Liste d’e-mails séparés par des virgules (remplace les 3 destinataires par défaut).
   * Ex. : `a@x.com,b@x.com`
   */
  readonly VITE_RESULT_EMAIL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
