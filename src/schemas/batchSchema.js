import { z } from "zod";
import { normalizeBranch } from "../constants/branches.js";
import { normalizeProgram } from "../constants/programs.js";
import { divisionOfProgram } from "../constants/divisions.js";

export const batchSchema = z
  .object({
    className: z.string().trim().min(1, "Batch name is required."),
    programId: z
      .string()
      .trim()
      .optional()
      .transform((p) => normalizeProgram(p)),
    division: z.string().trim().optional(),
    classLevel: z.string().trim().min(1, "Class level is required."),
    minLevel: z.string().trim().optional(),
    maxLevel: z.string().trim().optional(),
    instructorId: z.string().optional().default(""),
    instructorName: z.string().optional().default(""),
    substituteInstructorId: z.string().nullable().optional(),
    substituteInstructorName: z.string().nullable().optional(),
    classDay: z.union([z.string(), z.array(z.string())]).optional(),
    classStartDate: z.string().optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    schedule: z.string().optional(),
    classRoom: z.string().trim().optional().default("Main Campus"),
    branch: z
      .string()
      .trim()
      .optional()
      .transform((b) => normalizeBranch(b)),
    maxCapacity: z.coerce.number().int().positive().default(15),
    minQuorum: z.coerce.number().int().nonnegative().default(4),
    status: z.string().trim().default("open"),
    notes: z.string().optional().default(""),
    worksheetUrl: z.string().optional().default(""),
    studentIds: z.array(z.string()).optional().default([]),
    enrollments: z
      .array(
        z.object({
          studentId: z.string(),
          dateJoined: z.string().optional(),
          level: z.string().optional(),
        })
      )
      .optional()
      .default([]),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
  })
  .transform((data) => ({
    ...data,
    division: divisionOfProgram(data.programId),
  }));

