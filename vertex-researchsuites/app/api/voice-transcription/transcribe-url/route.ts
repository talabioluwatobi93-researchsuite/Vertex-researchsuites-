import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const maxDuration = 60;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, audioUrl } = await req.json();

    if (!userId || !audioUrl) {
      return NextResponse.json({ error: "Missing userId or audioUrl." }, { status: 400 });
    }

    let audioRes: Response;
    try {
      audioRes = await fetch(audioUrl);
    } catch {
      return NextResponse.json({ error: "Could not reach that audio link. Check the URL and try again." }, { status: 400 });
    }
    if (!audioRes.ok) {
      return NextResponse.json({ error: "That link did not return a valid file. Check the URL and try again." }, { status: 400 });
    }

    const arrayBuffer = await audioRes.arrayBuffer();
    const path = `${userId}/${Date.now()}-from-url.mp3`;

    const { error: uploadError } = await supabaseAdmin.storage.from("interview-audio").upload(path, Buffer.from(arrayBuffer));
    if (uploadError) {
      return NextResponse.json({ error: "Could not save the audio file. Please try again." }, { status: 500 });
    }

    const { data: session, error: sessionError } = await supabaseAdmin
      .from("voice_transcription_sessions")
      .insert({ user_id: userId, audio_path: path, status: "uploaded", fee_charged: false })
      .select()
      .single();

    if (sessionError || !session) {
      return NextResponse.json({ error: "Could not create transcription session. Please try again." }, { status: 500 });
    }

    return NextResponse.json({ sessionId: session.id, path });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Something went wrong. Please try again." }, { status: 500 });
  }
}
