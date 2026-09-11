/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CARTO_BASEMAP_API_KEY?: string;
  readonly VITE_DUMMY_DATES?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS module typing
declare module "*.module.css" {
  const classes: { readonly [key: string]: string };
  export default classes;
}

declare module "*.module.scss" {
  const classes: { readonly [key: string]: string };
  export default classes;
}
