import { z } from "zod";

// Shared helpers for building permissive "autosave a draft" schemas that sit
// alongside a form's strict submit-time schema. Autosave payloads always
// carry every field (see the frontend's sanitizeForAutosave), using `null`
// to mean "this field is currently empty" — so these helpers normalize
// `""`/`undefined`/`null` all down to `null` before the underlying type
// check runs, rather than rejecting or coercing them into a wrong value
// (e.g. `Number(null)` is `0`, which would silently corrupt a cleared field).
const emptyToNull = (v: unknown) => (v === "" || v === undefined ? null : v);

export const draftString = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());

export const draftNumber = () => z.preprocess(emptyToNull, z.coerce.number().nullable());

export const draftEnum = <T extends [string, ...string[]]>(values: T) =>
  z.preprocess(emptyToNull, z.enum(values).nullable());

export const draftNativeEnum = <T extends z.EnumLike>(e: T) =>
  z.preprocess(emptyToNull, z.nativeEnum(e).nullable());

export const draftDate = () => z.preprocess(emptyToNull, z.coerce.date().nullable());
