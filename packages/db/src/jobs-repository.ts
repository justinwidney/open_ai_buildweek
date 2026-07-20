import { eq } from "drizzle-orm";
import type { Database } from "./client.js";
import { jobs } from "./schema.js";

export type JobStatus = "queued" | "running" | "done" | "error";

export interface EnqueueJobParams {
  id: string;
  runId: string;
  fromMonth: number;
  toMonth: number;
}

/** Registers a unit of background work (extending a run, or computing a branch's post-fork months). */
export async function enqueueJob(db: Database, params: EnqueueJobParams): Promise<void> {
  await db.insert(jobs).values({ id: params.id, runId: params.runId, fromMonth: params.fromMonth, toMonth: params.toMonth, status: "queued" });
}

export async function updateJobStatus(db: Database, id: string, status: JobStatus, errorMessage?: string): Promise<void> {
  await db
    .update(jobs)
    .set({ status, errorMessage: errorMessage ?? null, updatedAt: new Date() })
    .where(eq(jobs.id, id));
}

export async function getJob(db: Database, id: string) {
  const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
  return job;
}
