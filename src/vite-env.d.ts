/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_TCL_API_URL?: string;
  readonly VITE_TCL_RELAY_CONFIGURED: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
