"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { stitchParts, type PartInput } from "@/lib/voiceStitch";
import { LANGUAGE_GROUPS, LANGUAGE_NOTE, languageCodesFor, optionText } from "@/lib/voiceLanguages";
import { INTRON_LANGUAGE_GROUPS, INTRON_LANGUAGE_NOTE } from "@/lib/intronLanguages";
import { nominalPlan, joinIntronParts } from "@/lib/intronCuts";
import { speakerNumbers, partNumbers, mergeSpeakers, swapSpeakersInPart } from "@/lib/speakerTools";
import { runIntronParts, type RunnerDeps } from "@/lib/intronRunner";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#555555";
const BG = "#F9F9F9";
const BORDER = "#EEEEEE";

const CHUNK_LENGTH_SECONDS = 600; // 10 minutes (raise toward 28 after timing a real run)
const CHUNK_OVERLAP_SECONDS = 60;

type Stage = "loading" | "fee-confirm" | "upload" | "transcribing" | "review-transcript" | "notes";

function mergeTranscriptChunks(accumulated: string, next: string): string {
  const a = accumulated.trim();
  const b = next.trim();
  if (!a) return b;
  if (!b) return a;

  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const maxOverlap = Math.min(40, aWords.length, bWords.length);
  let overlapLen = 0;

  for (let len = maxOverlap; len > 3; len--) {
    const aTail = aWords.slice(aWords.length - len).join(" ").toLowerCase();
    const bHead = bWords.slice(0, len).join(" ").toLowerCase();
    if (aTail === bHead) {
      overlapLen = len;
      break;
    }
  }

  const bRemainder = bWords.slice(overlapLen).join(" ");
  return bRemainder ? `${a} ${bRemainder}` : a;
}

export default function VoiceTranscription() {
  const router = useRouter();
  const [userId, setUserId] = useState("");
  const [stage, setStage] = useState<Stage>("loading");
  const [price, setPrice] = useState(0);
  const [paying, setPaying] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [file, setFile] = useState<File | null>(null);
  const [language, setLanguage] = useState<string>("auto");
  const [languageHint, setLanguageHint] = useState<string>("");
  const [generatingDocument, setGeneratingDocument] = useState(false);
  const [fullDocument, setFullDocument] = useState("");
  const [documentError, setDocumentError] = useState("");
  const [uploading, setUploading] = useState(false);
  const [audioUrl, setAudioUrl] = useState("");
  const [transcribingUrl, setTranscribingUrl] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [processingMsg, setProcessingMsg] = useState("");

  const [transcript, setTranscript] = useState("");
  const [transcriptNotice, setTranscriptNotice] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [generatingNotes, setGeneratingNotes] = useState(false);

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      try {
        const { data } = await supabase.from("feature_pricing").select("price").eq("feature_name", "voice_transcription").single();
        const p = data?.price ?? 0;
        setPrice(p);
        setStage(p === 0 ? "upload" : "fee-confirm");
      } catch {
        setPrice(0);
        setStage("upload");
      }
    };
    init();
  }, []);

  // ---- African languages (Intron). First version: one clip of up to 2 minutes. ----
  const INTRON_MAX_AUDIO_SECONDS = 3600;
  const INTRON_MAX_FILE_BYTES = 50 * 1024 * 1024;
  const INTRON_ALLOWED_EXT = ["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm", "aac", "aif", "aiff", "amr", "3gp", "3ga", "wma"];
  const [intronFile, setIntronFile] = useState<File | null>(null);
  const [intronLanguage, setIntronLanguage] = useState<string>("yo");
  const [intronBusy, setIntronBusy] = useState(false);
  const [intronMsg, setIntronMsg] = useState("");
  const [intronError, setIntronError] = useState("");
  const [intronText, setIntronText] = useState("");
  const [intronRaw, setIntronRaw] = useState("");
  const [intronSessionId, setIntronSessionId] = useState("");
  const [intronNotice, setIntronNotice] = useState("");

  const [intronDiarize, setIntronDiarize] = useState(true);
  const handleIntronTranscribe = async () => {
    if (!intronFile) return;
    setIntronBusy(true);
    setIntronError("");
    setIntronText("");
    setIntronRaw("");
    setIntronNotice("");
    try {
      if (intronFile.size > INTRON_MAX_FILE_BYTES) {
        throw new Error("This file is larger than 50 MB. Please choose a smaller file, or cut the recording into shorter files.");
      }
      const getToken = async (): Promise<string> => {
        const { data: authData } = await supabase.auth.getSession();
        const t = authData.session?.access_token;
        if (!t) throw new Error("Please sign in again.");
        return t;
      };
      await getToken();

      const safeName = intronFile.name.replace(/[^A-Za-z0-9._-]+/g, "_");
      const path = `${userId}/${Date.now()}-${safeName}`;
      setIntronMsg("Uploading your audio...");
      const { error: upErr } = await supabase.storage.from("interview-audio").upload(path, intronFile);
      if (upErr) throw new Error("Could not upload audio. Please try again.");

      const { data: session, error: sessErr } = await supabase
        .from("voice_transcription_sessions")
        .insert({ user_id: userId, audio_path: path, status: "uploaded", fee_charged: price })
        .select()
        .single();
      if (sessErr || !session) throw new Error("Could not create transcription session. Please try again.");
      setIntronSessionId(session.id);

      const probeRes = await fetch("/api/voice-transcription/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: path }),
      });
      const probeData = await probeRes.json();
      if (!probeRes.ok || typeof probeData.durationSeconds !== "number" || !(probeData.durationSeconds > 0)) {
        throw new Error("We could not read the length of this audio file. Please try another file (mp3, m4a or wav).");
      }
      if (probeData.durationSeconds > INTRON_MAX_AUDIO_SECONDS) {
        throw new Error("This recording is longer than 1 hour. Please cut it into shorter files. Cut at a pause and repeat about 15 seconds at the start of the next file.");
      }

      const plan = nominalPlan(probeData.durationSeconds);
      const post = async (url: string, payload: any) => {
        const token = await getToken();
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer " + token },
          body: JSON.stringify(payload),
        });
        let data: any = null;
        try { data = await res.json(); } catch { data = null; }
        return { res, data };
      };
      const deps: RunnerDeps = {
        now: () => Date.now(),
        sleep: (ms: number) => new Promise<void>((r) => setTimeout(r, ms)),
        startBatch: async (parts) => {
          try {
            const { res, data } = await post("/api/voice-transcription/intron-start", {
              sessionId: session.id, audioPath: path, language: intronLanguage, diarize: intronDiarize, totalSeconds: probeData.durationSeconds, parts,
            });
            if (res.status === 429) return { busy: true };
            if (!res.ok || !data || !Array.isArray(data.jobs)) return { error: (data && data.error) || "Could not start." };
            return { jobs: data.jobs };
          } catch {
            return { error: "Network problem." };
          }
        },
        pollBatch: async (jobs) => {
          try {
            const { res, data } = await post("/api/voice-transcription/intron-status", { jobs });
            if (res.status === 429) return { busy: true };
            if (!res.ok || !data || !Array.isArray(data.items)) return { error: (data && data.error) || "Could not check." };
            return { items: data.items };
          } catch {
            return { error: "Network problem." };
          }
        },
        onProgress: (p) => setIntronMsg("Transcribing... " + p.done + " of " + p.total + " parts done. Please don't close this page."),
      };
      setIntronMsg("Transcribing... 0 of " + plan.length + " parts done. Please don't close this page.");
      const run = await runIntronParts(plan, deps);
      const okParts = run.parts.filter((p) => p.text !== null).length;
      if (okParts === 0) throw new Error("Transcription failed for every part of this audio. Please try again.");

      const stitched = joinIntronParts(run.parts.map((p) => ({ index: p.index, text: p.text, startSeconds: p.startSeconds })));
      const notices = [...stitched.notices];
      if (run.timedOut) notices.push("Transcription took too long, so the last parts are missing.");
      setIntronText(stitched.text);
      setIntronNotice(notices.join(" "));
      setIntronRaw(
        JSON.stringify(
          {
            parts: plan.length,
            partsTranscribed: okParts, diarize: intronDiarize,
            audioSecondsSent: Math.round(probeData.durationSeconds),
            uploads: run.uploads,
            statusChecks: run.polls,
            speakers: stitched.speakerCount,
            failedParts: stitched.failedParts,
            emptyTurns: stitched.emptyTurns,
          },
          null,
          2
        )
      );
      setIntronMsg(stitched.text ? "Done." : "Done, but no text came back.");
      if (stitched.text) {
        await supabase
          .from("voice_transcription_sessions")
          .update({ raw_transcript: stitched.text, status: "transcribed", updated_at: new Date().toISOString() })
          .eq("id", session.id);
      }
    } catch (err: any) {
      setIntronError(err.message || "Something went wrong. Please try again.");
      setIntronMsg("");
    } finally {
      setIntronBusy(false);
    }
  };

  const handleUseIntronTranscript = () => {
    setTranscript(intronText);
    setTranscriptNotice(
      intronNotice || "This transcript came from the African-language engine. Speaker labels, if any, depend on what the engine returned."
    );
    setSessionId(intronSessionId);
    setStage("review-transcript");
  };

  const handleAcceptFee = async () => {
    setPaying(true);
    setErrorMsg("");
    try {
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("id", userId).single();
      const balance = wallet?.balance ?? 0;
      if (balance < price) {
        setErrorMsg("Your balance is not enough, kindly top up.");
        setPaying(false);
        return;
      }
      const { error: deductError } = await supabase.from("wallets").update({ balance: balance - price }).eq("id", userId);
      if (deductError) {
        setErrorMsg("Could not process payment. Please try again.");
        setPaying(false);
        return;
      }
      setStage("upload");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    }
    setPaying(false);
  };


  const runChunkedTranscription = async (audioPath: string, durationSeconds: number, lang: string) => {
    let accumulated = "";
    const partsForStitch: PartInput[] = [];
    let textOnlyParts = 0;
    let start = 0;
    const step = CHUNK_LENGTH_SECONDS - CHUNK_OVERLAP_SECONDS;
    const totalChunks = Math.max(1, Math.ceil(durationSeconds / step));
    let chunkIndex = 0;

    while (start < durationSeconds) {
      chunkIndex += 1;
      setProcessingMsg(`Please be patient, as we process your transcript. Transcribing part ${chunkIndex} of ${totalChunks}...`);

      const chunkDuration = Math.min(CHUNK_LENGTH_SECONDS, durationSeconds - start);

      const res = await fetch("/api/voice-transcription/gemini-part", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath, startSeconds: start, durationSeconds: chunkDuration, language: lang, languageCodes: languageCodesFor(lang), languageHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Transcription failed on part ${chunkIndex}. Please try again.`);

      partsForStitch.push({ offset: start, words: Array.isArray(data.words) ? data.words : [] });
      const partHasWords = Array.isArray(data.words) && data.words.length > 0;
      const partHasText = typeof data.text === "string" && data.text.trim().length > 0;
      if (!partHasWords && partHasText) textOnlyParts += 1;
      accumulated = mergeTranscriptChunks(accumulated, data.text || "");
      start += step;
    }

    const stitched = stitchParts(partsForStitch);
    if (stitched.words.length > 0 && textOnlyParts === 0) {
      setTranscriptNotice(
        partsForStitch.length > 1
          ? "This recording was transcribed in parts and speaker labels were matched across them. Please check who is speaking near the start of each part."
          : ""
      );
      return stitched.text;
    }
    setTranscriptNotice(
      stitched.words.length > 0
        ? "Some parts of this recording came back without speaker labels or timestamps, so the transcript below is plain text without them."
        : "Speaker labels and timestamps were not available for this recording, so the transcript below is plain text without them."
    );
    return accumulated;
  };

  const handleTranscribeFromUrl = async () => {
    if (!audioUrl.trim()) return;
    setTranscribingUrl(true);
    setErrorMsg("");
    try {
      const uploadRes = await fetch("/api/voice-transcription/transcribe-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, audioUrl: audioUrl.trim() }),
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setErrorMsg(uploadData.error || "Could not process that link. Please try again.");
        setTranscribingUrl(false);
        return;
      }

      setSessionId(uploadData.sessionId);
      setTranscribingUrl(false);
      setStage("transcribing");
      setProcessingMsg("Please be patient, as we process your transcript.");

      const probeRes = await fetch("/api/voice-transcription/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: uploadData.path }),
      });
      const probeData = await probeRes.json();

      let finalTranscript = "";
      if (probeRes.ok && typeof probeData.durationSeconds === "number" && probeData.durationSeconds > 0) {
        finalTranscript = await runChunkedTranscription(uploadData.path, probeData.durationSeconds, language);
      } else {
        throw new Error("We could not read the length of this audio file. Please try another file (mp3, m4a or wav).");
      }

      await supabase
        .from("voice_transcription_sessions")
        .update({ raw_transcript: finalTranscript, status: "transcribed", updated_at: new Date().toISOString() })
        .eq("id", uploadData.sessionId);

      setTranscript(finalTranscript);
      setStage("review-transcript");
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setStage("upload");
      setTranscribingUrl(false);
    }
  };

  const handleUploadAndTranscribe = async () => {
    if (!file) return;
    setUploading(true);
    setErrorMsg("");
    try {
      const path = `${userId}/${Date.now()}-${file.name}`;
      const { error: uploadError } = await supabase.storage.from("interview-audio").upload(path, file);
      if (uploadError) {
        setErrorMsg("Could not upload audio. Please try again.");
        setUploading(false);
        return;
      }

      const { data: session, error: sessionError } = await supabase
        .from("voice_transcription_sessions")
        .insert({ user_id: userId, audio_path: path, status: "uploaded", fee_charged: price })
        .select()
        .single();

      if (sessionError || !session) {
        setErrorMsg("Could not create transcription session. Please try again.");
        setUploading(false);
        return;
      }

      setSessionId(session.id);
      setUploading(false);
      setStage("transcribing");
      setProcessingMsg("Please be patient, as we process your transcript.");

      const probeRes = await fetch("/api/voice-transcription/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath: path }),
      });
      const probeData = await probeRes.json();

      let finalTranscript = "";

      if (probeRes.ok && typeof probeData.durationSeconds === "number" && probeData.durationSeconds > 0) {
        finalTranscript = await runChunkedTranscription(path, probeData.durationSeconds, language);
      } else {
        throw new Error("We could not read the length of this audio file. Please try another file (mp3, m4a or wav).");
      }

      await supabase
        .from("voice_transcription_sessions")
        .update({ raw_transcript: finalTranscript, status: "transcribed", updated_at: new Date().toISOString() })
        .eq("id", session.id);

      setTranscript(finalTranscript);
      setStage("review-transcript");
    } catch (err: any) {
      setErrorMsg(err?.message || "Something went wrong. Please try again.");
      setStage("upload");
      setUploading(false);
    }
  };

  const [savedTranscript, setSavedTranscript] = useState("");
  const handleGenerateNotes = async () => {
    if (transcript.trim() && transcript !== savedTranscript) {
      downloadTextFile("transcript-" + downloadStamp() + ".txt", transcript);
      setSavedTranscript(transcript);
    }
    setGeneratingNotes(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/voice-transcription/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data || typeof data.notes !== "string") {
        throw new Error((data && data.error) || "The notes service returned an error (status " + res.status + ").");
      }
      setNotes(data.notes);

      await supabase
        .from("voice_transcription_sessions")
        .update({ raw_transcript: transcript, interpretive_notes: data.notes, status: "completed", updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      setStage("notes");
    } catch (err: any) {
      setErrorMsg(err && err.message ? "Something went wrong generating notes: " + err.message : "Something went wrong generating notes. Please try again.");
    }
    setGeneratingNotes(false);
  };

  const handleGenerateDocument = async () => {
    setGeneratingDocument(true);
    setDocumentError("");
    try {
      const res = await fetch("/api/voice-transcription/generate-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript, languageHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Document generation failed. Please try again.");
      setFullDocument(data.document as string);
    } catch (err: any) {
      setDocumentError(err.message || "Something went wrong generating the document. Please try again.");
    }
    setGeneratingDocument(false);
  };

  const handleSaveToBunker = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const content = `TRANSCRIPT:\n\n${transcript}\n\n----------\n\nINTERPRETIVE NOTES:\n\n${notes}`;
      const { error } = await supabase.from("bunker_items").insert({
        user_id: userId,
        item_name: `Voice Transcription — ${file?.name || "Interview"}`,
        content_reference: content,
      });
      setSavedMsg(error ? "Could not save to Bunker. Please try again." : "Saved to My Bunker successfully!");
    } catch {
      setSavedMsg("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  if (stage === "loading") {
    return <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14 }}>Loading...</div>;
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "24px 20px" }}>
      <h1 style={{ color: DARK, fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Voice Transcription & Analysis</h1>

      {stage === "fee-confirm" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: DARK, fontSize: 16, fontWeight: 700, marginBottom: "8px" }}>Confirm Payment</p>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "20px" }}>₦{price} will be deducted from your wallet to use this feature. Do you want to proceed?</p>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => router.push("/dashboard")} style={{ flex: 1, backgroundColor: "#EEEEEE", color: DARK, border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAcceptFee} disabled={paying} style={{ flex: 1, backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>{paying ? "Processing..." : "Accept & Continue"}</button>
          </div>
        </div>
      )}

      {stage === "upload" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, marginBottom: "16px" }}>
          <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "6px" }}>African languages</p>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: "14px" }}>
            For Yoruba, Igbo, Hausa, Pidgin and other African languages, including speech mixed with English. Up to 1 hour and 50 MB per file. Long recordings are processed in parts and joined automatically.
          </p>
          <label style={{ display: "block", width: "100%", padding: "14px", marginBottom: "16px", backgroundColor: "#F5F5F5", border: "2px dashed #CCCCCC", borderRadius: "10px", textAlign: "center", fontSize: "14px", color: "#333333", fontWeight: 600, cursor: "pointer" }}>
            {intronFile ? intronFile.name : "Tap here to choose an audio file"}
            <input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                if (selected) {
                  const ext = selected.name.split(".").pop()?.toLowerCase() || "";
                  if (INTRON_ALLOWED_EXT.indexOf(ext) === -1) {
                    setIntronError("That file type (." + ext + ") isn't supported. Please choose an mp3, m4a, wav, or similar audio file.");
                    setIntronFile(null);
                    return;
                  }
                }
                setIntronError("");
                setIntronFile(selected);
              }}
              style={{ display: "none" }}
            />
          </label>
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333333", marginBottom: "6px" }}>Language spoken</label>
          <select
            value={intronLanguage}
            onChange={(e) => setIntronLanguage(e.target.value)}
            style={{ width: "100%", padding: "10px 12px", fontSize: "14px", borderRadius: "10px", border: "1px solid #CCCCCC", color: "#333333", marginBottom: "12px" }}
          >
            {INTRON_LANGUAGE_GROUPS.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.options.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p style={{ color: "#888888", fontSize: 12, marginTop: "-8px", marginBottom: "12px" }}>{INTRON_LANGUAGE_NOTE}</p>
          {intronError && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{intronError}</p>}
          {intronMsg && <p style={{ color: MUTED, fontSize: 13, marginBottom: "12px" }}>{intronMsg}</p>}
        {intronNotice && <p style={{ color: MUTED, fontSize: 13, marginBottom: "12px" }}>{intronNotice}</p>}
          <label style={{ display: "flex", alignItems: "center", fontSize: 12, color: MUTED, marginBottom: "12px" }}>
            <input type="checkbox" checked={!intronDiarize} onChange={(e) => setIntronDiarize(!e.target.checked)} disabled={intronBusy} style={{ marginRight: "8px" }} />
            Test: turn speaker labels off
          </label>
          <button
            onClick={handleIntronTranscribe}
            disabled={!intronFile || intronBusy}
            style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
          >
            {intronBusy ? "Working..." : "Upload & Transcribe (African languages)"}
          </button>
          {intronText && (
            <div style={{ marginTop: "16px" }}>
              <p style={{ color: DARK, fontSize: 14, fontWeight: 700, marginBottom: "6px" }}>Transcript</p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit", fontSize: "13px", color: DARK, lineHeight: "1.6", margin: "0 0 12px 0", maxHeight: "420px", overflowY: "auto" }}>{intronText}</pre>
              <button
                onClick={handleUseIntronTranscript}
                style={{ width: "100%", backgroundColor: DARK, color: "#ffffff", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}
              >
                Use this transcript
              </button>
            </div>
          )}
          {intronRaw && (
            <div style={{ marginTop: "16px" }}>
              <p style={{ color: MUTED, fontSize: 12, fontWeight: 700, marginBottom: "6px" }}>Join report (for testing)</p>
              <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", maxHeight: "300px", overflow: "auto", fontSize: "11px", color: MUTED, backgroundColor: "#FAFAFA", border: "1px solid #EEEEEE", borderRadius: "8px", padding: "10px", margin: 0 }}>{intronRaw}</pre>
            </div>
          )}
        </div>
      )}

      {stage === "upload" && (
        <p style={{ color: DARK, fontSize: 14, fontWeight: 700, margin: "4px 0 10px 0" }}>Other languages (global)</p>
      )}

      {stage === "upload" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "16px" }}>Upload your interview recording. We'll transcribe it and generate detailed interpretive notes.</p>
          <label style={{ display: "block", width: "100%", padding: "14px", marginBottom: "16px", backgroundColor: "#F5F5F5", border: "2px dashed #CCCCCC", borderRadius: "10px", textAlign: "center", fontSize: "14px", color: "#333333", fontWeight: 600, cursor: "pointer" }}>
            {file ? file.name : "Tap here to choose an audio file"}
            <input type="file" accept="audio/*" onChange={(e) => {
              const selected = e.target.files?.[0] || null
              if (selected) {
                const allowedExt = ["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm", "aac", "aif", "aiff", "amr", "3gp", "3ga", "wma"]
                const ext = selected.name.split(".").pop()?.toLowerCase() || ""
                if (allowedExt.indexOf(ext) === -1) {
                  setErrorMsg("That file type (." + ext + ") isn't supported. Please choose an mp3, m4a, wav, or similar audio file.")
                  setFile(null)
                  return
                }
              }
              setErrorMsg("")
              setFile(selected)
            }} style={{ display: "none" }} />
          </label>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333333", marginBottom: "6px" }}>Audio language</label>
            <select value={language} onChange={(e) => setLanguage(e.target.value)} style={{ width: "100%", padding: "10px 12px", fontSize: "14px", borderRadius: "10px", border: "1px solid #CCCCCC", color: "#333333", marginBottom: "12px" }}>
                <option value="auto">Auto-detect</option>
                {LANGUAGE_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.options.map((o) => (
                      <option key={o.value} value={o.value}>{optionText(o)}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <p style={{ color: "#888888", fontSize: 12, marginTop: "-8px", marginBottom: "12px" }}>{LANGUAGE_NOTE}</p>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "#333333", marginBottom: "6px" }}>Language hint (optional)</label>
              <input
                type="text"
                value={languageHint}
                onChange={(e) => setLanguageHint(e.target.value)}
                placeholder="e.g. Nigerian Pidgin mixed with Yoruba and English"
                style={{ width: "100%", padding: "10px 12px", fontSize: "14px", borderRadius: "10px", border: "1px solid #CCCCCC", color: "#333333", marginBottom: "12px" }}
              />
              <p style={{ color: "#888888", fontSize: 12, marginTop: "-8px", marginBottom: "12px" }}>If your audio mixes languages or dialects, type them here (e.g. "code-switched Yoruba and English") to help the model identify speech more accurately.</p>
            <p style={{ color: "#888888", fontSize: 12, marginBottom: "12px" }}>Built for spoken interviews and voice notes. Songs or music will likely transcribe poorly.</p>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <button onClick={handleUploadAndTranscribe} disabled={!file || uploading} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            {uploading ? "Uploading..." : "Upload & Transcribe"}
          </button>
        </div>
      )}

      {stage === "transcribing" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, textAlign: "center" }}>
          <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "8px" }}>{processingMsg || "Please be patient, as we process your transcript."}</p>
          <p style={{ color: MUTED, fontSize: 13 }}>This can take a moment for longer recordings. Please don't close this page.</p>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginTop: "12px" }}>{errorMsg}</p>}
        </div>
      )}

      {stage === "review-transcript" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "8px" }}>Review Your Transcript</p>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: "12px" }}>Check for any misheard names or terms before generating your interpretive notes.</p>
          {transcriptNotice && (
            <p style={{ color: "#8A6D00", fontSize: 12, marginBottom: "12px" }}>Note: {transcriptNotice}</p>
          )}
          <SpeakerToolsPanel text={transcript} onChange={setTranscript} />
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} style={{ width: "100%", minHeight: "260px", padding: "12px 14px", borderRadius: "10px", border: "1px solid #DDDDDD", fontSize: "14px", color: DARK, lineHeight: 1.6, boxSizing: "border-box" as const, marginBottom: "16px" }} />
          <button type="button" onClick={() => downloadTextFile("transcript-" + downloadStamp() + ".txt", transcript)} disabled={!transcript.trim()} style={{ width: "100%", backgroundColor: "#FFFFFF", color: DARK, border: "1px solid " + BORDER, borderRadius: "10px", padding: "10px", fontSize: "13px", fontWeight: 600, cursor: "pointer", marginBottom: "12px" }}>Download transcript (.txt)</button>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <button onClick={handleGenerateNotes} disabled={generatingNotes || !transcript.trim()} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            {generatingNotes ? "Generating interpretive notes..." : "Generate Interpretive Notes"}
          </button>
        </div>
      )}

      {stage === "notes" && notes && (
        <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
          <button type="button" onClick={() => downloadTextFile("interpretive-notes-" + downloadStamp() + ".txt", notes)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "none", backgroundColor: GOLD, color: DARK, fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>Download notes (.txt)</button>
          <button type="button" onClick={() => downloadTextFile("transcript-" + downloadStamp() + ".txt", transcript)} style={{ flex: 1, padding: "12px", borderRadius: "10px", border: "1px solid " + BORDER, backgroundColor: "#FFFFFF", color: DARK, fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>Download transcript (.txt)</button>
        </div>
      )}
      {stage === "notes" && (
        <div>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, marginBottom: "16px" }}>
            <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "10px" }}>Interpretive Notes</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "14px", color: DARK, lineHeight: "1.6", margin: 0 }}>{(notes || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^-{3,}$/gm, '')}</pre>
          </div>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
            <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "10px" }}>Full Transcript</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", color: MUTED, lineHeight: "1.6", margin: 0 }}>{(transcript || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^-{3,}$/gm, '')}</pre>
          </div>
          <button onClick={handleSaveToBunker} disabled={saving} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "16px" }}>
            {saving ? "Saving..." : "Save to My Bunker"}
          </button>
          {savedMsg && <p style={{ color: savedMsg.includes("successfully") ? "#1D8A4C" : "#C0392B", fontSize: "13px", fontWeight: 600, marginTop: "12px", textAlign: "center" }}>{savedMsg}</p>}

            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, marginTop: "16px" }}>
              <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "6px" }}>Full Academic Document</p>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: "12px" }}>Generate a publication-ready document with corrected diacritics, translated code-switched terms, and a glossary — built from your transcript and language hint.</p>
              <button onClick={handleGenerateDocument} disabled={generatingDocument || !transcript.trim()} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                {generatingDocument ? "Generating document..." : "Generate Full Document"}
              </button>
              {documentError && <p style={{ color: "#C0392B", fontSize: "13px", marginTop: "12px" }}>{documentError}</p>}
              {fullDocument && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", color: DARK, lineHeight: "1.6", margin: "16px 0 0 0", padding: "16px", backgroundColor: "#FAFAFA", borderRadius: "10px", border: `1px solid ${BORDER}` }}>{(fullDocument || '').replace(/^#{1,6}\s*/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/^-{3,}$/gm, '')}</pre>
              )}
            </div>
        </div>
      )}
    </div>
  );
}

function SpeakerToolsPanel({ text, onChange }: { text: string; onChange: (t: string) => void }) {
  const [mergeFrom, setMergeFrom] = useState("");
  const [mergeTo, setMergeTo] = useState("");
  const [swapPart, setSwapPart] = useState("");
  const [swapA, setSwapA] = useState("");
  const [swapB, setSwapB] = useState("");
  const [prevText, setPrevText] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const nums: number[] = Array.from(speakerNumbers(text) as unknown as Iterable<number>);
  if (nums.length < 2 && prevText === null) return null;
  const parts: number[] = Array.from(partNumbers(text) as unknown as Iterable<number>);
  const partList: number[] = parts.length > 0 ? parts : [1];
  const pick = (v: string, list: number[], fallbackIndex: number): number => {
    const n = Number(v);
    return v !== "" && list.includes(n) ? n : list[Math.min(fallbackIndex, list.length - 1)];
  };
  const from = pick(mergeFrom, nums, 0);
  const to = pick(mergeTo, nums, 1);
  const part = pick(swapPart, partList, 0);
  const a = pick(swapA, nums, 0);
  const b = pick(swapB, nums, 1);
  const apply = (out: unknown, message: string) => {
    if (typeof out === "string" && out !== text) {
      setPrevText(text);
      onChange(out);
      setNote(message);
    } else {
      setNote("Nothing changed.");
    }
  };
  const selStyle = { padding: "6px 8px", borderRadius: "8px", border: "1px solid " + BORDER, fontSize: "13px", color: DARK, backgroundColor: "#FFFFFF", margin: "0 6px" };
  const btnStyle = (off: boolean) => ({ padding: "7px 12px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 700, cursor: off ? "not-allowed" : "pointer", opacity: off ? 0.5 : 1, backgroundColor: GOLD, color: DARK });
  const rowStyle = { display: "flex", flexWrap: "wrap" as const, alignItems: "center", marginBottom: "10px", fontSize: "13px", color: DARK };
  const pickList = (value: number, list: number[], set: (v: string) => void, label: string) => (
    <select value={String(value)} onChange={(e) => set(e.target.value)} aria-label={label} style={selStyle}>
      {list.map((n) => (
        <option key={n} value={String(n)}>{n}</option>
      ))}
    </select>
  );
  return (
    <div style={{ backgroundColor: "#FAFAFA", border: "1px solid " + BORDER, borderRadius: "10px", padding: "12px 14px", marginBottom: "12px" }}>
      <p style={{ color: DARK, fontSize: "13px", fontWeight: 700, margin: "0 0 4px 0" }}>Speaker tools</p>
      <p style={{ color: MUTED, fontSize: "12px", margin: "0 0 10px 0" }}>
        {nums.length} speaker labels found. Speaker numbers restart in each part, so the same person can have different numbers in different parts. Fix them here before generating notes.
      </p>
      {nums.length > 1 && (
        <div>
          <div style={rowStyle}>
            <span>Merge Speaker</span>
            {pickList(from, nums, setMergeFrom, "Merge from speaker")}
            <span>into</span>
            {pickList(to, nums, setMergeTo, "Merge into speaker")}
            <button type="button" disabled={from === to} onClick={() => apply(mergeSpeakers(text, from, to), "Merged Speaker " + from + " into Speaker " + to + ".")} style={btnStyle(from === to)}>Merge</button>
          </div>
          <div style={rowStyle}>
            <span>Swap Speaker</span>
            {pickList(a, nums, setSwapA, "Swap speaker")}
            <span>and</span>
            {pickList(b, nums, setSwapB, "With speaker")}
            <span>in Part</span>
            {pickList(part, partList, setSwapPart, "In part")}
            <button type="button" disabled={a === b} onClick={() => apply(swapSpeakersInPart(text, part, a, b), "Swapped Speaker " + a + " and Speaker " + b + " in Part " + part + ".")} style={btnStyle(a === b)}>Swap</button>
          </div>
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center" }}>
        {prevText !== null && (
          <button type="button" onClick={() => { onChange(prevText); setPrevText(null); setNote("Undone."); }} style={btnStyle(false)}>Undo last tool change</button>
        )}
        {note && <span style={{ color: MUTED, fontSize: "12px", marginLeft: "10px" }}>{note}</span>}
      </div>
    </div>
  );
}

function downloadStamp(): string {
  const d = new Date();
  const p = (n: number) => (n < 10 ? "0" : "") + n;
  return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate());
}

// Saves text as a file on the user's device (UTF-8 with a marker so accents show correctly).
function downloadTextFile(filename: string, text: string) {
  try {
    const blob = new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch {}
}
