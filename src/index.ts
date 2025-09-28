import { AgentNamespace } from "@cloudflare/agents";
import { MyAgent } from "./agent";

export interface Env {
  MyAgent: AgentNamespace<typeof MyAgent>;
}

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);

    if (url.pathname === "/") {
      return new Response("OK. Open /app", { headers: { "content-type": "text/plain" } });
    }

    // Non-streaming
    if (url.pathname === "/api/chat" && req.method === "POST") {
      try {
        const { message } = await req.json();
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const result = await stub.chat({ message });
        return Response.json(result);
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    }

    // Streaming (SSE)
    if (url.pathname === "/api/chat-stream" && req.method === "POST") {
      try {
        const { message } = await req.json();
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const { readable } = await stub.streamChat({ message });
        return new Response(readable, {
          headers: {
            "content-type": "text/event-stream",
            "cache-control": "no-cache",
            "connection": "keep-alive",
          },
        });
      } catch (e: any) {
        return new Response(`event: error\ndata: ${String(e?.message || e)}\n\n`, {
          headers: { "content-type": "text/event-stream" },
        });
      }
    }

    // Recent memory
    if (url.pathname === "/api/recent" && req.method === "GET") {
      try {
        const id = env.MyAgent.idFromName("default");
        const stub = env.MyAgent.get(id);
        const recent = await (stub as any).getRecent?.();
        return Response.json(recent ?? { recent: [] });
      } catch (e: any) {
        return Response.json({ error: String(e?.message || e) }, { status: 500 });
      }
    }

    if (url.pathname === "/app") {
      return new Response(await appPage(), { headers: { "content-type": "text/html" } });
    }

    return new Response("Not found", { status: 404 });
  },
};

async function appPage() {
  return /* html */ `
<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>FlixChat • AI Agent</title>
    <style>
      :root{
        --bg:#0b0b0b; --bg-hero:#141414; --card:#141414; --muted:#b3b3b3; --text:#ffffff;
        --red:#e50914; --chip:#2a2a2a; --border:#222; --bubble-user:#1f1f1f; --bubble-ai:#0f0f0f;
        --shadow:0 10px 30px rgba(0,0,0,.35);
      }
      *{box-sizing:border-box} html,body{height:100%}
      body{margin:0;background:var(--bg);color:var(--text);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,Inter,Arial}

      .hero{
        background:
          radial-gradient(1200px 400px at 20% -10%, rgba(229,9,20,.35), transparent 50%),
          radial-gradient(1000px 300px at 80% -20%, rgba(229,9,20,.25), transparent 55%),
          var(--bg-hero);
        border-bottom:1px solid var(--border); box-shadow:var(--shadow);
      }
      .hero-inner{max-width:1280px;margin:0 auto;padding:26px 18px 18px;display:flex;align-items:center;gap:14px}
      .logo{width:28px;height:28px;display:grid;place-items:center;border-radius:6px;background:linear-gradient(180deg,var(--red),#a4060e);color:#fff;font-weight:900}
      .brand{font-size:20px;font-weight:800;letter-spacing:.4px}
      .chip{margin-left:auto;background:var(--chip);border:1px solid var(--border);padding:6px 10px;border-radius:999px;color:var(--muted);font-size:12px}

      .grid{
        max-width:1280px;margin:24px auto 32px;padding:0 18px;
        display:grid; gap:16px; grid-template-columns: 240px 1fr 300px;
      }
      @media (max-width:1100px){ .grid{grid-template-columns: 1fr} .aside-left,.aside-right{display:none} }

      .panel{background:var(--card);border:1px solid var(--border);border-radius:16px;box-shadow:var(--shadow)}
      .panel-head{padding:14px 16px;border-bottom:1px solid var(--border);font-weight:800}
      .panel-body{padding:12px 16px}

      .profile{display:flex;align-items:center;gap:10px;padding:10px;border-radius:12px;background:#121212;border:1px solid var(--border);margin-bottom:10px}
      .pfp{width:32px;height:32px;border-radius:8px;display:grid;place-items:center;background:#2b2b2b}
      .pill{display:inline-block;padding:6px 10px;border-radius:999px;background:#1a1a1a;border:1px solid var(--border);color:var(--muted);font-size:12px;margin:4px 6px 0 0}

      .card{overflow:hidden; position:relative;}
      .card-head{padding:16px 16px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px}
      .title{font-weight:800;font-size:22px}
      .subtitle{color:var(--muted);font-size:13px}
      .row{display:flex;gap:10px;align-items:center;margin-left:auto}
      .btn{padding:10px 14px;border-radius:10px;border:1px solid #3a3a3a;background:#1a1a1a;color:#fff;cursor:pointer}
      .btn.primary{border-color:var(--red);background:linear-gradient(180deg,#ff2a35,var(--red))}
      .btn:disabled{opacity:.6;cursor:not-allowed}
      .toggle{display:flex;align-items:center;gap:8px;background:#0f0f0f;border:1px solid var(--border);padding:8px 10px;border-radius:12px;color:var(--muted);font-size:12px}

      .history{height:min(60vh,580px);overflow:auto;padding:18px;display:flex;flex-direction:column;gap:12px;scroll-behavior:smooth}
      .msg{display:flex;gap:10px;align-items:flex-start}
      .avatar{width:28px;height:28px;border-radius:8px;display:grid;place-items:center;font-size:12px;color:#fff;flex:0 0 auto}
      .avatar.user{background:#303030} .avatar.ai{background:var(--red)}
      .bubble{padding:12px 14px;border-radius:14px;border:1px solid var(--border);max-width:70%;line-height:1.45;box-shadow:var(--shadow)}
      .user .bubble{background:var(--bubble-user)} .ai .bubble{background:var(--bubble-ai)}
      .time{color:var(--muted);font-size:11px;margin-top:4px}

      .composer{display:flex;gap:10px;padding:12px;border-top:1px solid var(--border);background:#0e0e0e; position:sticky; bottom:0; z-index:3;}
      .input{flex:1;padding:14px;border-radius:12px;border:1px solid var(--border);background:#0a0a0a;color:#fff;outline:none}

      .list{display:grid;gap:8px}
      .mem{padding:10px 12px;border-radius:10px;background:#101010;border:1px solid var(--border);color:#ddd}
      .kbd{display:inline-block;border:1px solid var(--border);background:#171717;padding:2px 6px;border-radius:6px;font-size:12px;margin-right:6px;color:#cfcfcf}
      .muted{color:var(--muted);font-size:12px}
    </style>
  </head>
  <body>
    <header class="hero">
      <div class="hero-inner">
        <div class="logo">N</div>
        <div class="brand">FlixChat</div>
        <div class="chip">Workers AI • Vectorize • Agents</div>
      </div>
    </header>

    <div class="grid">
      <aside class="panel aside-left">
        <div class="panel-head">Profiles</div>
        <div class="panel-body">
          <div class="profile"><div class="pfp">👤</div><div><div><b>Main</b></div><div class="muted">General assistant</div></div></div>
          <div class="profile"><div class="pfp">🧠</div><div><div><b>Research</b></div><div class="muted">Long-form reasoning</div></div></div>
          <div class="profile"><div class="pfp">🛠️</div><div><div><b>Dev</b></div><div class="muted">Code helper</div></div></div>
          <div style="margin-top:12px">
            <span class="pill">/clear</span>
            <span class="pill">/summarize</span>
            <span class="pill">/remember</span>
          </div>
        </div>
      </aside>

      <main class="panel card">
        <div class="card-head">
          <div>
            <div class="title">Talk to your Agent</div>
            <div class="subtitle">Remembers facts with Vectorize. Stream responses in real time.</div>
          </div>
          <div class="row">
            <button id="clear" class="btn">Clear</button>
            <label class="toggle"><input id="streamToggle" type="checkbox" /> Stream</label>
          </div>
        </div>

        <div id="history" class="history"></div>

        <div class="composer">
          <input id="msg" class="input" placeholder="Ask anything… try: “remember my name is Sam and I like basketball”" />
          <button id="send" type="button" class="btn primary">Send</button>
        </div>
      </main>

      <aside class="panel aside-right">
        <div class="panel-head">Live Memory</div>
        <div class="panel-body"><div id="memList" class="list"></div></div>
        <div class="panel-head">Shortcuts</div>
        <div class="panel-body">
          <div><span class="kbd">Enter</span><span class="muted">Send</span></div>
          <div><span class="kbd">Shift + Enter</span><span class="muted">New line</span></div>
          <div><span class="kbd">S</span><span class="muted">Toggle Stream</span></div>
          <div><span class="kbd">Esc</span><span class="muted">Focus input</span></div>
        </div>
      </aside>
    </div>

    <script>
      const history = document.getElementById('history');
      const input   = document.getElementById('msg');
      const sendBtn = document.getElementById('send');
      const streamT = document.getElementById('streamToggle');
      const clearBtn= document.getElementById('clear');
      const memList = document.getElementById('memList');

      function nowTime(){ return new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
      function setBusy(b){ sendBtn.disabled = b; input.disabled = b; }
      function append(role, text){
        const wrap = document.createElement('div'); wrap.className = 'msg ' + role;
        const avatar = document.createElement('div'); avatar.className = 'avatar ' + (role==='user'?'user':'ai'); avatar.textContent = role==='user'?'U':'A';
        const bubble = document.createElement('div'); bubble.className = 'bubble'; bubble.textContent = text;
        const time = document.createElement('div'); time.className='time'; time.textContent = nowTime();
        const col = document.createElement('div'); col.appendChild(bubble); col.appendChild(time);
        wrap.appendChild(avatar); wrap.appendChild(col);
        history.appendChild(wrap); history.scrollTop = history.scrollHeight;
      }

      async function postJSON(url, body){
        const res = await fetch(url, { method:'POST', headers:{'content-type':'application/json'}, body: JSON.stringify(body) });
        if(!res.ok){ try{ const j = await res.json(); throw new Error(j.error||'Request failed'); } catch{ throw new Error('Request failed'); } }
        return res.json();
      }

      async function refreshMemory(){
        try{
          const res = await fetch('/api/recent'); if(!res.ok) return;
          const data = await res.json();
          const items = (data?.recent || []).slice().reverse();
          memList.innerHTML = '';
          for(const m of items){
            const div = document.createElement('div');
            div.className = 'mem';
            div.textContent = (m.role === 'assistant' ? 'A: ' : 'U: ') + m.text;
            memList.appendChild(div);
          }
        }catch{}
      }

      function parseSSEChunk(chunk, onData, onEvent){
        const lines = chunk.split('\\n');
        for(const raw of lines){
          const line = raw.trim();
          if(!line) continue;
          if(line.startsWith('data: ')){
            const payload = line.slice(6);
            if(payload === '' || payload === '[END]') continue; // ignore end/empty markers
            onData(payload);
          } else if(line.startsWith('event: ')){
            onEvent(line.slice(7).trim());
          }
        }
      }

      async function send(){
        const message = input.value.trim(); if(!message) return;
        input.value=''; append('user', message); setBusy(true);

        try{
          if(streamT && streamT.checked){
            // streaming
            append('ai', ''); const lastBubble = history.querySelector('.msg.ai:last-child .bubble');
            const res = await fetch('/api/chat-stream', {
              method:'POST', headers:{'content-type':'application/json'},
              body: JSON.stringify({ message })
            });
            if(!res.ok || !res.body) throw new Error('Stream failed');

            const reader = res.body.getReader(); const dec = new TextDecoder();
            while(true){
              const {value, done} = await reader.read(); if(done) break;
              parseSSEChunk(dec.decode(value, {stream:true}),
                (token)=> { lastBubble.textContent += token; history.scrollTop = history.scrollHeight; },
                (_ev)=> {}
              );
            }
          }else{
            // non-streaming
            const data = await postJSON('/api/chat', { message });
            append('ai', data.text || '(no response)');
          }
          await refreshMemory();
        }catch(e){
          append('ai', '⚠️ ' + (e.message || e));
        }finally{
          setBusy(false); input.focus();
        }
      }

      // Wire events after DOM is ready
      window.addEventListener('DOMContentLoaded', () => {
        sendBtn.addEventListener('click', send);
        input.addEventListener('keydown', (e)=> {
          if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); }
        });
        if (clearBtn) clearBtn.addEventListener('click', ()=> { history.innerHTML=''; });
        document.addEventListener('keydown', (e)=> {
          if(e.key==='s' || e.key==='S') { if (streamT) streamT.checked = !streamT.checked; }
          if(e.key==='Escape') input.focus();
        });
        append('ai','Welcome to FlixChat. Tell me something to remember.');
        refreshMemory();
      });
    </script>
  </body>
</html>
`;
}

export { MyAgent } from "./agent";
