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

type TopicPreview = { title: string; summary: string; raw: string };

function parseTopics(text: string): TopicPreview[] {
  const chunks = text.split(/-{5,}/).map((c) => c.trim()).filter(Boolean);
  return chunks.map((chunk) => {
    const titleMatch = chunk.match(/Topic\s*\d+:\s*(.+)/i);
    const title = titleMatch ? titleMatch[1].trim() : chunk.split("\n")[0];
    const summary = chunk.replace(/Topic\s*\d+:\s*.+/i, "").trim();
    return { title, summary, raw: chunk };
  });
}

function problemLabel(category: string) {
  if (category === "student") return "What problem are you trying to solve in your course or project?";
  if (category === "researcher") return "What research problem or gap are you trying to address?";
  if (category === "professional") return "What workplace or industry challenge are you trying to solve?";
  return "What problem or challenge are you trying to solve?";
}

type Stage = "loading" | "fee-confirm" | "select-type" | "pure-form" | "applied-form" | "results";

export default function NewProposal() {
  const router = useRouter();

  const [userId, setUserId] = useState("");
  const [userCategory, setUserCategory] = useState("");

  const [stage, setStage] = useState<Stage>("loading");
  const [researchType, setResearchType] = useState<"pure" | "applied" | "">("");

  const [institution, setInstitution] = useState("");
  const [course, setCourse] = useState("");
  const [department, setDepartment] = useState("");
  const [interest, setInterest] = useState("");
  const [sequence, setSequence] = useState("");
  const [problemStatement, setProblemStatement] = useState("");

  const [previewPrice, setPreviewPrice] = useState(0);
  const [fullPrice, setFullPrice] = useState(0);
  const [payingFee, setPayingFee] = useState(false);

  const [loading, setLoading] = useState(false);
  const [topics, setTopics] = useState<TopicPreview[]>([]);
  const [errorMsg, setErrorMsg] = useState("");

  const [selectedTopic, setSelectedTopic] = useState<TopicPreview | null>(null);
  const [showFullConfirm, setShowFullConfirm] = useState(false);
  const [generatingFull, setGeneratingFull] = useState(false);
  const [fullProposal, setFullProposal] = useState("");

  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      setUserCategory((user.user_metadata as any)?.account_type || "");

      try {
        const { data: previewData } = await supabase
          .from("feature_pricing")
          .select("price")
          .eq("feature_name", "research_topics")
          .single();
        const price = previewData?.price ?? 0;
        setPreviewPrice(price);

        const { data: fullData } = await supabase
          .from("feature_pricing")
          .select("price")
          .eq("feature_name", "research_proposal_full")
          .single();
        setFullPrice(fullData?.price ?? 0);

        setStage(price === 0 ? "select-type" : "fee-confirm");
      } catch {
        setPreviewPrice(0);
        setFullPrice(0);
        setStage("select-type");
      }
    };
    init();
  }, []);

  const handleAcceptFee = async () => {
    setPayingFee(true);
    setErrorMsg("");
    try {
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("id", userId).single();
      const balance = wallet?.balance ?? 0;

      if (balance < previewPrice) {
        setErrorMsg("Your balance is not enough, kindly top up.");
        setPayingFee(false);
        return;
      }

      const { error: deductError } = await supabase
        .from("wallets")
        .update({ balance: balance - previewPrice })
        .eq("id", userId);

      if (deductError) {
        setErrorMsg("Could not process payment. Please try again.");
        setPayingFee(false);
        return;
      }

      setStage("select-type");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    }
    setPayingFee(false);
  };

  const handleRejectFee = () => router.push("/dashboard");

  const handleSelectPure = () => { setResearchType("pure"); setStage("pure-form"); };
  const handleSelectApplied = () => { setResearchType("applied"); setStage("applied-form"); };

  const canGeneratePure = institution && course && department;
  const canGenerateApplied = institution && course && department && problemStatement;

  const handleGenerateTopics = async () => {
    setTopics([]);
    setSelectedTopic(null);
    setFullProposal("");
    setSavedMsg("");
    setErrorMsg("");
    setLoading(true);

    try {
      const res = await fetch("/api/generate-topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution, course, department, researchType, interest, sequence, problemStatement, userCategory }),
      });
      const data = await res.json();
      setTopics(parseTopics(data.topics));
      setStage("results");
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const handleChooseTopic = (topic: TopicPreview) => {
    setSelectedTopic(topic);
    setErrorMsg("");
    if (fullPrice === 0) {
      handleGenerateFullProposal(topic);
    } else {
      setShowFullConfirm(true);
    }
  };

  const handleAcceptFull = async () => {
    if (!selectedTopic) return;
    setShowFullConfirm(false);
    setErrorMsg("");
    setGeneratingFull(true);

    try {
      const { data: wallet } = await supabase.from("wallets").select("balance").eq("id", userId).single();
      const balance = wallet?.balance ?? 0;

      if (balance < fullPrice) {
        setErrorMsg("Your balance is not enough, kindly top up.");
        setGeneratingFull(false);
        return;
      }

      const { error: deductError } = await supabase
        .from("wallets")
        .update({ balance: balance - fullPrice })
        .eq("id", userId);

      if (deductError) {
        setErrorMsg("Could not process payment. Please try again.");
        setGeneratingFull(false);
        return;
      }

      await handleGenerateFullProposal(selectedTopic);
    } catch {
      setErrorMsg("Something went wrong. Please try again.");
      setGeneratingFull(false);
    }
  };

  const handleGenerateFullProposal = async (topic: TopicPreview) => {
    setGeneratingFull(true);
    setSavedMsg("");
    try {
      const res = await fetch("/api/generate-proposal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ institution, course, department, interest, sequence, researchType, problemStatement, chosenTopic: topic.raw }),
      });
      const data = await res.json();
      setFullProposal(data.proposal);
    } catch {
      setErrorMsg("Something went wrong generating the full proposal. Please try again.");
    }
    setGeneratingFull(false);
  };

  const handleSaveToBunker = async () => {
    setSaving(true);
    setSavedMsg("");
    try {
      const itemName = selectedTopic
        ? `${course} Proposal — ${selectedTopic.title}`
        : `${course} Research Topics — ${institution}`;
      const content = fullProposal || topics.map((t) => t.raw).join("\n\n----------\n\n");

      const { error } = await supabase.from("bunker_items").insert({
        user_id: userId,
        item_name: itemName,
        content_reference: content,
      });

      setSavedMsg(error ? "Could not save to Bunker. Please try again." : "Saved to My Bunker successfully!");
    } catch {
      setSavedMsg("Something went wrong. Please try again.");
    }
    setSaving(false);
  };

  const inputStyle = {
    width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #DDDDDD",
    fontSize: "14px", color: "#333333", marginBottom: "14px", boxSizing: "border-box" as const,
  };
  const labelStyle = { fontSize: "13px", fontWeight: 600, color: "#333333", marginBottom: "6px", display: "block" as const };

  if (stage === "loading") {
    return (
      <div style={{ minHeight: "100vh", background: BG, display: "flex", alignItems: "center", justifyContent: "center", color: MUTED, fontSize: 14 }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: BG, minHeight: "100vh", padding: "24px 20px" }}>
      <h1 style={{ color: DARK, fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>
        Get Research Topics & Proposals
      </h1>

      {stage === "fee-confirm" && (
        <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
          <p style={{ color: DARK, fontSize: 16, fontWeight: 700, marginBottom: "8px" }}>Confirm Payment</p>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "20px" }}>
            ₦{previewPrice} will be deducted from your wallet to use this feature. Do you want to proceed?
          </p>
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={handleRejectFee} style={{ flex: 1, backgroundColor: "#EEEEEE", color: DARK, border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Cancel</button>
            <button onClick={handleAcceptFee} disabled={payingFee} style={{ flex: 1, backgroundColor: GOLD, color: DARK, border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>
              {payingFee ? "Processing..." : "Accept & Continue"}
            </button>
          </div>
        </div>
      )}

      {stage === "select-type" && (
        <div>
          <p style={{ color: MUTED, fontSize: 14, marginBottom: "16px" }}>What kind of research topic are you intending?</p>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <button onClick={handleSelectPure} style={{ textAlign: "left", backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: "16px", padding: "18px 20px", cursor: "pointer" }}>
              <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "6px" }}>Pure (Basic) Research</p>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>Focused on generating new knowledge or theory, not tied to solving a specific practical problem.</p>
            </button>
            <button onClick={handleSelectApplied} style={{ textAlign: "left", backgroundColor: "#ffffff", border: `1px solid ${BORDER}`, borderRadius: "16px", padding: "18px 20px", cursor: "pointer" }}>
              <p style={{ color: DARK, fontSize: 15, fontWeight: 700, marginBottom: "6px" }}>Applied Research</p>
              <p style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>Focused on solving a specific, real-world problem or challenge.</p>
            </button>
          </div>
        </div>
      )}

      {stage === "pure-form" && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "16px", border: `1px solid ${BORDER}` }}>
          <label style={labelStyle}>Institution</label>
          <input style={inputStyle} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Lagos" />
          <label style={labelStyle}>Course of Study</label>
          <input style={inputStyle} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Computer Science" />
          <label style={labelStyle}>Department</label>
          <input style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Physical Sciences" />
          <label style={labelStyle}>Research Interest (optional)</label>
          <input style={inputStyle} value={interest} onChange={(e) => setInterest(e.target.value)} placeholder="e.g. Renewable energy, maternal health" />
          <label style={labelStyle}>Specific Focus (optional)</label>
          <input style={inputStyle} value={sequence} onChange={(e) => setSequence(e.target.value)} placeholder="e.g. Artificial Intelligence, Renewable Energy" />
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <button onClick={handleGenerateTopics} disabled={loading || !canGeneratePure} style={{ width: "100%", backgroundColor: GOLD, color: "#333333", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "8px" }}>
            {loading ? "Generating your topics..." : "Generate 5 Topics"}
          </button>
        </div>
      )}

      {stage === "applied-form" && (
        <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "16px", border: `1px solid ${BORDER}` }}>
          <label style={labelStyle}>Institution / Organization</label>
          <input style={inputStyle} value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="e.g. University of Lagos, or your company" />
          <label style={labelStyle}>Course / Field of Study</label>
          <input style={inputStyle} value={course} onChange={(e) => setCourse(e.target.value)} placeholder="e.g. Computer Science" />
          <label style={labelStyle}>Department / Specialization</label>
          <input style={inputStyle} value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="e.g. Physical Sciences" />
          <label style={labelStyle}>{problemLabel(userCategory)}</label>
          <textarea style={{ ...inputStyle, minHeight: "90px", resize: "vertical" as const }} value={problemStatement} onChange={(e) => setProblemStatement(e.target.value)} placeholder="Describe the specific problem or challenge you want your research to address" />
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginBottom: "12px" }}>{errorMsg}</p>}
          <button onClick={handleGenerateTopics} disabled={loading || !canGenerateApplied} style={{ width: "100%", backgroundColor: GOLD, color: "#333333", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "8px" }}>
            {loading ? "Generating your topics..." : "Generate 5 Topics"}
          </button>
        </div>
      )}

      {stage === "results" && !fullProposal && (
        <div>
          {topics.length > 0 && (
            <div style={{ marginTop: "16px" }}>
              {topics.map((topic, i) => (
                <div key={i} style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "18px", border: `1px solid ${BORDER}`, marginBottom: "12px" }}>
                  <p style={{ fontSize: "15px", fontWeight: 700, color: "#333333", marginBottom: "8px" }}>{topic.title}</p>
                  <p style={{ fontSize: "13px", color: "#555555", lineHeight: "1.6", marginBottom: "14px" }}>{topic.summary}</p>
                  <button onClick={() => handleChooseTopic(topic)} disabled={generatingFull} style={{ backgroundColor: "#333333", color: "#ffffff", border: "none", borderRadius: "10px", padding: "10px 16px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
                    {generatingFull && selectedTopic?.title === topic.title ? "Generating full proposal..." : "Get Full Proposal"}
                  </button>
                </div>
              ))}
            </div>
          )}
          {errorMsg && <p style={{ color: "#C0392B", fontSize: 13, marginTop: "8px" }}>{errorMsg}</p>}
          <button onClick={() => { setTopics([]); setStage(researchType === "applied" ? "applied-form" : "pure-form"); setErrorMsg(""); }} style={{ marginTop: "8px", backgroundColor: "transparent", color: "#333333", border: "1px solid #DDDDDD", borderRadius: "10px", padding: "12px 18px", fontSize: "13px", fontWeight: 700, cursor: "pointer" }}>
            Generate Again
          </button>
        </div>
      )}

      {fullProposal && (
        <div style={{ marginTop: "16px" }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "16px", padding: "20px", border: `1px solid ${BORDER}` }}>
            <pre style={{ whiteSpace: "pre-wrap", fontFamily: "inherit", fontSize: "14px", color: "#333333", lineHeight: "1.6", margin: 0 }}>{fullProposal}</pre>
          </div>
          <button onClick={handleSaveToBunker} disabled={saving} style={{ width: "100%", backgroundColor: GOLD, color: "#333333", border: "none", borderRadius: "10px", padding: "14px", fontSize: "14px", fontWeight: 700, cursor: "pointer", marginTop: "16px" }}>
            {saving ? "Saving..." : "Save to My Bunker"}
          </button>
          {savedMsg && (
            <p style={{ color: savedMsg.includes("successfully") ? "#1D8A4C" : "#C0392B", fontSize: "13px", fontWeight: 600, marginTop: "12px", textAlign: "center" }}>{savedMsg}</p>
          )}
        </div>
      )}

      {showFullConfirm && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", padding: "20px", zIndex: 100 }}>
          <div style={{ backgroundColor: "#ffffff", borderRadius: "18px", padding: "24px", maxWidth: "340px", width: "100%", textAlign: "center" }}>
            <p style={{ color: "#333333", fontSize: 16, fontWeight: 700, marginBottom: "8px" }}>Confirm Payment</p>
            <p style={{ color: "#555555", fontSize: 14, marginBottom: "20px" }}>₦{fullPrice} will be deducted from your wallet to generate the full proposal. Do you want to proceed?</p>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={() => setShowFullConfirm(false)} style={{ flex: 1, backgroundColor: "#EEEEEE", color: "#333333", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Reject</button>
              <button onClick={handleAcceptFull} style={{ flex: 1, backgroundColor: "#D4AF37", color: "#333333", border: "none", borderRadius: "10px", padding: "12px", fontSize: "14px", fontWeight: 700, cursor: "pointer" }}>Accept</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
