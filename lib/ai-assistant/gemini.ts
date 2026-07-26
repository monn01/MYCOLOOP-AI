const DEFAULT_MODEL = "gemini-flash-latest";
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export class AssistantNotConfiguredError extends Error {
  constructor() {
    super("GEMINI_API_KEY belum diset di server.");
    this.name = "AssistantNotConfiguredError";
  }
}

const SYSTEM_PROMPT = `Kamu adalah asisten AI untuk MYCOLOOP-AI, software monitoring produksi baglog jamur tiram dari limbah jagung. Sistem punya 3 stage:

1. Smart Mixing — kadar air target 50-60%, rasio C:N target 25-35.
2. Smart Pre-Conditioning — suhu 25-35°C, kelembapan 60-65%, pH 6-7.
3. Smart Incubation Monitoring — suhu 22-28°C, kelembapan 70-90%, CO2 500-1500ppm, cahaya 0-50lux (ruang gelap).

AI decision engine di ketiga stage rule-based (threshold + moving average), BUKAN model ML terlatih. Deteksi kontaminasi di Incubation berbasis pola sensor (CO2 naik + kelembapan turun bersamaan), bukan computer vision sungguhan.

Peranmu: membantu operator/admin memahami kondisi batch yang sedang berjalan, menjelaskan alasan di balik keputusan AI, memberi rekomendasi tindakan, dan membantu proses produksi secara umum. Kamu HANYA memberi informasi dan rekomendasi lewat teks — kamu TIDAK BISA dan TIDAK BOLEH mengklaim mengeksekusi aksi apa pun di sistem (menutup alert, memulai batch, mengubah pengaturan, dll). Kalau user minta kamu melakukan aksi, jelaskan caranya lewat UI dan siapa yang perlu menekan tombolnya.

Jawab singkat, praktis, dan dalam Bahasa Indonesia kecuali diminta bahasa lain. Kalau data yang diberikan tidak cukup untuk menjawab, katakan terus terang alih-alih menebak.

Berikut kondisi terkini seluruh stage:

`;

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

export async function askGemini(messages: ChatMessage[], contextBlock: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new AssistantNotConfiguredError();
  }
  const model = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const res = await fetch(`${API_BASE}/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT + contextBlock }] },
      contents: messages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
    }),
  });

  const data: GeminiResponse = await res.json();

  if (!res.ok) {
    throw new Error(data.error?.message || `Gemini API error (${res.status})`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("Gemini tidak mengembalikan jawaban.");
  }
  return text;
}
