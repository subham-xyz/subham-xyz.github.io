/// <reference types="astro/client" />
declare module 'utif';
declare module 'gifenc';

interface ImportMetaEnv {
  /** Public Web3Forms access key for the feedback form (set in .env, not committed). */
  readonly PUBLIC_WEB3FORMS_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
