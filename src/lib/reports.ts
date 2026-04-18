import { randomUUID } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { createUserReport, findUserById, getReportsForPlace } from "@/lib/db";
import { getAuthSession } from "@/lib/session";

const sensoryDimensionsSchema = z.object({
  noise: z.number().min(0).max(100),
  light: z.number().min(0).max(100),
  crowd: z.number().min(0).max(100),
  smell: z.number().min(0).max(100),
});

const submitReportSchema = z.object({
  placeId: z.string().min(1),
  hour: z.number().int().min(0).max(23),
  dims: sensoryDimensionsSchema,
  note: z.string().max(280).optional(),
});

const loadPlaceReportsSchema = z.object({
  placeId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional(),
});

export const submitReportForCurrentUser = createServerFn({ method: "POST" })
  .inputValidator(submitReportSchema)
  .handler(async ({ data }) => {
    const session = await getAuthSession();
    if (!session.data.userId) {
      throw new Error("Sign in to submit reports.");
    }

    const user = await findUserById(session.data.userId);
    if (!user) {
      throw new Error("Unable to find your account.");
    }

    const report = await createUserReport({
      id: randomUUID(),
      userId: user.id,
      userEmail: user.email,
      placeId: data.placeId,
      hour: data.hour,
      dims: data.dims,
      note: data.note,
      createdAt: Date.now(),
    });

    return report;
  });

export const loadReportsForPlace = createServerFn({ method: "POST" })
  .inputValidator(loadPlaceReportsSchema)
  .handler(async ({ data }) => {
    return getReportsForPlace(data.placeId, data.limit ?? 20);
  });
