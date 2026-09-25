import { z } from "zod";

export const paymentRecordSchema = z.object({
  studentId: z.string().optional(),
  amount: z.coerce.number().positive("Payment amount must be greater than 0."),
  period: z.string().trim().min(1, "Payment period is required."),
  method: z.string().trim().min(1, "Payment method is required."),
  planId: z.string().trim().optional().default("monthly"),
  branch: z.string().optional(),
  branchId: z.string().optional(),
  recordedAt: z.string().optional(),
  recordedBy: z.string().optional(),
  coverageStart: z.string().optional(),
  coverageEnd: z.string().optional(),
  notes: z.string().optional(),
  referenceNumber: z.string().optional(),
  approvalStatus: z.string().optional(),
});

export const studentIdSchema = z.string().trim().min(1, "Valid student ID is required.");
