import { z } from "zod";

export const SCHOOL_TIERS = ["SD", "SMP", "SMA", "SMK", "University", "Other"];

export const OUTREACH_STATUSES = ["pending", "scheduled", "visited", "follow_up"];

export const CONTACT_ROLES = [
  "Guru BK",
  "Kepala Sekolah",
  "Wakil Kepala Sekolah",
  "Pembina OSIS / Guru",
  "Pengurus OSIS / Siswa",
  "Staf TU / Administrasi",
  "Other",
];

const dateRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

export const schoolMasterSchema = z.object({
  name: z.string().trim().min(1, "School name is required."),
  municipality: z.string().trim().min(1, "Municipality is required.").default("Kota Gorontalo"),
  district: z.string().trim().nullable().optional().default(""),
  address: z.string().trim().default(""),
  lat: z
    .number({ invalid_type_error: "Latitude must be a valid number." })
    .min(-90, "Latitude must be between -90 and 90.")
    .max(90, "Latitude must be between -90 and 90."),
  lng: z
    .number({ invalid_type_error: "Longitude must be a valid number." })
    .min(-180, "Longitude must be between -180 and 180.")
    .max(180, "Longitude must be between -180 and 180."),
  tier: z.enum(SCHOOL_TIERS, {
    errorMap: () => ({ message: `Tier must be one of: ${SCHOOL_TIERS.join(", ")}.` }),
  }).default("SMA"),
  active: z.boolean().default(true),
  status: z.enum(OUTREACH_STATUSES, {
    errorMap: () => ({ message: `Status must be one of: ${OUTREACH_STATUSES.join(", ")}.` }),
  }).default("pending"),
  scheduledDate: z
    .string()
    .trim()
    .regex(dateRegex, "Scheduled date must be in YYYY-MM-DD format.")
    .nullable()
    .optional()
    .or(z.literal("")),
  lastVisitDate: z
    .string()
    .trim()
    .regex(dateRegex, "Last visit date must be in YYYY-MM-DD format.")
    .nullable()
    .optional()
    .or(z.literal("")),
  lastVisitId: z.string().trim().nullable().optional().default(""),
  lastContactName: z.string().trim().nullable().optional().default(""),
  lastContactRole: z.string().trim().nullable().optional().default(""),
  lastOutcome: z.string().trim().nullable().optional().default(""),
  nextActionDate: z
    .string()
    .trim()
    .regex(dateRegex, "Next action date must be in YYYY-MM-DD format.")
    .nullable()
    .optional()
    .or(z.literal("")),
  createdBy: z.string().trim().optional(),
  createdAt: z.any().optional(),
  updatedBy: z.string().trim().optional(),
  updatedAt: z.any().optional(),
});

export const schoolVisitSchema = z.object({
  visitDate: z
    .string()
    .trim()
    .regex(dateRegex, "Visit date must be in YYYY-MM-DD format."),
  contactName: z.string().trim().min(1, "Contact person name is required."),
  contactRole: z.string().trim().min(1, "Contact role is required."),
  phone: z.string().trim().default(""),
  flyersHandedOut: z
    .number({ invalid_type_error: "Flyers count must be a number." })
    .int("Flyers count must be an integer.")
    .nonnegative("Flyers count cannot be negative.")
    .default(0),
  leadsCollected: z
    .number({ invalid_type_error: "Leads count must be a number." })
    .int("Leads count must be an integer.")
    .nonnegative("Leads count cannot be negative.")
    .default(0),
  outcome: z.string().trim().default(""),
  notes: z.string().trim().default(""),
  nextActionDate: z
    .string()
    .trim()
    .regex(dateRegex, "Next action date must be in YYYY-MM-DD format.")
    .nullable()
    .optional()
    .or(z.literal("")),
  statusAfterVisit: z.enum(["visited", "follow_up"]).default("visited"),
  createdBy: z.string().trim().optional(),
  createdAt: z.any().optional(),
});
