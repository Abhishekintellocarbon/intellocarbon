import { describe, it, expect } from "vitest";
import { connectionEnforcesTls } from "../env";

/**
 * The guard's whole purpose is catching a connection string that can still
 * carry credentials in plaintext. Its failure mode is going quiet on one that
 * can — which the previous `includes("sslmode")` test did for the two modes
 * that permit exactly that.
 */
describe("connectionEnforcesTls", () => {
  const base = "postgresql://u:p@host:6543/postgres";

  it("accepts the modes that refuse to downgrade", () => {
    expect(connectionEnforcesTls(`${base}?sslmode=require`)).toBe(true);
    expect(connectionEnforcesTls(`${base}?sslmode=verify-ca`)).toBe(true);
    expect(connectionEnforcesTls(`${base}?sslmode=verify-full`)).toBe(true);
  });

  /**
   * The regression this file exists for. Both contain the substring "sslmode"
   * and both allow a plaintext connection — `prefer` by silently downgrading
   * when the server declines TLS.
   */
  it("rejects the modes that still permit plaintext", () => {
    expect(connectionEnforcesTls(`${base}?sslmode=disable`)).toBe(false);
    expect(connectionEnforcesTls(`${base}?sslmode=prefer`)).toBe(false);
    expect(connectionEnforcesTls(`${base}?sslmode=allow`)).toBe(false);
  });

  it("rejects a string with no sslmode at all", () => {
    expect(connectionEnforcesTls(base)).toBe(false);
    expect(connectionEnforcesTls(`${base}?pgbouncer=true`)).toBe(false);
  });

  /**
   * Production's pooled URL already carries ?pgbouncer=true, so sslmode
   * arrives as a second parameter behind an ampersand. Matching only after
   * "?" would miss the real production shape entirely.
   */
  it("finds sslmode when it is not the first parameter", () => {
    expect(connectionEnforcesTls(`${base}?pgbouncer=true&sslmode=require`)).toBe(true);
    expect(connectionEnforcesTls(`${base}?sslmode=require&connection_limit=1`)).toBe(true);
    expect(connectionEnforcesTls(`${base}?pgbouncer=true&sslmode=disable`)).toBe(false);
  });

  /** A parameter that merely ends in sslmode is not sslmode. */
  it("does not match a lookalike parameter name", () => {
    expect(connectionEnforcesTls(`${base}?notsslmode=require`)).toBe(false);
  });

  /**
   * Unset is a different fact from set-and-insecure: one means nobody
   * configured the migrate connection, the other means somebody configured it
   * badly. Health reports them differently so they can be acted on
   * differently.
   */
  it("returns null for an unset variable rather than false", () => {
    expect(connectionEnforcesTls(undefined)).toBeNull();
    expect(connectionEnforcesTls(null)).toBeNull();
    expect(connectionEnforcesTls("")).toBeNull();
  });
});
