import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Map as MapIcon,
  ShieldCheck,
  Users,
  ArrowRight,
  Mail,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Languages as LanguagesIcon,
  Check,
  ChevronDown,
  Factory,
  Ship,
  Recycle,
  Database,
  Sparkles,
  TrendingUp,
  Sliders,
  FileText,
  Building2,
  Network,
} from "lucide-react";
import { config } from "@/configuration/app";
import { getCSRFToken } from "@/utils/csrf";
import { PrivacyConsentDialog, PrivacyBanner } from "@/features/privacy-controls";
import { useTranslation, languages, changeLanguage, type LanguageCode } from "@/i18n";

const NAV = [
  { key: "challenge", href: "#challenge" },
  { key: "platform", href: "#platform" },
  { key: "infrastructure", href: "#infrastructure" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "personas", href: "#personas" },
  { key: "contact", href: "#contact" },
] as const;

// Icons only; text pulled from i18n by index.
const STEPS = [
  { icon: Building2 },
  { icon: Network },
  { icon: Sliders },
  { icon: FileText },
] as const;

// Warm-grey icon chip (base palette).
const CHIP = "text-[#1A1A1A] bg-[#D4D2D0] border-[#B0AAA4]";

const FOOTER_LINK = "text-white/70 hover:text-white transition-colors py-0.5";

// Platform capability cards (text: landing.features.f{n}Title/Desc).
const FEATURES = [
  { icon: MapIcon, color: CHIP },
  { icon: Network, color: CHIP },
  { icon: Sparkles, color: CHIP },
  { icon: Database, color: CHIP },
  { icon: TrendingUp, color: CHIP },
  { icon: Users, color: CHIP },
] as const;

// CCUS value-chain components (text: landing.infrastructure.c{n}...).
const COMPONENTS = [
  { icon: Factory },
  { icon: Ship },
  { icon: Database },
  { icon: Recycle },
] as const;

// Text pulled from i18n by index (landing.personas.p{n}Title/Desc).
const PERSONAS = [
  { icon: Building2, color: CHIP },
  { icon: Network, color: CHIP },
  { icon: Database, color: CHIP },
  { icon: ShieldCheck, color: CHIP },
] as const;

// Text pulled from i18n by index (landing.challenge.card{n}Title/Desc).
const CHALLENGE_CARDS = [
  { icon: Factory },
  { icon: Network },
  { icon: Database },
  { icon: TrendingUp },
] as const;

const CATEGORY_OPTIONS = [
  { value: "general", key: "general" },
  { value: "partnership", key: "partnership" },
  { value: "pilot", key: "pilot" },
  { value: "research", key: "research" },
  { value: "media", key: "media" },
] as const;

type Status = "idle" | "loading" | "success" | "error";

const LanguageMenu: React.FC = () => {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = i18n.language?.split("-")[0] || "en";
  const active = languages.find((l) => l.code === current) || languages[0];

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const pick = async (code: LanguageCode) => {
    await changeLanguage(code, "app_language");
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-white/70 hover:bg-[#D4D2D0] text-[#1A1A1A] text-xs font-semibold px-2.5 py-1.5 ring-1 ring-[#D4D2D0] transition-colors"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <LanguagesIcon className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{active.flag}</span>
        <span className="uppercase">{active.code}</span>
        <ChevronDown className="h-3 w-3 opacity-70" />
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 mt-2 w-44 rounded-xl bg-[#EDEAE7] border border-[#D4D2D0] shadow-2xl py-1 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
        >
          {languages.map((l) => (
            <button
              key={l.code}
              onClick={() => pick(l.code)}
              className={`w-full flex items-center justify-between px-3 py-2 text-left hover:bg-white/70 transition-colors ${
                l.code === active.code ? "text-[#1A1A1A] font-semibold bg-white/60" : "text-[#333333]"
              }`}
            >
              <span className="flex items-center gap-2">
                <span>{l.flag}</span>
                <span>{l.nativeName}</span>
              </span>
              {l.code === active.code && <Check className="h-3.5 w-3.5 text-[#1A1A1A]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default function LandingPage() {
  const { t } = useTranslation();
  const rootRef = useRef<HTMLDivElement>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [activeTech, setActiveTech] = useState(0);

  // Contact form state
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState<string>("general");
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // Privacy banner/dialog state
  const [consentOpen, setConsentOpen] = useState(false);
  const [consentAccepted, setConsentAccepted] = useState<boolean>(() => {
    return localStorage.getItem("privacy_accepted") === "true";
  });

  useEffect(() => {
    document.title = "STORCITO — CCUS Assessment & Route Optimization";
  }, []);

  // Reveal-on-scroll animation
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const els = root.querySelectorAll<HTMLElement>("[data-reveal]");
    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("opacity-100", "translate-y-0");
            e.target.classList.remove("opacity-0", "translate-y-6");
            obs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.1, root }
    );
    els.forEach((el) => {
      el.classList.add("transition-all", "duration-700", "ease-out", "opacity-0", "translate-y-6");
      obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !subject.trim() || !message.trim()) {
      setStatus("error");
      setErrorMessage(t("landing.contact.validationError"));
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    try {
      const csrfToken = await getCSRFToken();
      const response = await fetch(`${config.api.baseUrl}/feedback`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": csrfToken ?? "",
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          category,
          subject: subject.trim(),
          message: message.trim(),
          pageUrl: window.location.href,
        }),
      });

      if (!response.ok) {
        throw new Error(t("landing.contact.submitFailed"));
      }

      setStatus("success");
      setName("");
      setEmail("");
      setSubject("");
      setMessage("");
      setCategory("general");
    } catch (err: unknown) {
      setStatus("error");
      const msg = err instanceof Error ? err.message : t("landing.contact.genericError");
      setErrorMessage(msg);
    }
  };

  const handleAcceptConsent = () => {
    localStorage.setItem("privacy_accepted", "true");
    setConsentAccepted(true);
    setConsentOpen(false);
  };

  const handleDeclineConsent = () => {
    localStorage.setItem("privacy_accepted", "false");
    setConsentAccepted(false);
    setConsentOpen(false);
  };

  return (
    <div ref={rootRef} className="h-screen overflow-y-auto bg-[#EDEAE7] text-[#1A1A1A] scroll-smooth selection:bg-[#1A1A1A] selection:text-[#EDEAE7]">
      {/* Full-width nav bar */}
      <div className="fixed top-0 left-0 right-0 z-50 border-b border-[#D4D2D0] bg-white/90 backdrop-blur-md">
        <header className="mx-auto max-w-screen-2xl px-6 md:px-10 h-16 flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2.5 transition-transform hover:scale-[1.02]">
            <img src="/images/landing-page/storcito-logo-dark.webp" alt="STORCITO" className="h-7 w-auto" />
            <span className="h-4 w-[1.5px] bg-[#D4D2D0] rounded-full shrink-0" />
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[#1A1A1A]">
              CCUS Assessment
            </span>
          </a>

          <nav className="hidden lg:flex items-center gap-7">
            {NAV.map((n) => (
              <a
                key={n.href}
                href={n.href}
                className="text-xs font-semibold uppercase tracking-wider text-[#333333] hover:text-[#1A1A1A] transition-all relative py-1 after:absolute after:bottom-0 after:left-0 after:w-0 after:h-[2px] after:bg-[#1A1A1A] after:transition-all hover:after:w-full"
              >
                {t(`landing.nav.${n.key}`)}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <LanguageMenu />
            <Link
              to="/login"
              className="text-xs font-semibold text-[#333333] hover:text-[#1A1A1A] px-3 py-1.5 transition-colors"
            >
              {t("landing.nav.signIn")}
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#1A1A1A] hover:bg-[#333333] text-[#EDEAE7] text-xs font-bold px-4 py-2 shadow-lg shadow-[#B0AAA4]/40 transition-all hover:shadow-[#B0AAA4]/40"
            >
              <span>{t("landing.nav.tryItNow")}</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>
      </div>

      {/* Hero Section */}
      <section id="top" className="relative pt-28 pb-20 md:pt-36 md:pb-28 overflow-hidden bg-[#EDEAE7]">
        {/* Background CCUS Map Image overlay */}
        <div
          className="absolute inset-0 opacity-40 pointer-events-none bg-cover bg-top bg-no-repeat"
          style={{ backgroundImage: "url('/images/landing-page/ccus-transport-map.jpg')" }}
        />
        {/* Even off-white veil so the map reads as a subtle backdrop and fades into the page. */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#EDEAE7]/50 via-[#EDEAE7]/65 to-[#EDEAE7]" />

        <div className="relative mx-auto max-w-screen-xl px-6 md:px-10 text-center">
          <div data-reveal className="inline-flex items-center gap-2 rounded-full bg-[#D4D2D0] border border-[#B0AAA4] px-4 py-1.5 text-xs font-semibold text-[#1A1A1A] mb-6 backdrop-blur-sm">
            <span>{t("landing.hero.badge")}</span>
          </div>

          <h1 data-reveal className="text-4xl md:text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.15] max-w-5xl mx-auto">
            {t("landing.hero.title1")}{" "}
            <span className="bg-gradient-to-r from-[#6A5F94] via-[#4A3F6B] to-[#544B78] bg-clip-text text-transparent">
              {t("landing.hero.titleHighlight")}
            </span>
          </h1>

          <p data-reveal className="mt-6 text-base md:text-xl text-[#333333] max-w-3xl mx-auto leading-relaxed">
            {t("landing.hero.subtitle")}
          </p>

          <div data-reveal className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              to="/login"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#1A1A1A] hover:bg-[#333333] text-[#EDEAE7] font-bold px-7 py-3.5 text-base shadow-xl shadow-[#B0AAA4]/40 transition-all hover:scale-105"
            >
              <span>{t("landing.hero.getStarted")}</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
            <a
              href="#how-it-works"
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-white/70 hover:bg-white/80 border border-[#D4D2D0] text-[#1A1A1A] font-semibold px-7 py-3.5 text-base backdrop-blur-md transition-all hover:bg-[#D4D2D0]"
            >
              <span>{t("landing.hero.seeHow")}</span>
            </a>
          </div>

          {/* Key CCUS Metrics Strip */}
          <div data-reveal className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
            <div className="p-5 rounded-2xl bg-white/60 border border-[#D4D2D0] backdrop-blur-md text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A]">312+</div>
              <div className="text-xs text-[#333333] mt-1 uppercase tracking-wider font-medium">{t("landing.hero.metricSites")}</div>
            </div>
            <div className="p-5 rounded-2xl bg-white/60 border border-[#D4D2D0] backdrop-blur-md text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A]">1.1 Gt</div>
              <div className="text-xs text-[#333333] mt-1 uppercase tracking-wider font-medium">{t("landing.hero.metricStorage")}</div>
            </div>
            <div className="p-5 rounded-2xl bg-white/60 border border-[#D4D2D0] backdrop-blur-md text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A]">10,000+ km</div>
              <div className="text-xs text-[#333333] mt-1 uppercase tracking-wider font-medium">{t("landing.hero.metricNetwork")}</div>
            </div>
            <div className="p-5 rounded-2xl bg-white/60 border border-[#D4D2D0] backdrop-blur-md text-center">
              <div className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A]">€/t CO₂</div>
              <div className="text-xs text-[#333333] mt-1 uppercase tracking-wider font-medium">{t("landing.hero.metricCost")}</div>
            </div>
          </div>
        </div>
      </section>

      {/* The Decarbonization Challenge */}
      <section id="challenge" className="py-20 md:py-28 bg-[#EDEAE7] relative">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              {t("landing.challenge.eyebrow")}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A1A] mt-3">
              {t("landing.challenge.title")}
            </h2>
            <p className="text-base text-[#333333] mt-4 leading-relaxed">
              {t("landing.challenge.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {CHALLENGE_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={i}
                  data-reveal
                  className="p-6 rounded-2xl bg-gradient-to-b from-white/70 to-white/50 border border-[#D4D2D0] hover:border-[#B0AAA4] transition-all hover:-translate-y-1"
                >
                  <div className="w-12 h-12 rounded-xl bg-[#D4D2D0] border border-[#B0AAA4] flex items-center justify-center text-[#1A1A1A] mb-5">
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{t(`landing.challenge.card${i + 1}Title`)}</h3>
                  <p className="text-xs text-[#333333] leading-relaxed">{t(`landing.challenge.card${i + 1}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Platform Capabilities */}
      <section id="platform" className="py-20 md:py-28 bg-gradient-to-b from-[#EDEAE7] via-[#D4D2D0] to-[#EDEAE7] relative">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              {t("landing.features.label")}
            </span>
            <h2 className="text-3xl md:text-5xl font-extrabold text-[#1A1A1A] mt-3">
              {t("landing.features.title")}
            </h2>
            <p className="text-base text-[#333333] mt-4">
              {t("landing.features.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f, i) => {
              const Icon = f.icon;
              return (
                <div
                  key={i}
                  data-reveal
                  className="p-7 rounded-2xl bg-white/60 border border-[#D4D2D0] hover:border-[#B0AAA4] transition-all"
                >
                  <div className={`w-10 h-10 rounded-lg border flex items-center justify-center mb-4 ${f.color}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-xl font-bold text-[#1A1A1A] mb-2">{t(`landing.features.f${i + 1}Title`)}</h3>
                  <p className="text-sm text-[#333333] leading-relaxed">{t(`landing.features.f${i + 1}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CCUS Infrastructure Components */}
      <section id="infrastructure" className="py-20 md:py-28 bg-[#EDEAE7]">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-14">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              {t("landing.infrastructure.eyebrow")}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A1A] mt-3">
              {t("landing.infrastructure.title")}
            </h2>
            <p className="text-base text-[#333333] mt-4">
              {t("landing.infrastructure.description")}
            </p>
          </div>

          {/* Value-chain selector tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-12">
            {COMPONENTS.map((c, i) => {
              const Icon = c.icon;
              return (
                <button
                  key={i}
                  onClick={() => setActiveTech(i)}
                  className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-xs uppercase tracking-wider transition-all ${
                    activeTech === i
                      ? "bg-[#4A3F6B] text-white shadow-lg shadow-[#4A3F6B]/40"
                      : "bg-white/60 hover:bg-white/70 text-[#333333] border border-[#D4D2D0]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{t(`landing.infrastructure.c${i + 1}Title`)}</span>
                </button>
              );
            })}
          </div>

          {/* Selected component card */}
          {COMPONENTS[activeTech] && (
            <div className="p-8 md:p-12 rounded-3xl bg-gradient-to-br from-white/70 to-white/50 border border-[#D4D2D0] max-w-4xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1A1A1A]">
                    {t(`landing.infrastructure.c${activeTech + 1}Subtitle`)}
                  </span>
                  <h3 className="text-2xl md:text-3xl font-extrabold text-[#1A1A1A] mt-2">
                    {t(`landing.infrastructure.c${activeTech + 1}Title`)}
                  </h3>
                  <p className="mt-4 text-sm text-[#333333] leading-relaxed">
                    {t(`landing.infrastructure.c${activeTech + 1}Desc`)}
                  </p>
                </div>

                <div className="space-y-3 bg-[#D4D2D0]/60 p-6 rounded-2xl border border-[#D4D2D0]">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-3 text-xs text-[#333333] font-medium">
                      <div className="w-5 h-5 rounded-full bg-[#D4D2D0] text-[#1A1A1A] flex items-center justify-center shrink-0">
                        <Check className="w-3.5 h-3.5" />
                      </div>
                      <span>{t(`landing.infrastructure.c${activeTech + 1}Spec${n}`)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* How it Works Workflow */}
      <section id="how-it-works" className="py-20 md:py-28 bg-gradient-to-b from-[#EDEAE7] via-[#D4D2D0] to-[#EDEAE7]">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              {t("landing.howItWorks.label")}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A1A] mt-3">
              {t("landing.howItWorks.title")}
            </h2>
            <p className="text-base text-[#333333] mt-4">
              {t("landing.howItWorks.description")}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div
                  key={i}
                  onClick={() => setActiveStep(i)}
                  className={`cursor-pointer p-6 rounded-2xl border transition-all ${
                    activeStep === i
                      ? "bg-[#4A3F6B]/10 border-[#4A3F6B] text-[#1A1A1A] shadow-xl shadow-[#4A3F6B]/20"
                      : "bg-white/60 border-[#D4D2D0] hover:border-[#D4D2D0] text-[#333333]"
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-[#D4D2D0] text-[#1A1A1A] flex items-center justify-center mb-4">
                    <Icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-base font-bold text-[#1A1A1A] mb-2">{t(`landing.howItWorks.s${i + 1}Title`)}</h3>
                  <p className="text-xs text-[#333333] leading-relaxed">{t(`landing.howItWorks.s${i + 1}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Who it's for (Personas) */}
      <section id="personas" className="py-20 md:py-28 bg-[#EDEAE7]">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
              {t("landing.personas.eyebrow")}
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#1A1A1A] mt-3">
              {t("landing.personas.title")}
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {PERSONAS.map((p, i) => {
              const Icon = p.icon;
              return (
                <div key={i} data-reveal className="p-7 rounded-2xl bg-white/60 border border-[#D4D2D0]">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.color} mb-5`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-bold text-[#1A1A1A] mb-2">{t(`landing.personas.p${i + 1}Title`)}</h3>
                  <p className="text-xs text-[#333333] leading-relaxed">{t(`landing.personas.p${i + 1}Desc`)}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* EU Research & Trust */}
      <section className="py-16 bg-gradient-to-br from-[#544B78] to-[#38304F] border-y border-[#4A3F6B]">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10 flex flex-col md:flex-row items-center justify-between gap-8 text-center md:text-left">
          <div className="flex items-center gap-5">
            <img src="/images/landing-page/eu-funded.webp" alt="EU Funded" className="h-12 w-auto shrink-0" />
            <div>
              <h3 className="text-lg font-bold text-white">{t("landing.trust.euTitle")}</h3>
              <p className="text-xs text-white/70 max-w-2xl mt-1 leading-relaxed">
                {t("landing.trust.euDescription")}
              </p>
            </div>
          </div>

          <Link
            to="/login"
            className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-[#EDEAE7] hover:bg-white text-[#1A1A1A] font-bold px-6 py-3 text-xs uppercase tracking-wider transition-all"
          >
            <span>{t("landing.hero.getStarted")}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="py-20 md:py-28 bg-[#EDEAE7]">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10">
          <div className="max-w-3xl mx-auto rounded-3xl bg-white/60 border border-[#D4D2D0] p-8 md:p-12 backdrop-blur-md">
            <div className="text-center mb-10">
              <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#1A1A1A]">
                {t("landing.contact.label")}
              </span>
              <h2 className="text-3xl font-extrabold text-[#1A1A1A] mt-2">
                {t("landing.contact.title")}
              </h2>
              <p className="text-xs text-[#333333] mt-3">
                {t("landing.contact.description")}
              </p>
            </div>

            <form onSubmit={handleContactSubmit} className="space-y-4">
              {status === "error" && (
                <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#D4D2D0] border border-[#B0AAA4] text-[#1A1A1A] text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage || t("landing.contact.genericError")}</span>
                </div>
              )}

              {status === "success" && (
                <div className="flex items-center gap-2.5 p-4 rounded-xl bg-[#D4D2D0] border border-[#B0AAA4] text-[#1A1A1A] text-xs">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t("landing.contact.successText")}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1.5">{t("landing.contact.name")}</label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t("landing.contact.namePlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-[#D4D2D0] text-[#1A1A1A] text-xs placeholder:text-[#B0AAA4] focus:outline-none focus:border-[#1A1A1A] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1.5">{t("landing.contact.email")}</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t("landing.contact.emailPlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-[#D4D2D0] text-[#1A1A1A] text-xs placeholder:text-[#B0AAA4] focus:outline-none focus:border-[#1A1A1A] transition-colors"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1.5">{t("landing.contact.category")}</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl bg-[#EDEAE7] border border-[#D4D2D0] text-[#1A1A1A] text-xs focus:outline-none focus:border-[#1A1A1A] transition-colors"
                  >
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {t(`landing.contact.categories.${cat.key}`)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[#333333] mb-1.5">{t("landing.contact.subject")}</label>
                  <input
                    type="text"
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    placeholder={t("landing.contact.subjectPlaceholder")}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/60 border border-[#D4D2D0] text-[#1A1A1A] text-xs placeholder:text-[#B0AAA4] focus:outline-none focus:border-[#1A1A1A] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-[#333333] mb-1.5">{t("landing.contact.message")}</label>
                <textarea
                  rows={4}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={t("landing.contact.messagePlaceholder")}
                  className="w-full px-4 py-3 rounded-xl bg-white/60 border border-[#D4D2D0] text-[#1A1A1A] text-xs placeholder:text-[#B0AAA4] focus:outline-none focus:border-[#1A1A1A] transition-colors resize-none"
                />
              </div>

              <button
                type="submit"
                disabled={status === "loading"}
                className="w-full inline-flex items-center justify-center gap-2 py-3 px-6 rounded-xl bg-[#1A1A1A] hover:bg-[#333333] text-[#EDEAE7] font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#B0AAA4]/40 transition-all hover:shadow-[#B0AAA4]/40 disabled:opacity-50"
              >
                {status === "loading" ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t("landing.contact.sending")}</span>
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    <span>{t("landing.contact.send")}</span>
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#4A3F6B] bg-gradient-to-br from-[#544B78] to-[#38304F] text-white relative z-10">
        <div className="mx-auto max-w-screen-xl px-6 md:px-10 py-14 grid gap-12 md:grid-cols-3 items-start">
          {/* Brand */}
          <div className="space-y-4">
            <img
              src="/images/landing-page/storcito-logo-white.webp"
              alt="STORCITO"
              className="h-8 w-auto"
            />
            <p className="max-w-xs text-sm leading-relaxed text-white/70">
              {t("landing.footer.tagline")}
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-col gap-3 text-sm">
            <Link to="/privacy" className={FOOTER_LINK}>{t("landing.footer.privacyPolicy")}</Link>
            <Link to="/legal" className={FOOTER_LINK}>{t("landing.footer.cookies")}</Link>
            <Link to="/impressum" className={FOOTER_LINK}>{t("landing.footer.impressum")}</Link>
            <Link to="/terms-and-conditions" className={FOOTER_LINK}>{t("landing.footer.terms")}</Link>
            <button type="button" onClick={() => setConsentOpen(true)} className={`${FOOTER_LINK} text-left`}>
              {t("landing.footer.privacySettings")}
            </button>
          </div>

          {/* EU funding */}
          <div className="space-y-4">
            <img
              src="/images/landing-page/eu-funded.webp"
              alt={t("landing.footer.euFundedAlt")}
              className="h-12 w-auto rounded bg-white p-1"
            />
            <p className="text-[11px] leading-relaxed text-white/55">
              {t("landing.footer.euDisclaimer")}
            </p>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 bg-black/15">
          <div className="mx-auto flex max-w-screen-xl flex-wrap items-center justify-between gap-4 px-6 md:px-10 py-6 text-xs text-white/50">
            <span>© {new Date().getFullYear()} {t("landing.footer.copyright")}</span>
            <span>{t("landing.footer.builtOn")}</span>
          </div>
        </div>
      </footer>

      {/* Privacy Consent Dialog & Banner */}
      {!consentAccepted && (
        <PrivacyBanner onClick={() => setConsentOpen(true)} hasAccepted={consentAccepted} />
      )}
      <PrivacyConsentDialog
        isOpen={consentOpen}
        onClose={() => setConsentOpen(false)}
        onAccept={handleAcceptConsent}
        onDeny={handleDeclineConsent}
      />
    </div>
  );
}
