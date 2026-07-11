import { asyncHandler } from "../utils/asyncHandler";
import * as ndaGeneratorService from "../services/ndaGenerator.service";

export const generate = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await ndaGeneratorService.generateNdaPdf(req.body);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
