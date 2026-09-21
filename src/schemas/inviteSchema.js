import { z } from "zod";
import { normalizeBranch } from "../constants/branches.js";

export const ALLOWED_STAFF_ROLES = [
  "admin",
  "manager",
  "instructor",
  "marketing",
  "frontoffice",
  "officeboy",
];

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("A valid email address is required."),
  role: z.enum(ALLOWED_STAFF_ROLES, {
    message: `Role must be one of: ${ALLOWED_STAFF_ROLES.join(", ")}`,
  }),
  branch: z
    .string()
    .trim()
    .optional()
    .transform((b) => normalizeBranch(b)),
});
