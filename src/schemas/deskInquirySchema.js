import { z } from "zod";
import { DIVISIONS, normalizeDivision } from "../constants/divisions";

export const INQUIRY_STATUSES = ["inquired", "follow_up_sent", "enrolled", "closed"];

export const placementTestItemSchema = z.object({
  id: z.string().optional(),
  score: z.preprocess(
    (v) => (v === "" || v == null ? null : Number(v)),
    z.number().nullable().optional()
  ),
  assessedLevel: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  testedBy: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  testedAt: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  notes: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
});

export const deskInquirySchema = z.object({
  parentName: z.string().trim().min(1, "Parent / visitor name is required."),
  phone: z.string().trim().min(5, "Valid phone number is required (at least 5 digits)."),
  studentName: z.string().trim().min(1, "Prospective student name is required."),
  dob: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  ageOrGrade: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  fluencyTier: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  currentLevel: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  programId: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  program: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  branch: z.preprocess((v) => (v == null ? "Kota Gorontalo" : String(v).trim()), z.string()).optional().default("Kota Gorontalo"),
  division: z.preprocess((v) => normalizeDivision(v), z.enum(DIVISIONS)).optional().default("courses"),
  status: z
    .preprocess(
      (v) => (typeof v === "string" && INQUIRY_STATUSES.includes(v) ? v : "inquired"),
      z.enum(INQUIRY_STATUSES)
    )
    .optional()
    .default("inquired"),
  leadSource: z.preprocess((v) => (v == null ? "walk_in" : String(v).trim()), z.string()).optional().default("walk_in"),
  placementTests: z
    .preprocess((v) => (Array.isArray(v) ? v : []), z.array(placementTestItemSchema))
    .optional()
    .default([]),
  convertedStudentId: z.preprocess((v) => (v == null ? null : String(v).trim()), z.string().nullable()).optional(),
  convertedAt: z.preprocess((v) => (v == null ? null : String(v).trim()), z.string().nullable()).optional(),
  notes: z.preprocess((v) => (v == null ? "" : String(v).trim()), z.string()).optional().default(""),
  createdAt: z.string().optional(),
  createdBy: z.string().nullish(),
  createdByName: z.string().nullish(),
  updatedAt: z.string().optional(),
  updatedBy: z.string().nullish(),
});
