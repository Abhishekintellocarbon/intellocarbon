import { describe, it, expect } from "vitest";
import { execSync } from "node:child_process";
import { COMMIT_SHA, shortSha } from "../version";

/**
 * /api/health's `commit` field exists to make a deploy verifiable from
 * outside. That only holds if the value can be trusted, so the properties
 * worth protecting are: it matches the commit actually checked out, and it
 * degrades to "unknown" rather than to something that looks like a SHA.
 */

describe("shortSha", () => {
  it("truncates a full SHA to seven characters, matching git's own short form", () => {
    expect(shortSha("d7f1b4843ecfd509cca71cda220a9a8880ff3dbe")).toBe("d7f1b48");
  });

  /**
   * The failure that would defeat the whole feature: "unknown" must stay
   * legible rather than being cut to "unknow", which reads like a truncated
   * hash and would send someone comparing it against a real one.
   */
  it("leaves 'unknown' intact rather than truncating it", () => {
    expect(shortSha("unknown")).toBe("unknown");
  });
});

describe("COMMIT_SHA", () => {
  it("is either a seven-character hex short SHA or the literal 'unknown'", () => {
    expect(COMMIT_SHA).toMatch(/^([0-9a-f]{7}|unknown)$/);
  });

  /**
   * Read straight out of .git by hand — no shelling out to git, because
   * neither the build nor the runtime image has it installed. This asserts
   * that hand-rolled parse agrees with git itself, which is the only thing
   * that makes the field meaningful.
   *
   * Skipped where git or a working tree is unavailable, rather than failing:
   * the resolver is designed to return "unknown" in exactly that case, and
   * that path is covered above.
   */
  it("agrees with git rev-parse in a working tree", () => {
    let expected: string;
    try {
      expected = execSync("git rev-parse --short=7 HEAD", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
      expect(COMMIT_SHA).toBe("unknown");
      return;
    }
    expect(COMMIT_SHA).toBe(expected);
  });
});
