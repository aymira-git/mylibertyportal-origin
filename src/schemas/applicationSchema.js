import { z } from "zod";
import { normalizeBranch } from "../constants/branches.js";
import { normalizeProgram } from "../constants/programs.js";
import { divisionOfProgram } from "../constants/divisions.js";
import { normalizeBatchType } from "../constants/batchTypes.js";
import { placementTestItemSchema } from "./deskInquirySchema.js";

export const applicationSchema = z
  .object({
    displayName: z.string().trim().min(1, "Student name is required."),
    nickname: z.string().trim().optional().default(""),
    phone: z.string().trim().optional().default(""),
    gender: z.string().trim().optional().default(""),
    dob: z.string().trim().optional().default(""),
    placeOfBirth: z.string().trim().optional().default(""),
    religion: z.string().trim().optional().default(""),
    address: z.string().trim().optional().default(""),
    branch: z
      .string()
      .trim()
      .optional()
      .transform((b) => normalizeBranch(b)),
    program: z.string().trim().optional().default(""),
    programId: z.string().trim().optional(),
    division: z.string().trim().optional(),
    classType: z.string().trim().optional().default(""),
    batchType: z.string().trim().optional(),
    schoolOrJob: z.string().trim().optional().default(""),
    classOrSemester: z.string().trim().optional().default(""),
    joinedDate: z.string().trim().optional().default(""),
    fatherName: z.string().trim().optional().default(""),
    fatherJob: z.string().trim().optional().default(""),
    fatherPhone: z.string().trim().optional().default(""),
    motherName: z.string().trim().optional().default(""),
    motherJob: z.string().trim().optional().default(""),
    motherPhone: z.string().trim().optional().default(""),
    parentName: z.string().trim().optional().default(""),
    parentPhone: z.string().trim().optional().default(""),
    photoURL: z.string().trim().optional().default(""),
    referralSource: z.string().trim().optional().default(""),
    currentLevel: z.string().trim().optional().default("warrior"),
    placementTests: z
      .preprocess((v) => (Array.isArray(v) ? v : []), z.array(placementTestItemSchema))
      .optional()
      .default([]),
    inquiryId: z.string().trim().optional().default(""),
    rating: z.string().trim().optional().default("1"),
    paymentPlan: z.string().trim().optional().default("monthly"),
    tuitionRate: z.coerce.number().optional(),
    registrationFee: z.coerce.number().optional(),
    handbookFee: z.coerce.number().optional(),
    paidUntil: z.string().trim().optional(),
    status: z.string().trim().optional().default("active"),
    notes: z.string().trim().optional().default(""),
    role: z.literal("student").default("student"),
  })
  .transform((data) => {
    const programId = normalizeProgram(data.programId || data.program);
    const batchType = normalizeBatchType(data.batchType || data.classType);
    return {
      ...data,
      programId,
      division: divisionOfProgram(programId),
      batchType,
    };
  });

