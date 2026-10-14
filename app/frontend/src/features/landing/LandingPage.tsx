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
  { key: "platform", href: "#platform" },
  { key: "howItWorks", href: "#how-it-works" },
  { key: "contact", href: "#contact" },
] as const;

// Icons only.
const STEPS = [
  { icon: Building2 },
  { icon: Network },
  { icon: Sliders },
  { icon: FileText },
] as const;

const EU_LOGO = "/images/landing-page/eu-funded.webp";

// Type scale.
const EYEBROW = "block font-bold text-[10px] tracking-[0.4em] uppercase text-[#1A1A1A]/50";
const H2 = "text-3xl md:text-4xl font-black tracking-tighter uppercase leading-none text-[#1A1A1A]";
const DOTS = "bg-[radial-gradient(circle,#D4D2D0_1px,transparent_1px)] bg-[size:40px_40px]";
const BAND = "bg-gradient-to-br from-[#544B78] to-[#38304F] text-white";
const BUTTON = "inline-flex items-center justify-center gap-2 px-6 py-3 font-black uppercase text-[11px] tracking-widest transition-all";
const FIELD = "w-full px-4 py-3 bg-white border border-[#D4D2D0] text-[#1A1A1A] text-[13px] placeholder:text-[#B0AAA4] focus:outline-none focus:border-[#1A1A1A] transition-colors";
const LABEL = "block font-bold text-[10px] uppercase tracking-widest text-[#1A1A1A]/50 mb-2";

const FOOTER_LINK = "text-[11px] font-semibold uppercase tracking-widest text-white/60 hover:text-white transition-colors py-0.5";

// Section heading.
const SectionHead: React.FC<{ eyebrow: string; title: string; description?: string }> = ({ eyebrow, title, description }) => (
  <div className="mb-16 flex flex-col md:flex-row md:items-end justify-between gap-8">
    <div className="max-w-2xl">
      <span className={EYEBROW}>{eyebrow}</span>
      <h2 className={`${H2} mt-4`}>{title}</h2>
    </div>
    {description && <p className="text-sm text-[#333333] max-w-sm leading-relaxed">{description}</p>}
  </div>
);

// Capability cards.
const FEATURES = [
  { icon: MapIcon },
  { icon: Network },
  { icon: Sparkles },
  { icon: Database },
  { icon: TrendingUp },
  { icon: Users },
] as const;

// Value-chain stages.
const COMPONENTS = [
  { icon: Factory },
  { icon: Ship },
  { icon: Database },
  { icon: Recycle },
] as const;

// Icons only.
const PERSONAS = [
  { icon: Building2 },
  { icon: Network },
  { icon: Database },
  { icon: ShieldCheck },
] as const;

// Icons only.
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
        className="inline-flex items-center gap-1.5 bg-white/70 hover:bg-[#D4D2D0] text-[#1A1A1A] text-xs font-semibold px-2.5 py-1.5 ring-1 ring-[#D4D2D0] transition-colors"
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
          className="absolute right-0 mt-2 w-44 bg-[#EDEAE7] border border-[#D4D2D0] shadow-2xl py-1 z-50 text-xs animate-in fade-in slide-in-from-top-2 duration-200"
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
  const euAlt = t("landing.footer.euFundedAlt");

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
    <div ref={rootRef} className={`h-screen overflow-y-auto bg-[#EDEAE7] text-[#1A1A1A] scroll-smooth selection:bg-[#1A1A1A] selection:text-[#EDEAE7] ${DOTS}`}>
      {/* Nav bar. */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-[#EDEAE7]/95 backdrop-blur-md border-b border-[#1A1A1A]/15">
        <div className="grid grid-cols-2 md:grid-cols-3 items-center w-full px-6 md:px-8 h-16">
          <a href="#top" className="flex items-center" aria-label="STORCITO">
            <img src="/images/landing-page/storcito-logo-dark.webp" alt="STORCITO" className="h-8 w-auto" />
          </a>

          <div className="hidden md:flex justify-center">
            <a href="#top" className="text-2xl lg:text-3xl font-black tracking-tighter uppercase leading-none text-[#1A1A1A] select-none whitespace-nowrap">
              CCUS Assessment
            </a>
          </div>

          <div className="flex justify-end items-center gap-6 h-full">
            <nav className="hidden xl:flex items-center gap-6 h-full">
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="font-semibold text-[0.875rem] tracking-tight uppercase text-[#1A1A1A]/60 hover:text-[#1A1A1A] transition-colors whitespace-nowrap"
                >
                  {t(`landing.nav.${n.key}`)}
                </a>
              ))}
            </nav>
            <LanguageMenu />
            <Link
              to="/login"
              className="font-semibold text-[0.875rem] tracking-tight uppercase text-[#1A1A1A] border-b-2 border-[#1A1A1A] pb-0.5 whitespace-nowrap"
            >
              {t("landing.nav.signIn")}
            </Link>
          </div>
        </div>
      </header>

      <main className="pt-16">
        {/* Hero. */}
        <section id="top" className="relative flex w-full flex-col md:flex-row min-h-[calc(100vh-4rem)] overflow-hidden bg-[#EDEAE7]">
          <div className="relative z-10 flex w-full flex-col justify-center p-8 md:w-1/2 md:p-12 lg:w-3/5 lg:p-16">
            <div>
              <h1 data-reveal className="text-4xl md:text-5xl font-bold leading-tight text-[#1A1A1A] max-w-2xl">
                {t("landing.hero.title1")}{" "}
                <span className="bg-gradient-to-r from-[#6A5F94] via-[#4A3F6B] to-[#544B78] bg-clip-text text-transparent">
                  {t("landing.hero.titleHighlight")}
                </span>
              </h1>
              <div data-reveal className="my-6 h-1 w-20 bg-[#4A3F6B]" />
              <p data-reveal className="mb-8 max-w-md text-base text-[#333333] leading-relaxed">
                {t("landing.hero.subtitle")}
              </p>

              <div data-reveal className="flex flex-wrap gap-3">
                <Link to="/login" className={`${BUTTON} bg-[#1A1A1A] hover:bg-[#333333] text-[#EDEAE7]`}>
                  <span>{t("landing.hero.getStarted")}</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#how-it-works" className={`${BUTTON} border border-[#1A1A1A] text-[#1A1A1A] hover:bg-[#1A1A1A] hover:text-[#EDEAE7]`}>
                  {t("landing.hero.seeHow")}
                </a>
              </div>
            </div>

            {/* Metrics strip. */}
            <div data-reveal className="mt-16 lg:mt-24 2xl:mt-32 pt-8 border-t border-[#1A1A1A]/10">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-[#D4D2D0] border border-[#D4D2D0]">
                {[
                  ["14,600+", "metricSites"],
                  ["608 Mt", "metricStorage"],
                  ["3,800+", "metricNetwork"],
                  ["3", "metricCost"],
                ].map(([value, key]) => (
                  <div key={key} className="bg-white p-5">
                    <p className="font-black text-xl tracking-tight text-[#1A1A1A]">{value}</p>
                    <p className="font-bold text-[10px] uppercase tracking-widest text-[#1A1A1A]/50 mt-1">{t(`landing.hero.${key}`)}</p>
                  </div>
                ))}
              </div>
              <img src={EU_LOGO} alt={euAlt} className="mt-6 h-10 w-auto" />
            </div>
          </div>

          {/* Route map. */}
          <div className="relative w-full min-h-[300px] md:w-1/2 md:min-h-full lg:w-2/5 bg-[#D4D2D0] md:animate-[hero-clip_1.2s_cubic-bezier(0,0.55,0.45,1)_both] md:[clip-path:polygon(25%_0,100%_0,100%_100%,0%_100%)]">
            <img
              src="/images/landing-page/ccus-transport-map.jpg"
              alt=""
              aria-hidden="true"
              className="absolute inset-0 h-full w-full object-cover object-[35%_center] pointer-events-none select-none"
            />
            {/* Fade into scene. */}
            <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-b from-[#EDEAE700] via-[#EDEAE7cc] to-[#EDEAE7]" />
          </div>
        </section>

        {/* Straddles hero edge. */}
        <div className="relative h-0 pointer-events-none select-none" aria-hidden="true">
          <div className="absolute left-0 right-0 top-0 aspect-[12/5] -translate-y-[88%] overflow-hidden opacity-40">
            <img src="/images/landing-page/co2-transport-hero.svg" alt="" className="absolute bottom-0 left-0 w-full aspect-[12/7]" />
          </div>
        </div>

        <section id="how-it-works" className={`pb-32 pt-[calc(5vw+4rem)] px-8 ${BAND}`}>
          <div className="relative z-10 max-w-7xl mx-auto">
            <div className="text-center mb-20">
              <span className="block font-bold text-[10px] tracking-[0.4em] uppercase text-white/50">{t("landing.howItWorks.label")}</span>
              <h2 className="text-3xl md:text-4xl font-black mt-4 tracking-tighter uppercase leading-none">{t("landing.howItWorks.title")}</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-0">
              {STEPS.map((s, i) => {
                const Icon = s.icon;
                return (
                  <div key={i} data-reveal className="flex flex-col items-center text-center px-8 md:border-r border-white/10 last:border-0">
                    <div className="w-12 h-12 flex items-center justify-center mb-6">
                      <Icon className="w-6 h-6" strokeWidth={1.5} />
                    </div>
                    <h3 className="font-bold uppercase text-[10px] tracking-[0.3em] mb-3">{t(`landing.howItWorks.s${i + 1}Title`)}</h3>
                    <p className="text-[13px] text-white/60 leading-relaxed">{t(`landing.howItWorks.s${i + 1}Desc`)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Challenge. */}
        <section id="challenge" className="py-24 px-8 bg-[#E4E1DE] border-y border-[#D4D2D0]">
          <div className="max-w-7xl mx-auto">
            <SectionHead eyebrow={t("landing.challenge.eyebrow")} title={t("landing.challenge.title")} description={t("landing.challenge.description")} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-px bg-[#D4D2D0] border border-[#D4D2D0]">
              {CHALLENGE_CARDS.map((card, i) => {
                const Icon = card.icon;
                return (
                  <div key={i} data-reveal className="bg-white p-8 flex flex-col gap-4">
                    <Icon className="w-5 h-5 text-[#1A1A1A]" strokeWidth={1.5} />
                    <div>
                      <h4 className="font-black text-[0.875rem] uppercase tracking-tight mb-2">{t(`landing.challenge.card${i + 1}Title`)}</h4>
                      <p className="text-[13px] text-[#333333]/80 leading-relaxed">{t(`landing.challenge.card${i + 1}Desc`)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Capabilities. */}
        <section id="platform" className="py-32 px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHead eyebrow={t("landing.features.label")} title={t("landing.features.title")} description={t("landing.features.description")} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-[#D4D2D0] border border-[#D4D2D0]">
              {FEATURES.map((f, i) => {
                const Icon = f.icon;
                return (
                  <div key={i} data-reveal className="p-12 bg-white hover:bg-[#F6F4F2] transition-colors">
                    <Icon className="w-6 h-6 mb-8 text-[#1A1A1A]" strokeWidth={1.5} />
                    <h4 className="text-sm font-bold mb-4 uppercase tracking-widest">{t(`landing.features.f${i + 1}Title`)}</h4>
                    <p className="text-[13px] text-[#333333]/80 leading-relaxed">{t(`landing.features.f${i + 1}Desc`)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Value chain. */}
        <section id="infrastructure" className="py-32 px-8 bg-white border-y border-[#D4D2D0]">
          <div className="max-w-7xl mx-auto">
            <SectionHead eyebrow={t("landing.infrastructure.eyebrow")} title={t("landing.infrastructure.title")} description={t("landing.infrastructure.description")} />

            <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-[#D4D2D0] border border-[#D4D2D0]">
              {COMPONENTS.map((c, i) => {
                const Icon = c.icon;
                return (
                  <button
                    key={i}
                    onClick={() => setActiveTech(i)}
                    className={`flex items-center justify-center gap-2 px-5 py-4 font-black text-[11px] uppercase tracking-widest transition-colors ${
                      activeTech === i ? "bg-[#4A3F6B] text-white" : "bg-white hover:bg-[#F6F4F2] text-[#1A1A1A]/60"
                    }`}
                  >
                    <Icon className="w-4 h-4" strokeWidth={1.5} />
                    <span>{t(`landing.infrastructure.c${i + 1}Title`)}</span>
                  </button>
                );
              })}
            </div>

            {COMPONENTS[activeTech] && (
              <div className="grid grid-cols-1 lg:grid-cols-2 border-x border-b border-[#D4D2D0]">
                <div className="p-10 lg:border-r border-[#D4D2D0]">
                  <span className={EYEBROW}>{t(`landing.infrastructure.c${activeTech + 1}Subtitle`)}</span>
                  <h3 className="text-2xl font-black mt-4 mb-6 tracking-tighter uppercase leading-none">
                    {t(`landing.infrastructure.c${activeTech + 1}Title`)}
                  </h3>
                  <p className="text-[0.9375rem] text-[#333333]/80 leading-relaxed">
                    {t(`landing.infrastructure.c${activeTech + 1}Desc`)}
                  </p>
                </div>
                <div className="p-10 bg-[#F6F4F2]">
                  <div className="border-l-4 border-[#4A3F6B] pl-8 space-y-4">
                    {[1, 2, 3, 4].map((n) => (
                      <div key={n} className="flex items-start gap-3 text-[0.8125rem] text-[#1A1A1A]">
                        <Check className="w-4 h-4 mt-0.5 shrink-0 text-[#4A3F6B]" />
                        <span>{t(`landing.infrastructure.c${activeTech + 1}Spec${n}`)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Personas. */}
        <section id="personas" className="py-32 px-8">
          <div className="max-w-7xl mx-auto">
            <SectionHead eyebrow={t("landing.personas.eyebrow")} title={t("landing.personas.title")} />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-[#D4D2D0] border border-[#D4D2D0]">
              {PERSONAS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <div key={i} data-reveal className="bg-white p-10">
                    <Icon className="w-6 h-6 mb-6 text-[#1A1A1A]" strokeWidth={1.5} />
                    <p className="font-black text-[0.9375rem] uppercase tracking-tight mb-3">{t(`landing.personas.p${i + 1}Title`)}</p>
                    <p className="text-[12px] text-[#333333]/80 leading-relaxed">{t(`landing.personas.p${i + 1}Desc`)}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* EU funding. */}
        <section className={`py-24 px-8 ${BAND}`}>
          <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 border border-white/10">
            <div className="lg:col-span-2 p-10 border-b lg:border-b-0 lg:border-r border-white/10 flex items-start gap-6">
              <img src={EU_LOGO} alt={euAlt} className="h-12 w-auto shrink-0 bg-white p-1" />
              <div>
                <h3 className="font-black text-[0.9375rem] uppercase tracking-wider mb-3">{t("landing.trust.euTitle")}</h3>
                <p className="text-[0.8125rem] text-white/60 leading-relaxed">{t("landing.trust.euDescription")}</p>
              </div>
            </div>
            <div className="p-10 flex items-center justify-center">
              <Link to="/login" className={`${BUTTON} bg-white text-[#1A1A1A] hover:bg-[#EDEAE7]`}>
                <span>{t("landing.hero.getStarted")}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </section>

        {/* Contact. */}
        <section id="contact" className="py-32 px-8 bg-white">
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-12">
              <span className={EYEBROW}>{t("landing.contact.label")}</span>
              <h2 className="text-3xl md:text-6xl font-black tracking-tighter leading-tight mt-4">{t("landing.contact.title")}</h2>
              <p className="text-sm text-[#333333]/80 mt-4">{t("landing.contact.description")}</p>
            </div>

            <form onSubmit={handleContactSubmit} className="border border-[#D4D2D0] bg-[#F6F4F2] p-8 md:p-10 space-y-5">
              {status === "error" && (
                <div className="flex items-center gap-2.5 p-4 border border-[#B0AAA4] bg-white text-[#1A1A1A] text-[13px]">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{errorMessage || t("landing.contact.genericError")}</span>
                </div>
              )}

              {status === "success" && (
                <div className="flex items-center gap-2.5 p-4 border border-[#B0AAA4] bg-white text-[#1A1A1A] text-[13px]">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{t("landing.contact.successText")}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>{t("landing.contact.name")}</label>
                  <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("landing.contact.namePlaceholder")} className={FIELD} />
                </div>
                <div>
                  <label className={LABEL}>{t("landing.contact.email")}</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("landing.contact.emailPlaceholder")} className={FIELD} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div>
                  <label className={LABEL}>{t("landing.contact.category")}</label>
                  <select value={category} onChange={(e) => setCategory(e.target.value)} className={FIELD}>
                    {CATEGORY_OPTIONS.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {t(`landing.contact.categories.${cat.key}`)}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className={LABEL}>{t("landing.contact.subject")}</label>
                  <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder={t("landing.contact.subjectPlaceholder")} className={FIELD} />
                </div>
              </div>

              <div>
                <label className={LABEL}>{t("landing.contact.message")}</label>
                <textarea rows={4} value={message} onChange={(e) => setMessage(e.target.value)} placeholder={t("landing.contact.messagePlaceholder")} className={`${FIELD} resize-none`} />
              </div>

              <button type="submit" disabled={status === "loading"} className={`${BUTTON} w-full bg-[#1A1A1A] hover:bg-[#333333] text-[#EDEAE7] py-4 disabled:opacity-50`}>
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
        </section>
      </main>

      {/* Footer. */}
      <footer className={`w-full ${BAND}`}>
        <div className="max-w-7xl mx-auto px-8 py-16 grid gap-12 sm:grid-cols-2 lg:grid-cols-4 items-start">
          <div className="flex flex-col gap-4 max-w-xs">
            <img src="/images/landing-page/storcito-logo-white.webp" alt="STORCITO" className="h-10 w-auto self-start" />
            <p className="text-[11px] font-medium tracking-wide uppercase leading-relaxed text-white/60">{t("landing.footer.tagline")}</p>
          </div>

          <div className="flex flex-col gap-4 max-w-xs">
            <img src="/images/landing-page/thd-logo.svg" alt="Technische Hochschule Deggendorf" className="h-8 w-auto self-start brightness-0 invert" />
            <p className="text-[11px] font-medium tracking-wide uppercase leading-relaxed text-white/60">Technische Hochschule Deggendorf</p>
            <p className="text-[11px] leading-relaxed text-white/60">
              University of Applied Sciences.<br />
              BigGeoData & Spatial AI Research Group.<br />
              Deggendorf, Bavaria, Germany.
            </p>
            <a
              href="https://www.th-deg.de"
              target="_blank"
              rel="noopener noreferrer"
              className="self-start inline-flex items-center gap-2 border border-white/30 px-4 py-2 font-black uppercase text-[10px] tracking-widest text-white hover:bg-white/10 transition-all"
            >
              www.th-deg.de
              <ArrowRight className="h-3 w-3" />
            </a>
          </div>

          <div className="flex flex-col gap-3">
            <Link to="/privacy" className={FOOTER_LINK}>{t("landing.footer.privacyPolicy")}</Link>
            <Link to="/legal" className={FOOTER_LINK}>{t("landing.footer.cookies")}</Link>
            <Link to="/impressum" className={FOOTER_LINK}>{t("landing.footer.impressum")}</Link>
            <Link to="/terms-and-conditions" className={FOOTER_LINK}>{t("landing.footer.terms")}</Link>
            <button type="button" onClick={() => setConsentOpen(true)} className={`${FOOTER_LINK} text-left`}>
              {t("landing.footer.privacySettings")}
            </button>
          </div>

          <div className="space-y-4">
            <img src={EU_LOGO} alt={euAlt} className="h-12 w-auto bg-white p-1" />
            <p className="text-[11px] leading-relaxed text-white/50">{t("landing.footer.euDisclaimer")}</p>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 px-8 py-6 text-[10px] uppercase tracking-widest text-white/40">
            <span>© {new Date().getFullYear()} {t("landing.footer.copyright")}</span>
            <span>{t("landing.footer.builtOn")}</span>
          </div>
        </div>
      </footer>

      {/* Persists after consent. */}
      <PrivacyBanner onClick={() => setConsentOpen(true)} hasAccepted={consentAccepted} />
      <PrivacyConsentDialog
        isOpen={consentOpen}
        onClose={() => setConsentOpen(false)}
        onAccept={handleAcceptConsent}
        onDeny={handleDeclineConsent}
      />
    </div>
  );
}
