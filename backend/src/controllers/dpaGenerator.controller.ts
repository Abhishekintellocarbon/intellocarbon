import { asyncHandler } from "../utils/asyncHandler";
import * as dpaGeneratorService from "../services/dpaGenerator.service";

export const generate = asyncHandler(async (req, res) => {
  const { fileName, fileData } = await dpaGeneratorService.generateDpaPdf(req.body);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.send(fileData);
});
