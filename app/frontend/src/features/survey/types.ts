// Survey applications.
export const SURVEY_APPLICATIONS = [
  "general",
  "biomass",
  "waste_to_energy",
  "utilisation",
  "pipelines",
  "storage",
] as const;

export type SurveyApplicationKey = (typeof SURVEY_APPLICATIONS)[number];

export interface SurveyApplication {
  mean_support: number;
  pct_support: number;
  pct_oppose: number;
  pct_petition_for?: number;
  pct_petition_against?: number;
  pct_petition_undecided?: number;
  contested: boolean;
}

export interface SurveySuggestion {
  code: string;
  applications?: SurveyApplicationKey[];
}

export type SupportLevel = "broad" | "moderate" | "divided";

export interface SurveyRegion {
  key: string;
  country: string;
  name: string;
  national: boolean;
  respondents: number;
  nuts: string[];
  states: string[];
  support_index: number;
  support_level: SupportLevel;
  diff_to_national?: number;
  comparison?: "above" | "around" | "below";
  applications: Record<SurveyApplicationKey, SurveyApplication>;
  factors: Record<string, number>;
  channels: Record<string, { pct_uses: number; pct_trusts: number }>;
  top_factors: string[];
  top_channels: string[];
  pct_climate_concern: number;
  pct_low_knowledge: number;
  pct_undecided: number;
  suggestions: SurveySuggestion[];
}

export interface SurveyData {
  regions: SurveyRegion[];
  min_respondents: number;
}
