import { prisma } from "../config/prisma";
import { calculateBorder, calculateComply, calculateIndia } from "./intellocalcCalculations";
import { sendLeadBorderEmail, sendLeadComplyEmail, sendLeadIndiaEmail } from "./email.service";
import type { LeadCaptureInput, ListLeadsQuery } from "../validators/leadCapture.validators";

const cleanOptional = (value?: string) => (value ? value : undefined);

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
    if (input.tool === "BORDER") {
      await sendLeadBorderEmail(lead.email, lead.name, results as ReturnType<typeof calculateBorder>);
    } else if (input.tool === "INDIA") {
      await sendLeadIndiaEmail(lead.email, lead.name, results as ReturnType<typeof calculateIndia>);
    } else {
      await sendLeadComplyEmail(
        lead.email,
        lead.name,
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
