import fs from "node:fs";
import path from "node:path";

/**
 * The commit this process is running, surfaced on /api/health.
 *
 * The point is external verifiability: after a push, anyone can curl
 * /api/health and see whether the fix they are waiting on is actually serving,
 * without probing for a new route or fetching an authenticated artifact and
 * inspecting it. Before this existed, confirming a deploy meant finding some
 * externally visible behaviour that differed between the two builds — which
 * works for a new endpoint and not at all for, say, a PDF layout fix.
 *
 * Resolution order, first hit wins:
 *
 *   1. GIT_COMMIT        — explicit. Set it via the Dockerfile's build arg, or
 *                          on any host that can inject it.
 *   2. RENDER_GIT_COMMIT — Render sets this on every service automatically, so
 *                          the deployed API gets a real SHA with no
 *                          configuration. This is the one that carries
 *                          production today.
 *   3. .git              — for local development, where neither variable is
 *                          set. The runner image does not copy .git, so this
 *                          never fires in a container; it exists so a
 *                          developer's /api/health is not permanently
 *                          "unknown".
 *
 * Falls back to "unknown" rather than throwing or inventing a value. A health
 * endpoint must not be the thing that stops the service booting, and a made-up
 * SHA would be worse than an absent one — the entire value here is that the
 * field can be trusted.
 */

const UNKNOWN = "unknown";
const SHORT_SHA_LENGTH = 7;

const isSha = (value: string): boolean => /^[0-9a-f]{40}$/i.test(value.trim());

/**
 * Reads the checked-out commit straight out of .git, without shelling out to
 * git — the build and runtime images do not have it installed, and adding it
 * for one string is not worth the layer.
 *
 * Handles the three shapes HEAD takes: a detached SHA, a symbolic ref pointing
 * at a loose ref file, and a symbolic ref whose target has been packed into
 * packed-refs (which is what a fresh clone often produces).
 */
const readFromGitDir = (startDir: string): string | null => {
  try {
    let dir = startDir;
    // Walk up to the repository root — this file's compiled location is
    // several directories below it, and differs between tsx and dist.
    for (let i = 0; i < 6; i++) {
      if (fs.existsSync(path.join(dir, ".git"))) break;
      const parent = path.dirname(dir);
      if (parent === dir) return null;
      dir = parent;
    }

    const gitDir = path.join(dir, ".git");
    if (!fs.existsSync(gitDir)) return null;

    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    if (isSha(head)) return head;

    const ref = head.startsWith("ref:") ? head.slice(4).trim() : null;
    if (!ref) return null;

    const loosePath = path.join(gitDir, ref);
    if (fs.existsSync(loosePath)) {
      const sha = fs.readFileSync(loosePath, "utf8").trim();
      return isSha(sha) ? sha : null;
    }

    const packedPath = path.join(gitDir, "packed-refs");
    if (!fs.existsSync(packedPath)) return null;
    for (const line of fs.readFileSync(packedPath, "utf8").split("\n")) {
      if (line.startsWith("#") || line.startsWith("^")) continue;
      const [sha, name] = line.trim().split(/\s+/);
      if (name === ref && isSha(sha ?? "")) return sha;
    }
    return null;
  } catch {
    // A missing or malformed .git is not an error worth surfacing — it just
    // means this environment cannot answer, which "unknown" already says.
    return null;
  }
};

const resolve = (): string => {
  const fromEnv = process.env.GIT_COMMIT?.trim() || process.env.RENDER_GIT_COMMIT?.trim();
  if (fromEnv) return fromEnv;
  return readFromGitDir(__dirname) ?? UNKNOWN;
};

/** Exported for the resolver's own tests; prefer COMMIT_SHA everywhere else. */
export const shortSha = (value: string): string =>
  value === UNKNOWN ? UNKNOWN : value.slice(0, SHORT_SHA_LENGTH);

/**
 * Resolved once at module load rather than per request. It cannot change while
 * the process lives, and re-reading .git on every health check would turn the
 * cheapest endpoint in the service into one that touches the filesystem.
 */
export const COMMIT_SHA = shortSha(resolve());
