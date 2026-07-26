"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { BotIcon, SendIcon, XIcon } from "@/components/ui/icons";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING: Message = {
  role: "assistant",
  content:
    "Halo! Saya asisten AI MYCOLOOP-AI. Saya bisa bantu jelaskan kondisi batch, alasan keputusan AI, atau rekomendasi langkah berikutnya di Smart Mixing, Pre-Conditioning, maupun Incubation. Saya cuma bisa kasih info & saran lewat teks — aksi di sistem tetap kamu yang jalankan sendiri.",
};

interface AssistantPanelProps {
  onClose: () => void;
}

export function AssistantPanel({ onClose }: AssistantPanelProps) {
  const [messages, setMessages] = useState<Message[]>([GREETING]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages = [...messages, { role: "user" as const, content: text }];
    setMessages(nextMessages);
    setInput("");
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/assistant/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "Asisten AI gagal merespons.");
        return;
      }

      setMessages((prev) => [...prev, { role: "assistant", content: data.reply }]);
    } catch {
      setError("Tidak bisa menghubungi asisten AI. Cek koneksi internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/20 sm:bg-transparent sm:inset-auto sm:bottom-24 sm:right-4 md:right-6">
      <div className="flex h-full w-full flex-col bg-card shadow-elevated sm:h-[32rem] sm:w-96 sm:rounded-card sm:border sm:border-border">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-green-100)] text-[var(--color-green-700)]">
            <BotIcon className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-card-foreground">Asisten AI</p>
            <p className="truncate text-xs text-muted-foreground">Read-only — info &amp; rekomendasi, tanpa eksekusi aksi</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Tutup asisten"
            className="shrink-0 rounded-full p-1.5 text-muted-foreground hover:bg-muted"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] whitespace-pre-wrap rounded-card px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-background-subtle text-card-foreground"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-card bg-background-subtle px-3 py-2 text-sm text-muted-foreground">
                Mengetik...
              </div>
            </div>
          )}
          {error && <p className="text-sm text-status-danger">{error}</p>}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-2 border-t border-border p-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Tanya soal batch, alert, atau langkah berikutnya..."
            disabled={loading}
            className="flex-1 rounded-full border border-border bg-background px-3.5 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Kirim pesan"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary-hover disabled:opacity-50"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
