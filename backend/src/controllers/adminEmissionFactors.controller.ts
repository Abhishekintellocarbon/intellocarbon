import { asyncHandler } from "../utils/asyncHandler";
import * as emissionFactorService from "../services/emissionFactor.service";

export const listFactors = asyncHandler(async (_req, res) => {
  const factors = await emissionFactorService.listEmissionFactors();
  res.status(200).json({ factors });
});

export const createFactor = asyncHandler(async (req, res) => {
  const factor = await emissionFactorService.createEmissionFactor(req.body);
  res.status(201).json({ factor });
});

export const updateFactor = asyncHandler(async (req, res) => {
  const factor = await emissionFactorService.updateEmissionFactor(req.params.id, req.body);
  res.status(200).json({ factor });
});

export const supersedeFactor = asyncHandler(async (req, res) => {
  const factor = await emissionFactorService.supersedeEmissionFactor(req.params.id, req.body);
  res.status(200).json({ factor });
});

export const updateCbamCertificatePrice = asyncHandler(async (req, res) => {
  const factor = await emissionFactorService.updateCbamCertificatePrice(req.body);
  res.status(200).json({ factor });
});

export const updateCeaGridFactor = asyncHandler(async (req, res) => {
  const factor = await emissionFactorService.updateCeaGridFactor(req.body);
  res.status(200).json({ factor });
});
