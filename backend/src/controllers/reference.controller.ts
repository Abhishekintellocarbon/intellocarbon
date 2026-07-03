import { Sector, FacilityType, ProductionRoute } from "@prisma/client";
import { asyncHandler } from "../utils/asyncHandler";
import {
  DEFAULT_GRID_EMISSION_FACTOR,
  DEFAULT_STEAM_EMISSION_FACTOR,
  FUEL_LIBRARY,
  PRECURSOR_LIBRARY,
  PROCESS_MATERIAL_LIBRARY,
} from "../data/emissionFactors";
import { GWP_AR2_BUR3, GWP_AR5 } from "../data/gwpTables";

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
      productionRoute: enumOptions(ProductionRoute),
    },
  });
});
