/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_APP_PROMPT_URL: string
}
interface ImportMeta {
  readonly env: ImportMetaEnv
}