import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

// Bundled locale resources.
import en from "./locales/en.json";

// Language configuration
export const languages = [
  { code: "en", name: "English", nativeName: "English", flag: "🇬🇧" },
] as const;

export type LanguageCode = (typeof languages)[number]["code"];

interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  flag: string;
}

// All translation resources
const resources = {
  en: { translation: en },
};

interface I18nConfig {
  /** Language storage key. */
  storageKey?: string;
  /** Detection fallback language. */
  fallbackLng?: LanguageCode;
  /** Enable debug mode */
  debug?: boolean;
}

/**
 * Initialize i18n with configuration
 */
export const initI18n = (config: I18nConfig = {}) => {
  const { storageKey = "app_language", fallbackLng = "en", debug = false } = config;

  i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng,
      defaultNS: "translation",

      // Language detection options
      detection: {
        order: ["localStorage", "navigator", "htmlTag"],
        caches: ["localStorage"],
        lookupLocalStorage: storageKey,
      },

      interpolation: {
        escapeValue: false, // React already escapes values
      },

      // React specific options
      react: {
        useSuspense: false,
        bindI18n: "languageChanged loaded",
        bindI18nStore: "added removed",
      },

      debug,
    });

  return i18n;
};

/**
 * Get current language info
 */
export const getCurrentLanguage = (): Language => {
  const code = i18n.language?.split("-")[0] || "en";
  return languages.find((l) => l.code === code) || languages[0];
};

/**
 * Change the current language
 */
export const changeLanguage = async (
  code: LanguageCode,
  storageKey = "app_language"
): Promise<void> => {
  await i18n.changeLanguage(code);
  localStorage.setItem(storageKey, code);
};

// Re-export useful items from react-i18next
export { useTranslation } from "react-i18next";
