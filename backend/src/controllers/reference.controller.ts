import { Sector, FacilityType, HydrogenRoute } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import {
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_STEAM_EMISSION_FACTOR,
  FUEL_LIBRARY,
  PRECURSOR_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
  N2O_DEFAULT_EF_NITRIC_ACID_TONNES_PER_TONNE,
  N2O_DEFAULT_EF_SOURCE,
  CEMENT_CALCINATION_EMISSION_FACTOR,
} from "../data/emissionFactors";
import { GWP_AR2_BUR3, GWP_AR5 } from "../data/gwpTables";
import {
  CN_CODES_BY_SECTOR,
  SECTOR_FACILITY_TYPES,
  SECTOR_PRODUCTION_ROUTES,
  FERTILIZER_PRODUCT_OPTIONS,
  EU_DEFAULT_SEE_CEMENT,
  EU_DEFAULT_SEE_ALUMINIUM,
  EU_DEFAULT_SEE_HYDROGEN,
  EU_DEFAULT_SEE_BY_FERTILIZER_PRODUCT,
  EU_DEFAULT_SEE_BY_ROUTE,
} from "../data/cbamReferenceData";

const enumOptions = (values: Record<string, string>) =>
  Object.values(values).map((value) => ({
    value,
    label: value
      .toLowerCase()
      .split("_")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  }));

export const getEmissionFactorReference = asyncHandler(async (_req, res) => {
  res.status(200).json({
    fuels: Object.values(FUEL_LIBRARY),
    processMaterials: Object.values(PROCESS_MATERIAL_LIBRARY),
    precursors: Object.values(PRECURSOR_LIBRARY),
    defaultGridEmissionFactor: DEFAULT_GRID_EMISSION_FACTOR,
    defaultSteamEmissionFactor: DEFAULT_STEAM_EMISSION_FACTOR,
    gwpTables: { ar4: GWP_AR2_BUR3, ar5: GWP_AR5 },
    enums: {
      sector: enumOptions(Sector),
      facilityType: enumOptions(FacilityType),
      hydrogenRoute: enumOptions(HydrogenRoute),
    },
    sectorFacilityTypes: SECTOR_FACILITY_TYPES,
    sectorProductionRoutes: SECTOR_PRODUCTION_ROUTES,
    cnCodesBySector: CN_CODES_BY_SECTOR,
    fertilizerProductOptions: FERTILIZER_PRODUCT_OPTIONS,
    euDefaultSee: {
      steel: EU_DEFAULT_SEE_BY_ROUTE,
      cement: EU_DEFAULT_SEE_CEMENT,
      aluminium: EU_DEFAULT_SEE_ALUMINIUM,
      hydrogen: EU_DEFAULT_SEE_HYDROGEN,
      fertilizer: EU_DEFAULT_SEE_BY_FERTILIZER_PRODUCT,
    },
    n2oDefaultEf: {
      tonnesPerTonneNitricAcid: N2O_DEFAULT_EF_NITRIC_ACID_TONNES_PER_TONNE,
      source: N2O_DEFAULT_EF_SOURCE,
    },
    cementCalcinationEmissionFactor: CEMENT_CALCINATION_EMISSION_FACTOR,
  });
});
