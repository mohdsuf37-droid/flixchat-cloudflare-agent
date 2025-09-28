import { Agent } from "@cloudflare/agents";

/**
 * Make sure these models exist in YOUR account.
 * Check with:  npx wrangler ai models
 */
const CHAT_MODEL  = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";

type Env = {
  AI: Ai;
  VECTORIZE_INDEX: VectorizeIndex;
};

type Msg = { role: "user" | "assistant"; text: string };

type Profile = {
  name?: string;
  likes: string[];
  custom: string[]; // any extra remembered statements
};

export class MyAgent extends Agent<Env> {
  /** Short-term conversation buffer (lives with this Durable Object instance) */
  private _recent: Msg[] = [];

  /** Small structured profile we always inject into the prompt */
  private profile: Profile = { likes: [], custom: [] };

  /** Lazy-load flag for profile persistence (optional) */
  private loaded = false;

  // ----------------- Public RPCs -----------------

  /** Non-streaming chat */
  async chat({ message }: { message: string }) {
    await this.ensureLoaded();

    // 0) If user asked to "remember ...", parse and store facts
    const factsChanged = this.tryCaptureFacts(message);
    if (factsChanged) {
        try {
            const st: any = (this as any).storage;
            if (st && typeof st.put === "function") {
                await st.put("profile", this.profile);
            }
        } catch {
            // ignore – persistence is optional
        }
    }


    // 1) Save user turn to short-term memory
    this.pushRecent({ role: "user", text: message });

    // 2) Semantic memory (Vectorize)
    const userVec = await this.embed(message);
    if (userVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `u:${Date.now()}`, values: userVec, metadata: { role: "user", text: message } },
      ]);
    }

    // 3) Build LLM history and prepend memories (profile + vector recall)
    const history = this.buildHistory();
    await this.prependMemories(history, userVec);

    // 4) Call the LLM (do NOT append message again; it's already in history)
    const aiResp: any = await this.env.AI.run(CHAT_MODEL, { messages: history, stream: false });

    const assistantText =
      aiResp?.response ??
      aiResp?.result ??
      aiResp?.choices?.[0]?.message?.content ??
      "Sorry, I couldn't generate a reply.";

    // 5) Save assistant turn + embed for future recall
    this.pushRecent({ role: "assistant", text: assistantText });

    const asstVec = await this.embed(assistantText);
    if (asstVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `a:${Date.now()}`, values: asstVec, metadata: { role: "assistant", text: assistantText } },
      ]);
    }

    return { text: assistantText };
  }

  /** Streaming chat (Server-Sent Events) */
  async streamChat({ message }: { message: string }) {
    await this.ensureLoaded();

    const factsChanged = this.tryCaptureFacts(message);
    if (factsChanged) {
        try {
            const st: any = (this as any).storage;
            if (st && typeof st.put === "function") {
                 await st.put("profile", this.profile);
            }
        } catch {
        // ignore – persistence is optional
        }
    }


    // 1) Save user turn
    this.pushRecent({ role: "user", text: message });

    // 2) Embed & upsert
    const userVec = await this.embed(message);
    if (userVec) {
      await this.env.VECTORIZE_INDEX.upsert([
        { id: `u:${Date.now()}`, values: userVec, metadata: { role: "user", text: message } },
      ]);
    }

    // 3) Build history & memories
    const history = this.buildHistory();
    await this.prependMemories(history, userVec);

    // 4) Stream tokens
    const aiStream: any = await this.env.AI.run(CHAT_MODEL, { messages: history, stream: true });

    const encoder = new TextEncoder();
    const ts = new TransformStream();
    const writer = ts.writable.getWriter();

    (async () => {
      let full = "";
      try {
        for await (const chunk of aiStream) {
          const token = chunk?.response ?? chunk?.delta ?? "";
          if (token) {
            full += token;
            // standard SSE frame
            await writer.write(encoder.encode(`data: ${token}\n\n`));
          }
        }

        // Save & embed assistant output
        this.pushRecent({ role: "assistant", text: full });
        const asstVec = await this.embed(full);
        if (asstVec) {
          await this.env.VECTORIZE_INDEX.upsert([
            { id: `a:${Date.now()}`, values: asstVec, metadata: { role: "assistant", text: full } },
          ]);
        }

        // Clean end event (no printable markers)
        await writer.write(encoder.encode(`event: done\ndata:\n\n`));
      } catch (e) {
        await writer.write(encoder.encode(`event: error\ndata: ${String(e)}\n\n`));
      } finally {
        await writer.close();
      }
    })();

    return { readable: ts.readable };
  }

  /** Used by the right panel in your UI */
  getRecent() {
    return { recent: this._recent.slice(-10) };
  }

  // ----------------- Helpers -----------------

  /** Load profile from Durable Object storage (once) */
  // 1) replace your ensureLoaded() with this guarded version
    private async ensureLoaded() {
    if (this.loaded) return;

        try {
            // In Durable Objects this is usually available, but in Agents it may not be.
            const st: any = (this as any).storage;
            if (st && typeof st.get === "function") {
                const saved = await st.get<Profile>("profile");
                if (saved && typeof saved === "object") {
                    this.profile = { likes: [], custom: [], ...saved };
            }
        }
    } catch {
        // ignore – persistence is optional
    }

    this.loaded = true;
    }


  /** Parse “remember …” into structured facts. Returns true if profile changed. */
  private tryCaptureFacts(message: string): boolean {
    const before = JSON.stringify(this.profile);

    const raw = message.trim();
    const lower = raw.toLowerCase();
    if (!lower.startsWith("remember")) return false;

    // "remember my name is Sam"
    const nameMatch = /my\s+name\s+is\s+([a-z][a-z' -]{1,40})/i.exec(raw);
    if (nameMatch) {
      const name = this.cleanScalar(nameMatch[1]);
      if (name) this.profile.name = this.titleCase(name);
    }

    // "remember I like soccer" / "remember I love sushi"
    const likeMatch = /\bi\s+(?:like|love)\s+(.+)$/i.exec(raw);
    if (likeMatch) {
      const like = this.cleanScalar(likeMatch[1]);
      if (like) this.pushUnique(this.profile.likes, like);
    }

    // "remember my favorite sport is soccer"
    const favMatch = /my\s+favorite\s+([a-z ]+?)\s+is\s+(.+)$/i.exec(raw);
    if (favMatch) {
      const what = this.cleanScalar(favMatch[1]);
      const val  = this.cleanScalar(favMatch[2]);
      if (what && val) this.pushUnique(this.profile.likes, `${what}: ${val}`);
    }

    // If nothing matched, store the raw clause after "remember"
    if (!nameMatch && !likeMatch && !favMatch) {
      const custom = raw.replace(/^remember\s*/i, "").trim();
      if (custom) this.pushUnique(this.profile.custom, custom);
    }

    return JSON.stringify(this.profile) !== before;
  }

  private pushRecent(m: Msg) {
    this._recent.push(m);
    // keep last ~20 turns
    if (this._recent.length > 20) this._recent.splice(0, this._recent.length - 20);
  }

  /** Build conversation history sent to the model */
  private buildHistory() {
    const history: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: "You are a helpful, concise assistant." },
    ];
    for (const m of this._recent) {
      history.push({ role: m.role === "assistant" ? "assistant" : "user", content: m.text });
    }
    return history;
  }

  /** Prepend explicit profile + semantic recall to the prompt */
  private async prependMemories(
    history: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    userVec: number[] | null
  ) {
    // 1) Structured profile (deterministic)
    const facts: string[] = [];
    if (this.profile.name) facts.push(`name: ${this.profile.name}`);
    if (this.profile.likes.length) facts.push(`likes: ${this.profile.likes.join(", ")}`);
    if (this.profile.custom.length) facts.push(...this.profile.custom);

    if (facts.length) {
      history.unshift({
        role: "system",
        content:
          `Known user profile (treat as true unless contradicted):\n` +
          facts.map((f) => `- ${f}`).join("\n"),
      });
    }

    // 2) Semantic recall (Vectorize)
    if (userVec) {
      const recalled = await this.recall(userVec, 4);
      if (recalled.length) {
        history.unshift({
          role: "system",
          content: `Relevant notes from memory:\n- ${recalled.join("\n- ")}`,
        });
      }
    }
  }

  private cleanScalar(s: string) {
    return s.replace(/^that\s+/i, "").replace(/[.?!]+$/g, "").trim();
  }

  private titleCase(s: string) {
    return s
      .split(/\s+/)
      .map((w) => w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase())
      .join(" ");
  }

  private pushUnique(arr: string[], v: string) {
    const key = v.toLowerCase();
    if (!arr.some((x) => x.toLowerCase() === key)) arr.push(v);
  }

  private async embed(text: string): Promise<number[] | null> {
    try {
      const resp: any = await this.env.AI.run(EMBED_MODEL, { text });
      const vec: number[] = resp?.embedding ?? resp?.data?.[0]?.embedding;
      return Array.isArray(vec) ? vec : null;
    } catch {
      return null;
    }
  }

  private async recall(vec: number[], topK = 4): Promise<string[]> {
    try {
      const q = await this.env.VECTORIZE_INDEX.query(vec, { topK });
      return (q?.matches ?? []).map((m: any) => m?.metadata?.text).filter(Boolean);
    } catch {
      return [];
    }
  }
}
