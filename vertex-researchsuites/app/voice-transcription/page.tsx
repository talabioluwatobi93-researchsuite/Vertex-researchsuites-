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

  const runOneShotTranscription = async (currentSessionId: string, audioPath: string, lang: string) => {
    const res = await fetch("/api/voice-transcription/transcribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: currentSessionId, audioPath, language: lang, languageHint }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Transcription failed. Please try again.");
    return data.transcript as string;
  };

  const runChunkedTranscription = async (audioPath: string, durationSeconds: number, lang: string) => {
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
        body: JSON.stringify({ audioPath, startSeconds: start, durationSeconds: chunkDuration, language: lang, languageHint }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Transcription failed on part ${chunkIndex}. Please try again.`);

      accumulated = mergeTranscriptChunks(accumulated, data.text || "");
      start += step;
    }

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
      if (probeRes.ok && typeof probeData.durationSeconds === "number" && probeData.durationSeconds > CHUNK_LENGTH_SECONDS) {
        finalTranscript = await runChunkedTranscription(uploadData.path, probeData.durationSeconds, language);
      } else {
        finalTranscript = await runOneShotTranscription(uploadData.sessionId, uploadData.path, language);
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

      if (probeRes.ok && typeof probeData.durationSeconds === "number" && probeData.durationSeconds > CHUNK_LENGTH_SECONDS) {
        finalTranscript = await runChunkedTranscription(path, probeData.durationSeconds, language);
      } else {
        finalTranscript = await runOneShotTranscription(session.id, path, language);
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
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "16px" }}>Upload your interview recording. We'll transcribe it and generate detailed interpretive notes.</p>
          <label style={{ display: "block", width: "100%", padding: "14px", marginBottom: "16px", backgroundColor: "#F5F5F5", border: "2px dashed #CCCCCC", borderRadius: "10px", textAlign: "center", fontSize: "14px", color: "#333333", fontWeight: 600, cursor: "pointer" }}>
            {file ? file.name : "Tap here to choose an audio file"}
            <input type="file" accept="audio/*" onChange={(e) => {
              const selected = e.target.files?.[0] || null
              if (selected) {
                const allowedExt = ["flac", "mp3", "mp4", "mpeg", "mpga", "m4a", "ogg", "opus", "wav", "webm"]
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
                <optgroup label="Tier 1: Excellent (WER 2.7%-10%)">
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="ja">Japanese</option>
                </optgroup>
                <optgroup label="Tier 2: Strong (WER 10%-20%)">
                  <option value="zh">Mandarin</option>
                  <option value="ko">Korean</option>
                  <option value="tr">Turkish</option>
                  <option value="ar">Arabic</option>
                  <option value="uk">Ukrainian</option>
                  <option value="vi">Vietnamese</option>
                  <option value="el">Greek</option>
                </optgroup>
                <optgroup label="Tier 3: Moderate (WER 20%-40%)">
                  <option value="hi">Hindi</option>
                  <option value="ms">Malay</option>
                  <option value="tl">Tagalog</option>
                  <option value="ur">Urdu</option>
                  <option value="sw">Swahili</option>
                  <option value="bn">Bengali</option>
                  <option value="fa">Persian</option>
                </optgroup>
                <optgroup label="Tier 4: Low Resource (WER 40%+, correction recommended)">
                  <option value="yo">Yoruba</option>
                  <option value="ig">Igbo</option>
                  <option value="ha">Hausa</option>
                  <option value="am">Amharic</option>
                  <option value="zu">Zulu</option>
                  <option value="cy">Welsh</option>
                  <option value="ne">Nepali</option>
                </optgroup>
              </select>
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

            <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}`, marginTop: "16px" }}>
              <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "6px" }}>Full Academic Document</p>
              <p style={{ color: MUTED, fontSize: 13, marginBottom: "12px" }}>Generate a publication-ready document with corrected diacritics, translated code-switched terms, and a glossary — built from your transcript and language hint.</p>
              <button onClick={handleGenerateDocument} disabled={generatingDocument || !transcript.trim()} style={{ width: "100%", backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
                {generatingDocument ? "Generating document..." : "Generate Full Document"}
              </button>
              {documentError && <p style={{ color: "#C0392B", fontSize: "13px", marginTop: "12px" }}>{documentError}</p>}
              {fullDocument && (
                <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "13px", color: DARK, lineHeight: "1.6", margin: "16px 0 0 0", padding: "16px", backgroundColor: "#FAFAFA", borderRadius: "10px", border: `1px solid ${BORDER}` }}>{fullDocument}</pre>
              )}
            </div>
        </div>
      )}
    </div>
  );
}
