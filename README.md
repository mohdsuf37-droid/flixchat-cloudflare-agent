# FlixChat — Cloudflare AI Agent (Workers AI + Agents SDK + Vectorize)

> Cloudflare Agents SDK + Workers AI (Llama 3.3) + Vectorize = a fast, memory-aware chat agent with a Netflix-style interface and real-time streaming.

**Live demo:** `https://cf-ai-agent-pro.mohdsuf37.workers.dev/app`  
**Repo:** `https://github.com/mohdsuf37-droid/flixchat-cloudflare-agent`

---

## ✨ Features

- **Agents SDK (Durable Objects):** stateful agent with simple RPCs (`chat`, `streamChat`, `getRecent`)
- **Workers AI:** LLM via `@cf/meta/llama-3.3-70b-instruct-fp8-fast`
- **Vectorize:** semantic memory (embeddings via `@cf/baai/bge-small-en-v1.5`)
- **Structured facts:** “remember …” sentences are parsed into user profile (name, likes, etc.) and always injected into the prompt
- **Streaming UI (SSE):** smooth token-by-token responses
- **Netflix-style UI:** side panels, shortcuts, sticky composer
- **Zero-config local dev:** Wrangler dev with remote AI/Vectorize bindings

---

## 🧱 Stack

- **Cloudflare Workers** + **Agents SDK** (state via Durable Objects)
- **Workers AI** for LLM + embeddings
- **Vectorize** for long-term memory (cosine similarity)
- Plain **TypeScript** + minimal HTML/CSS (no framework)
- **SSE** for streaming

---

## ▶️ Quick Start

### Prerequisites
- Node.js 18+ / 20+
- Cloudflare account
- Wrangler: `npm i -g wrangler` (or use `npx` every time)

### 1) Clone & install

git clone https://github.com/<you>/flixchat-cloudflare-agent.git
cd flixchat-cloudflare-agent
npm install

## 2) Login to Cloudflare

npx wrangler login

## 3) Create a Vectorize index
This stores embeddings for long-term memory.

npx wrangler vectorize create agent-memory --dimensions=768 --metric=cosine

## Run locally (with remote AI/Vectorize)

Run locally (with remote AI/Vectorize)

## 5) Deploy

npx wrangler deploy
# then open: https://<your-app>.workers.dev/app

---

## 🗂 Project Structure

src/
  agent.ts        # Agent class: chat + stream + memory (facts + Vectorize)
  index.ts        # Worker routes (/app, /api/chat, /api/chat-stream, /api/recent)
wrangler.toml     # Bindings: Durable Object (MyAgent), AI, Vectorize index
package.json
README.md

---

## 🔧 Configuration

# Models
In src/agent.ts:

const CHAT_MODEL  = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
const EMBED_MODEL = "@cf/baai/bge-small-en-v1.5";
Run npx wrangler ai models to see what’s available on your account and adjust if needed.

# Bindings (wrangler.toml)
Your wrangler.toml should include:

[[durable_objects.bindings]]
name = "MyAgent"
class_name = "MyAgent"

[[migrations]]
tag = "v1"
new_sqlite_classes = ["MyAgent"]

[ai]
binding = "AI"

// Vectorize index binding
[[vectorize]]
binding = "VECTORIZE_INDEX"
index_name = "agent-memory"

## 🧠 How Memory Works
Short-term: _recent ring buffer of the last ~20 turns (lives with the DO instance)

Structured facts: Messages starting with “remember …” are parsed into:

    -my name is <name>

    -i like <thing> / i love <thing>

    -my favorite <x> is <y>

    -Anything else under “custom”
     These are always injected into the system prompt as a small profile block.

Long-term (Vectorize): Every user/assistant turn is embedded and upserted into Vectorize. Top-K nearest vectors are injected into the prompt as “Relevant notes”.

The agent guards persistence: if DO storage isn’t available in your environment, it still runs using recent turns + profile in memory.

## 🖥️ Endpoints
GET /app — Web UI (Netflix-style)

POST /api/chat — Non-streaming chat
Body: { "message": "text" } → { "text": "assistant reply" }

POST /api/chat-stream — Streaming chat (SSE)
Body: { "message": "text" } → text/event-stream of data: <token>\n\n frames, ends with event: done

GET /api/recent — Last ~10 messages for the “Live Memory” pane

## 🧪 Try This
--remember my name is Sam and I like basketball

--what is my name and what do I like?

--Toggle Stream and ask longer questions to see token-by-token output.

## 🛠 Scripts
npm run dev      # npx wrangler dev
npm run deploy   # npx wrangler deploy

## 🧭 Assignment Mapping
--LLM: Workers AI (@cf/meta/llama-3.3-70b-instruct-fp8-fast)

--Workflow/coordination: Agent (Durable Object) with RPC methods

--User input: Web UI chat + SSE streaming

--Memory/state: short-term buffer + structured facts + Vectorize embeddings

## 🌟 Optional Upgrades

Voice: Whisper ASR in, TTS out (@cf/openai/whisper-large-v3-turbo, @cf/deepgram/aura-1)

RAG: Seed your docs into Vectorize and prepend top-K chunks

Workflows: Long-running tasks that call back into the Agent

AI Gateway: caching, rate limits, retries, model fallback

Tools: web fetch, math, calendar, search methods the model can call

## 📸 Screenshot
![alt text](<Screenshot 2025-09-27 211815.png>)