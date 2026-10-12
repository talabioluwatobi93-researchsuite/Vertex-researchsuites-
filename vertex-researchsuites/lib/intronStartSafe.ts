// P13-1: if Intron refuses speaker labels for a short audio part (HTTP 400 about diarization),
// send the same part again once without labels, so no audio is lost.
import { startIntronJob } from "./intronClient";

type StartArgs = Parameters<typeof startIntronJob>[1];

export async function startWithDiarizeFallback(apiKey: string, args: StartArgs): Promise<{ fileId: string; raw: unknown }> {
  try {
    return await startIntronJob(apiKey, args);
  } catch (err: any) {
    const msg = String((err && err.message) || "").toLowerCase();
    if (args.diarize && err && err.status === 400 && msg.indexOf("diariz") !== -1) {
      console.error("intron-start: part too short for speaker labels, retrying without labels");
      return await startIntronJob(apiKey, { ...args, diarize: false });
    }
    throw err;
  }
}
