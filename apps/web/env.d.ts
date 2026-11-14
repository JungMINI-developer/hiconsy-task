/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** API base URL. 비워두면 '/api' (dev: Vite proxy, docker: nginx proxy) */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
