import type { PrimaryMetric, UrlMatchType } from "@/generated/prisma/enums";

export interface WizardWebsite {
  id: string;
  name: string;
  domain: string;
}

/** The subset of an active experiment the summary step's conflict check needs. */
export interface WizardActiveExperiment {
  id: string;
  name: string;
  websiteId: string;
  controlUrl: string;
  controlMatchType: UrlMatchType;
}

/** One redirect target row in the wizard's dynamic list. `id` is present only when editing an
 * existing variant — its absence is what tells the service "create this one" apart from
 * "update this one". */
export interface WizardVariant {
  id?: string;
  url: string;
  /** Relative share of the included traffic. See `Experiment.controlWeight` in the schema. */
  weight: number;
}

export interface WizardValues {
  websiteId: string;
  name: string;
  description: string;
  controlUrl: string;
  controlMatchType: UrlMatchType;
  controlWeight: number;
  variants: WizardVariant[];
  conversionUrl: string;
  conversionMatchType: UrlMatchType;
  primaryMetric: PrimaryMetric;
  trafficAllocation: number;
}

export const PRIMARY_METRIC_LABEL: Record<PrimaryMetric, string> = {
  CONVERSION_RATE: "Conversion rate",
  TIME_ON_PAGE: "Average time on page",
  PAGE_VIEWS: "Page views per visitor",
};
