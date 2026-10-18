// Runs many Intron part-jobs with limits, retries and backoff. Pure TypeScript, no imports.
// The page gives it two functions (start parts, check jobs); this file only decides when to call them.

export type RunnerPart = { index: number; startSeconds: number; durationSeconds: number };
export type StartJob = { startSeconds: number; fileId?: string; fileToken?: string; error?: string; deferred?: boolean };
export type StartResult = { busy?: boolean; error?: string; jobs?: StartJob[] };
export type PollItem = { fileId: string; state: string; transcript?: string | null };
export type PollResult = { busy?: boolean; error?: string; items?: PollItem[] };
export type RunnerDeps = {
  startBatch: (parts: { startSeconds: number; durationSeconds: number }[]) => Promise<StartResult>;
  pollBatch: (jobs: { fileId: string; fileToken: string }[]) => Promise<PollResult>;
  sleep: (ms: number) => Promise<void>;
  now: () => number;
  onProgress?: (p: RunnerProgress) => void;
  shouldStop?: () => boolean;
};
export type RunnerConfig = {
  maxRunning: number; batchSize: number; pollMs: number; maxAttempts: number; maxJobMs: number;
  busyBackoffMs: number; errorBackoffMs: number; maxUnknown: number; maxCheckErrors: number;
  maxBusyStreak: number; maxDeferrals: number; overallTimeoutMs: number; tickMs: number; pollBatchMax: number;
};
export const DEFAULT_RUNNER_CONFIG: RunnerConfig = {
  maxRunning: 5, batchSize: 3, pollMs: 8000, maxAttempts: 3, maxJobMs: 5 * 60 * 1000,
  busyBackoffMs: 15000, errorBackoffMs: 3000, maxUnknown: 5, maxCheckErrors: 6,
  maxBusyStreak: 20, maxDeferrals: 20, overallTimeoutMs: 45 * 60 * 1000, tickMs: 1000, pollBatchMax: 12,
};
export type RunnerProgress = { total: number; done: number; failed: number; running: number };
export type RunnerPartResult = RunnerPart & { text: string | null; error?: string };
export type RunnerResult = { parts: RunnerPartResult[]; stopped: boolean; timedOut: boolean; uploads: number; polls: number };

type St = {
  part: RunnerPart; status: "pending" | "running" | "done" | "failed"; attempts: number;
  fileId?: string; fileToken?: string; startedAt: number; unknown: number; text: string | null; error?: string;
};

export async function runIntronParts(plan: RunnerPart[], deps: RunnerDeps, cfgIn: Partial<RunnerConfig> = {}): Promise<RunnerResult> {
  const cfg = { ...DEFAULT_RUNNER_CONFIG, ...cfgIn };
  const st: St[] = plan.map((p) => ({ part: p, status: "pending", attempts: 0, startedAt: 0, unknown: 0, text: null }));
  const t0 = deps.now();
  let nextStartAt = 0;
  let nextPollAt = 0;
  let busyStreak = 0;
  let deferStreak = 0;
  let checkErrors = 0;
  let uploads = 0;
  let polls = 0;
  let stopped = false;
  let timedOut = false;

  const count = (s: St["status"]) => st.filter((x) => x.status === s).length;
  const report = () => deps.onProgress && deps.onProgress({ total: st.length, done: count("done"), failed: count("failed"), running: count("running") });
  const fail = (x: St, msg: string) => { x.status = "failed"; x.text = null; x.error = msg; };
  const retry = (x: St, msg: string) => {
    x.fileId = undefined; x.fileToken = undefined;
    if (x.attempts >= cfg.maxAttempts) fail(x, msg); else { x.status = "pending"; x.error = msg; }
  };
  const failAll = (status: St["status"], msg: string) => { for (const x of st) if (x.status === status) fail(x, msg); };

  while (count("pending") + count("running") > 0) {
    if (deps.shouldStop && deps.shouldStop()) { stopped = true; failAll("pending", "Stopped."); failAll("running", "Stopped."); break; }
    const now = deps.now();
    if (now - t0 > cfg.overallTimeoutMs) { timedOut = true; failAll("pending", "Timed out."); failAll("running", "Timed out."); break; }
    let acted = false;

    // 1. start more parts
    const running = count("running");
    const pending = st.filter((x) => x.status === "pending");
    if (pending.length && running < cfg.maxRunning && now >= nextStartAt) {
      const batch = pending.slice(0, Math.min(cfg.batchSize, cfg.maxRunning - running));
      acted = true;
      let res: StartResult;
      try { res = await deps.startBatch(batch.map((x) => ({ startSeconds: x.part.startSeconds, durationSeconds: x.part.durationSeconds }))); }
      catch (e: any) { res = { error: String((e && e.message) || "start failed") }; }
      if (res.busy) {
        busyStreak++;
        nextStartAt = deps.now() + cfg.busyBackoffMs;
        if (busyStreak > cfg.maxBusyStreak) failAll("pending", "The service stayed busy.");
      } else if (res.error || !res.jobs) {
        for (const x of batch) { x.attempts++; uploads++; retry(x, res.error || "Could not start."); }
        nextStartAt = deps.now() + cfg.errorBackoffMs;
      } else {
        busyStreak = 0;
        let deferred = 0;
        for (const x of batch) {
          const j = res.jobs.find((q) => q.startSeconds === x.part.startSeconds);
          if (!j) { x.attempts++; retry(x, "No answer for this part."); continue; }
          if (j.deferred) { deferred++; continue; }
          x.attempts++; uploads++;
          if (j.fileId && j.fileToken) { x.status = "running"; x.fileId = j.fileId; x.fileToken = j.fileToken; x.startedAt = deps.now(); x.unknown = 0; }
          else retry(x, j.error || "Could not start.");
        }
        if (deferred) {
          deferStreak++;
          nextStartAt = deps.now() + cfg.errorBackoffMs;
          if (deferStreak > cfg.maxDeferrals) failAll("pending", "Could not start these parts.");
        } else deferStreak = 0;
      }
      report();
    }

    // 2. check running jobs
    const live = st.filter((x) => x.status === "running");
    if (live.length && deps.now() >= nextPollAt) {
      acted = true;
      const group = live.slice(0, cfg.pollBatchMax);
      polls++;
      let res: PollResult;
      try { res = await deps.pollBatch(group.map((x) => ({ fileId: x.fileId as string, fileToken: x.fileToken as string }))); }
      catch (e: any) { res = { error: String((e && e.message) || "check failed") }; }
      nextPollAt = deps.now() + cfg.pollMs;
      if (res.busy) { nextPollAt = deps.now() + cfg.busyBackoffMs; }
      else if (res.error || !res.items) {
        checkErrors++;
        if (checkErrors > cfg.maxCheckErrors) { for (const x of group) retry(x, "Could not check progress."); checkErrors = 0; }
      } else {
        checkErrors = 0;
        for (const x of group) {
          const it = res.items.find((q) => q.fileId === x.fileId);
          const state = it ? it.state : "unknown";
          if (state === "done") { x.status = "done"; x.text = typeof it!.transcript === "string" ? it!.transcript : ""; x.error = undefined; }
          else if (state === "failed") retry(x, "Transcription failed for this part.");
          else if (state === "unknown" || state === "error") {
            x.unknown++;
            if (x.unknown >= cfg.maxUnknown) retry(x, "Unexpected status.");
          } else if (deps.now() - x.startedAt > cfg.maxJobMs) retry(x, "Took too long.");
        }
      }
      report();
    }
    if (!acted) await deps.sleep(cfg.tickMs);
  }
  report();
  return {
    parts: st.map((x) => ({ ...x.part, text: x.status === "done" ? x.text : null, error: x.status === "done" ? undefined : x.error })),
    stopped, timedOut, uploads, polls,
  };
}
