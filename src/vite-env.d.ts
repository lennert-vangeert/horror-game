/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_ENVIRONMENT?: "DEV" | "PRD"
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
