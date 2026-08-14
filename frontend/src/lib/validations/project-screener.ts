import { z } from "zod";

/**
 * Client-side form schema for the Project Eligibility Screener, mirroring the
 * projectScreenerInputsSchema half of the backend's leadCapture validator. The
 * contact fields are not here — the screener reuses the shared
 * leadContactSchema through the existing lead-capture modal.
 */
export const projectScreenerFormSchema = z.object({
  projectType: z.enum(
    [
      "RENEWABLE_ENERGY",
      "FORESTRY_AFFORESTATION",
      "BIOCHAR",
      "BIOGAS_LANDFILL_GAS",
      "ENHANCED_ROCK_WEATHERING",
      "INDUSTRIAL_ENERGY_EFFICIENCY",
      "OTHER",
    ],
    { error: "Select a project type" },
  ),
  state: z.string().trim().min(2, "Select a project location"),
  scaleBand: z.enum(["MICRO", "SMALL", "MEDIUM", "LARGE"], { error: "Select an estimated scale" }),
  stage: z.enum(["CONCEPT", "PLANNING", "UNDER_CONSTRUCTION", "OPERATIONAL"], {
    error: "Select the current project stage",
  }),
  projectDescription: z.string().trim().max(2000, "Keep this under 2,000 characters").optional().or(z.literal("")),
});

export type ProjectScreenerFormValues = z.infer<typeof projectScreenerFormSchema>;
