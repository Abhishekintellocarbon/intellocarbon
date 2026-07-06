import { prisma } from "../config/prisma";
import { calculateBorder, calculateComply, calculateIndia } from "./intellocalcCalculations";
import { sendLeadBorderEmail, sendLeadComplyEmail, sendLeadIndiaEmail } from "./email.service";
import type { EsgWaitlistInput, LeadCaptureInput, ListLeadsQuery } from "../validators/leadCapture.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

/** "Notify me" signup for a not-yet-built /esg framework — no calculation, no email, just demand signal per framework. */
export const createEsgWaitlistSignup = async (input: EsgWaitlistInput) => {
  const lead = await prisma.leadCapture.create({
    data: {
      email: input.email,
      toolUsed: input.tool,
      inputsJson: {},
      resultsJson: {},
    },
  });
  return { lead };
};

export const createLead = async (input: LeadCaptureInput) => {
  let results: unknown;

  if (input.tool === "BORDER") {
    results = calculateBorder(input.inputs);
  } else if (input.tool === "INDIA") {
    results = calculateIndia(input.inputs);
  } else {
    results = calculateComply(input.inputs);
  }

  const lead = await prisma.leadCapture.create({
    data: {
      name: input.name,
      email: input.email,
      company: input.company,
      phone: cleanOptional(input.phone),
      toolUsed: input.tool,
      inputsJson: input.inputs,
      resultsJson: results as object,
    },
  });

  const sendEmail = async () => {
    // `input.name` (not `lead.name`) — the column is nullable now to support
    // the email-only ESG waitlist below, but these three tools' validator
    // always requires a real name, so the pre-save input is the non-null source.
    if (input.tool === "BORDER") {
      await sendLeadBorderEmail(lead.email, input.name, results as ReturnType<typeof calculateBorder>);
    } else if (input.tool === "INDIA") {
      await sendLeadIndiaEmail(lead.email, input.name, results as ReturnType<typeof calculateIndia>);
    } else {
      await sendLeadComplyEmail(
        lead.email,
        input.name,
        results as ReturnType<typeof calculateComply>,
        lead.id,
      );
    }
  };
  sendEmail().catch(() => {});

  return { lead, results };
};

export const listLeads = async (query: ListLeadsQuery) => {
  return prisma.leadCapture.findMany({
    where: {
      toolUsed: query.tool,
      ...(query.sector
        ? {
            inputsJson: {
              path: ["sector"],
              equals: query.sector,
            },
          }
        : {}),
      createdAt: {
        gte: query.from ? new Date(query.from) : undefined,
        lte: query.to ? new Date(query.to) : undefined,
      },
    },
    orderBy: { createdAt: "desc" },
    take: 500,
  });
};

export const getLeadById = async (id: string) => {
  return prisma.leadCapture.findUnique({ where: { id } });
};
