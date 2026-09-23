import { z } from "zod";
import { normalizeBranch } from "../constants/branches.js";
import { normalizeDivision } from "../constants/divisions.js";

export const AUDIENCE_TYPES = ["all", "branch", "role", "division"];

export const EVENT_ALLOWED_ROLES = [
  "instructor",
  "frontoffice",
  "manager",
  "marketing",
  "officeboy",
  "admin",
];

export const corporateEventSchema = z
  .object({
    name: z.string().trim().min(1, "Event name is required."),
    eventDate: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Event date must be in YYYY-MM-DD format."),
    startTime: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "Start time must be in HH:mm format.")
      .nullable()
      .optional()
      .or(z.literal("")),
    endTime: z
      .string()
      .trim()
      .regex(/^\d{2}:\d{2}$/, "End time must be in HH:mm format.")
      .nullable()
      .optional()
      .or(z.literal("")),
    audienceType: z.enum(AUDIENCE_TYPES, {
      message: "Audience type must be 'all', 'branch', 'role', or 'division'.",
    }),
    audienceValue: z.string().trim().nullable().optional(),
    status: z.enum(["active", "cancelled"]).default("active"),
    createdBy: z.string().trim().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.audienceType === "all") {
      // audienceValue can be null
      return;
    }

    if (!data.audienceValue || !data.audienceValue.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["audienceValue"],
        message: `Audience value is required when audience type is '${data.audienceType}'.`,
      });
      return;
    }

    if (data.audienceType === "role") {
      const cleanRole = data.audienceValue.trim().toLowerCase();
      if (!EVENT_ALLOWED_ROLES.includes(cleanRole)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["audienceValue"],
          message: `Role '${data.audienceValue}' is not valid for event audience. Allowed roles: ${EVENT_ALLOWED_ROLES.join(", ")}.`,
        });
      }
    }
  })
  .transform((data) => {
    let cleanAudienceValue = data.audienceValue ? data.audienceValue.trim() : null;
    if (data.audienceType === "all") {
      cleanAudienceValue = null;
    } else if (data.audienceType === "branch" && cleanAudienceValue) {
      cleanAudienceValue = normalizeBranch(cleanAudienceValue);
    } else if (data.audienceType === "division" && cleanAudienceValue) {
      cleanAudienceValue = normalizeDivision(cleanAudienceValue);
    } else if (data.audienceType === "role" && cleanAudienceValue) {
      cleanAudienceValue = cleanAudienceValue.toLowerCase();
    }

    return {
      ...data,
      startTime: data.startTime || null,
      endTime: data.endTime || null,
      audienceValue: cleanAudienceValue,
      status: data.status || "active",
    };
  });
