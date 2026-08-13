"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
);

const GOLD = "#D4AF37";
const DARK = "#333333";
const MUTED = "#555555";
const BG = "#F9F9F9";
const BORDER = "#EEEEEE";

const CHUNK_LENGTH_SECONDS = 300; // 5 minutes
const CHUNK_OVERLAP_SECONDS = 15;

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
  const [uploading, setUploading] = useState(false);
  const [sessionId, setSessionId] = useState("");
  const [processingMsg, setProcessingMsg] = useState("");

  const [transcript, setTranscript] = useState("");
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

  const runOneShotTranscription = async (currentSessionId: string, audioPath: string) => {
    const res = await fetch("/api/voice-transcription/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, audioPath }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transcription failed. Please try again.");
    return data.transcript as string;
  };

  const runChunkedTranscription = async (audioPath: string, durationSeconds: number) => {
    let accumulated = "";
    let start = 0;
    const step = CHUNK_LENGTH_SECONDS - CHUNK_OVERLAP_SECONDS;
    const totalChunks = Math.max(1, Math.ceil(durationSeconds / step));
    let chunkIndex = 0;

    while (start < durationSeconds) {
      chunkIndex += 1;
      setProcessingMsg(`Please be patient, as we process your transcript. Transcribing part ${chunkIndex} of ${totalChunks}...`);

      const chunkDuration = Math.min(CHUNK_LENGTH_SECONDS, durationSeconds - start);

      const res = await fetch("/api/voice-transcription/chunk-transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioPath, startSeconds: start, durationSeconds: chunkDuration }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Transcription failed on part ${chunkIndex}. Please try again.`);

      accumulated = mergeTranscriptChunks(accumulated, data.text || "");
      start += step;
    }

    return accumulated;
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

      if (probeRes.ok && typeof probeData.durationSeconds === "number" && probeData.durationSeconds > CHUNK_LENGTH_SECONDS) {
        finalTranscript = await runChunkedTranscription(path, probeData.durationSeconds);
      } else {
        finalTranscript = await runOneShotTranscription(session.id, path);
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

  const handleGenerateNotes = async () => {
    setGeneratingNotes(true);
    setErrorMsg("");
    try {
      const res = await fetch("/api/voice-transcription/interpret", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      const data = await res.json();
      setNotes(data.notes);

      await supabase
        .from("voice_transcription_sessions")
        .update({ raw_transcript: transcript, interpretive_notes: data.notes, status: "completed", updated_at: new Date().toISOString() })
        .eq("id", sessionId);

      setStage("notes");
    } catch {
      setErrorMsg("Something went wrong generating notes. Please try again.");
    }
    setGeneratingNotes(false);
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
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "16px" }}>Upload your interview recording. We'll transcribe it and generate detailed interpretive notes.</p>
          <input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] || null)} style={{ marginBottom: "16px", fontSize: "13px" }} />
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
          <textarea value={transcript} onChange={(e) => setTranscript(e.target.value)} style={{ width: "100%", minHeight: "260px", padding: "12px 14px", borderRadius: "10px", border: "1px solid #DDDDDD", fontSize: "14px", color: DARK, lineHeight: 1.6, boxSizing: "border-box" as const, marginBottom: "16px" }} />
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <button onClick={handleGenerateNotes} disabled={generatingNotes || !transcript.trim()} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
            {generatingNotes ? "Generating interpretive notes..." : "Generate Interpretive Notes"}
          </button>
        </div>
      )}

      {stage === "notes" && (
        <div>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, marginBottom: "16px" }}>
            <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "10px" }}>Interpretive Notes</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "14px", color: DARK, lineHeight: "1.6", margin: 0 }}>{notes}</pre>
          </div>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
            <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "10px" }}>Full Transcript</p>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", color: MUTED, lineHeight: "1.6", margin: 0 }}>{transcript}</pre>
          </div>
          <button onClick={handleSaveToBunker} disabled={saving} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "16px" }}>
            {saving ? "Saving..." : "Save to My Bunker"}
          </button>
          {savedMsg && <p style={{ color: savedMsg.includes("successfully") ? "#1D8A4C" : "#C0392B", fontSize: "13px", fontWeight: 600, marginTop: "12px", textAlign: "center" }}>{savedMsg}</p>}
        </div>
      )}
    </div>
  );
}
