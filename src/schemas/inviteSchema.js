import { z } from "zod";
import { normalizeBranch } from "../constants/branches.js";
import { normalizeDivision } from "../constants/divisions.js";

export const ALLOWED_STAFF_ROLES = [
  "admin",
  "manager",
  "instructor",
  "marketing",
  "frontoffice",
  "officeboy",
];

export const KINDERGARTEN_STAFF_ROLES = [
  "manager",
  "instructor",
  "frontoffice",
];

export const inviteSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("A valid email address is required."),
    role: z.enum(ALLOWED_STAFF_ROLES, {
      message: `Role must be one of: ${ALLOWED_STAFF_ROLES.join(", ")}`,
    }),
    branch: z
      .string()
      .trim()
      .optional()
      .transform((b) => normalizeBranch(b)),
    division: z
      .string()
      .trim()
      .optional()
      .transform((d) => normalizeDivision(d)),
  })
  .refine(
    (data) => {
      if (data.division === "kindergarten" && data.role === "marketing") {
        return false;
      }
      return true;
    },
    {
      message: "Marketing role is not available for Kindergarten division.",
      path: ["role"],
    }
  );

