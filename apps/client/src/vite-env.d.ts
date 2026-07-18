/// <reference types="vite/client" />
/// <reference types="@react-three/fiber" />
/// <reference types="vite-plugin-svgr/client" />

interface ImportMetaEnv {
  readonly VITE_TRPC_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
