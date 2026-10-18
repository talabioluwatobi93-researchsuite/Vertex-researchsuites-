const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type Gate = { ok: true; jobId: string | null } | { ok: false; error: string; status: number };

export async function checkJob(req: Request, db: any, userId: string, feature: string): Promise<Gate> {
  const { data: p, error: pe } = await db.from("feature_pricing").select("price").eq("feature_name", feature).maybeSingle();
  if (pe) return { ok: false, error: "Could not check pricing. Please try again.", status: 500 };
  const price = Number((p && p.price) || 0);
  if (!(price > 0)) return { ok: true, jobId: null };
  const jobId = (req.headers.get("x-job-id") || "").trim();
  if (!jobId) return { ok: false, error: "Please accept the package first.", status: 402 };
  if (!UUID_RE.test(jobId)) return { ok: false, error: "This purchase was not found.", status: 403 };
  const { data: j, error: je } = await db.from("feature_jobs").select("id,user_id,feature,status,deadline_at").eq("id", jobId).maybeSingle();
  if (je) return { ok: false, error: "Could not check your purchase. Please try again.", status: 500 };
  if (!j || j.user_id !== userId || j.feature !== feature) return { ok: false, error: "This purchase was not found.", status: 403 };
  if (j.status !== "open") return { ok: false, error: "This purchase is already used. Please buy again.", status: 402 };
  if (new Date(j.deadline_at).getTime() <= Date.now()) return { ok: false, error: "This purchase has expired. Please buy again.", status: 402 };
  return { ok: true, jobId };
}

export async function markJob(db: any, userId: string, jobId: string | null, event: string, err?: string) {
  if (!jobId) return;
  try {
    const { data, error } = await db.rpc("job_mark", { p_job: jobId, p_user: userId, p_event: event, p_error: err ?? null });
    if (error || (data && (data.error || data.ok === false))) {
      console.error("job_mark " + event + " problem:", error ? error.message : JSON.stringify(data).slice(0, 200));
    }
  } catch (e: any) {
    console.error("job_mark " + event + " threw:", String((e && e.message) || e));
  }
}
