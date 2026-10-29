import type { TFunction } from "i18next";
import type { SupportLevel, SurveyApplicationKey, SurveySuggestion } from "./types";

export const LEVEL_TONES: Record<SupportLevel, string> = {
  broad: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
  moderate: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  divided: "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-400",
};

// RUB's wording.
const APPLICATIONS: Record<SurveyApplicationKey, string> = {
  general: "CCUS in general",
  biomass: "Biomass with CCUS",
  waste_to_energy: "Waste-to-energy with CCUS",
  utilisation: "CO₂ utilisation",
  pipelines: "CO₂ pipelines",
  storage: "CO₂ storage",
};

const SHORT: Record<SurveyApplicationKey, string> = {
  general: "General",
  biomass: "Biomass",
  waste_to_energy: "Waste",
  utilisation: "Utilisation",
  pipelines: "Pipelines",
  storage: "Storage",
};

const FACTORS: Record<string, string> = {
  risks_transport_storage: "Risks of transport and storage",
  economy_jobs: "Impact on economy and jobs",
  emission_reduction: "Reduction of emissions",
  energy_use: "Required energy use",
  costs: "Costs of CCUS",
  fossil_fuels: "Continued use of fossil fuels",
  trust_institutions: "Trust in responsible institutions",
};

const CHANNELS: Record<string, string> = {
  newspaper: "Newspapers",
  library_books: "Library books",
  search_engine: "Search engines",
  generative_ai: "Generative AI",
  news_channels: "News channels",
  local_politicians: "Local politicians",
  friends_family: "Friends and family",
};

const LEVELS: Record<SupportLevel, { label: string; message: string }> = {
  broad: { label: "Broad support", message: "Most residents support CCUS." },
  moderate: { label: "Moderate support", message: "Residents are moderately supportive; many have mixed or undecided views." },
  divided: { label: "Divided views", message: "Support and scepticism are close to balanced; acceptance cannot be taken for granted." },
};

const COMPARISON: Record<string, string> = {
  above: "Above national average",
  around: "Around national average",
  below: "Below national average",
};

const SUGGESTIONS: Record<string, string> = {
  factor_risks_transport_storage:
    "Address safety concerns: provide information on monitoring, liability and actual risks of CO₂ transport and storage.",
  factor_emission_reduction: "Focus on the climate benefit: how much CO₂ is avoided and how this is verified.",
  factor_costs: "Explain cost trajectories and who pays for them.",
  factor_energy_use: "Be transparent about the energy needed for capture and where it comes from.",
  factor_trust_institutions: "Make responsibilities clear and involve independent oversight and local actors.",
  factor_economy_jobs: "Address local economic effects (jobs, value added, tax revenue).",
  factor_fossil_fuels: "Explain how CCUS relates to the phase-out of fossil fuels.",
  contested: "Contested here: {{applications}}. Engage early and offer real participation before decisions are made.",
  low_knowledge: "Most residents know little about CCUS: start with transparent, neutral information.",
  undecided: "Many residents are undecided: dialogue formats (information events, site visits) may be promising.",
  climate_concern: "Climate concern is widespread: show how CCUS contributes to climate goals.",
};

export const applicationLabel = (t: TFunction, key: SurveyApplicationKey) =>
  t(`survey.applications.${key}`, APPLICATIONS[key]);

export const applicationShort = (t: TFunction, key: SurveyApplicationKey) =>
  t(`survey.applicationsShort.${key}`, SHORT[key]);

export const factorLabel = (t: TFunction, key: string) => t(`survey.factors.${key}`, FACTORS[key] ?? key);

export const channelLabel = (t: TFunction, key: string) => t(`survey.channels.${key}`, CHANNELS[key] ?? key);

export const levelLabel = (t: TFunction, level: SupportLevel) => t(`survey.levels.${level}.label`, LEVELS[level].label);

export const levelMessage = (t: TFunction, level: SupportLevel) => t(`survey.levels.${level}.message`, LEVELS[level].message);

export const comparisonLabel = (t: TFunction, comparison: string) =>
  t(`survey.comparison.${comparison}`, COMPARISON[comparison] ?? comparison);

export const suggestionText = (t: TFunction, suggestion: SurveySuggestion) =>
  t(`survey.suggestions.${suggestion.code}`, {
    defaultValue: SUGGESTIONS[suggestion.code] ?? suggestion.code,
    applications: (suggestion.applications ?? []).map((key) => applicationLabel(t, key)).join(", "),
  });
