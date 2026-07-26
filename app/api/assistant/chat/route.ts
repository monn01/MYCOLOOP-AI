import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth/options";
import { buildStageSnapshots, formatSnapshotsForPrompt } from "@/lib/ai-assistant/context";
import { askGemini, AssistantNotConfiguredError, type ChatMessage } from "@/lib/ai-assistant/gemini";

export const dynamic = "force-dynamic";

const MAX_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Tidak terautentikasi" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const messages = body?.messages;

  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "messages wajib diisi (array)" }, { status: 400 });
  }

  const cleaned: ChatMessage[] = [];
  for (const m of messages.slice(-MAX_MESSAGES)) {
    if (
      (m?.role === "user" || m?.role === "assistant") &&
      typeof m?.content === "string" &&
      m.content.trim().length > 0
    ) {
      cleaned.push({ role: m.role, content: m.content.slice(0, MAX_MESSAGE_LENGTH) });
    }
  }

  if (cleaned.length === 0) {
    return NextResponse.json({ error: "Tidak ada pesan valid" }, { status: 400 });
  }

  try {
    const snapshots = await buildStageSnapshots();
    const contextBlock = formatSnapshotsForPrompt(snapshots);
    const reply = await askGemini(cleaned, contextBlock);
    return NextResponse.json({ reply });
  } catch (error) {
    if (error instanceof AssistantNotConfiguredError) {
      return NextResponse.json({ error: error.message }, { status: 503 });
    }
    const message = error instanceof Error ? error.message : "Gagal menghubungi asisten AI";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
