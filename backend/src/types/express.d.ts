export {};

declare global {
  namespace Express {
    interface Request {
      /** Raw request body string, captured by express.json()'s verify hook for webhook signature checks. */
      rawBody?: string;
    }
  }
}
