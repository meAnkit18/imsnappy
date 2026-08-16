import { Sandbox } from "e2b";

const PREVIEW_PORT = 8080;
const PREVIEW_TIMEOUT_MS = 15 * 60_000;
const MAX_HTML_BYTES = 350_000;

export type SandboxPreviewArtifact = {
  artifactId: string;
  name: string;
  type: "file";
  contentType: "text/html";
  url: string;
  expiresAt: string;
  preview: true;
};

export function isSnakeGameRequest(prompt: string): boolean {
  return /\bsnake\b/i.test(prompt) && /\b(game|playable|browser|preview)\b/i.test(prompt);
}

export function previewNameFromTitle(title: string): string {
  const compact = title.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-+|-+$/g, "");
  return `${compact.slice(0, 64) || "sandbox-preview"}.html`;
}

export function validatePreviewHtml(html: string): string {
  if (!html.trim()) throw new Error("The preview artifact is empty.");
  if (Buffer.byteLength(html, "utf8") > MAX_HTML_BYTES) throw new Error("The preview artifact exceeds the 350 KB safety limit.");
  if (!/<(?:!doctype|html|body)\b/i.test(html)) throw new Error("A preview must be a self-contained HTML document.");
  return html;
}

/**
 * A self-contained, dependency-free game used for the canonical Snake request.
 * The generic create_web_preview tool below remains available for other web apps.
 */
export function buildSnakeGameHtml(): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Snake — I’m Snappy</title>
  <style>
    :root { color-scheme: dark; --ink:#11120f; --paper:#f4f2ea; --green:#7ee3a8; --head:#ddff8b; --food:#ff8f79; }
    * { box-sizing: border-box; }
    body { min-height:100vh; margin:0; display:grid; place-items:center; background:radial-gradient(circle at 18% 15%,#334237 0,transparent 32%),radial-gradient(circle at 83% 88%,#514835 0,transparent 28%),var(--ink); color:var(--paper); font:14px/1.4 ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif; }
    main { width:min(92vw,650px); padding:24px; border:1px solid #ffffff1c; background:#171915d9; box-shadow:0 28px 100px #0008; }
    header { display:flex; align-items:end; justify-content:space-between; gap:16px; margin-bottom:18px; }
    h1 { margin:0; font:500 clamp(28px,5vw,45px)/.9 Georgia,serif; letter-spacing:-.055em; }
    .kicker,.stat-label { color:#a8b2a2; font-size:10px; font-weight:700; letter-spacing:.16em; text-transform:uppercase; }
    .score { display:flex; gap:16px; text-align:right; }.score strong { display:block; margin-top:3px; font-size:20px; color:var(--green); }
    canvas { display:block; width:100%; aspect-ratio:1; touch-action:none; background:#0d0f0c; border:1px solid #ffffff14; image-rendering:pixelated; }
    footer { display:flex; justify-content:space-between; align-items:center; gap:10px; margin-top:15px; color:#b9c0b2; font-size:12px; }
    button { border:1px solid #d9e4c533; border-radius:999px; background:transparent; color:var(--paper); padding:8px 12px; font:inherit; cursor:pointer; } button:hover { border-color:var(--green); color:var(--green); }
    .controls { display:none; grid-template-columns:repeat(3,42px); gap:6px; margin:18px auto 0; justify-content:center; }.controls button { padding:9px 0; border-radius:8px; }
    .controls button:nth-child(1) { grid-column:2; }.controls button:nth-child(4) { grid-column:2; }
    @media (max-width:600px) { main { padding:16px; }.controls { display:grid; } footer { align-items:flex-start; flex-direction:column; } }
  </style>
</head>
<body>
  <main>
    <header><div><p class="kicker">I’m Snappy sandbox</p><h1>Snake</h1></div><div class="score"><div><span class="stat-label">Score</span><strong id="score">0</strong></div><div><span class="stat-label">Best</span><strong id="best">0</strong></div></div></header>
    <canvas id="game" width="600" height="600" aria-label="Playable Snake game"></canvas>
    <footer><span>Arrow keys or WASD to move · Space to pause</span><button id="restart" type="button">Restart</button></footer>
    <div class="controls" aria-label="Touch controls"><button data-dir="up">↑</button><button data-dir="left">←</button><button data-dir="down">↓</button><button data-dir="right">→</button></div>
  </main>
  <script>
    const canvas = document.querySelector('#game'), ctx = canvas.getContext('2d');
    const scoreEl = document.querySelector('#score'), bestEl = document.querySelector('#best');
    const GRID = 20, CELL = canvas.width / GRID;
    let snake, food, dir, queued, score, best = Number(localStorage.getItem('snappy-snake-best') || 0), timer, paused, over;
    function reset(){ snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}]; dir={x:1,y:0}; queued=dir; score=0; paused=false; over=false; placeFood(); scoreEl.textContent=score; bestEl.textContent=best; clearInterval(timer); timer=setInterval(tick,120); draw(); }
    function placeFood(){ do { food={x:Math.floor(Math.random()*GRID),y:Math.floor(Math.random()*GRID)}; } while(snake.some(p=>p.x===food.x&&p.y===food.y)); }
    function tick(){ if(paused||over) return; dir=queued; const head={x:snake[0].x+dir.x,y:snake[0].y+dir.y}; if(head.x<0||head.y<0||head.x>=GRID||head.y>=GRID||snake.some(p=>p.x===head.x&&p.y===head.y)){ over=true; draw(); return; } snake.unshift(head); if(head.x===food.x&&head.y===food.y){ score++; scoreEl.textContent=score; if(score>best){best=score;localStorage.setItem('snappy-snake-best',best);bestEl.textContent=best;} placeFood(); } else snake.pop(); draw(); }
    function draw(){ ctx.fillStyle='#0d0f0c';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let i=1;i<GRID;i++){ctx.beginPath();ctx.moveTo(i*CELL,0);ctx.lineTo(i*CELL,canvas.height);ctx.moveTo(0,i*CELL);ctx.lineTo(canvas.width,i*CELL);ctx.stroke();}ctx.fillStyle='#ff8f79';ctx.fillRect(food.x*CELL+4,food.y*CELL+4,CELL-8,CELL-8);snake.forEach((p,i)=>{ctx.fillStyle=i?'#7ee3a8':'#ddff8b';ctx.fillRect(p.x*CELL+2,p.y*CELL+2,CELL-4,CELL-4);});if(paused||over){ctx.fillStyle='#0009';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#f4f2ea';ctx.textAlign='center';ctx.font='500 30px Georgia';ctx.fillText(over?'Game over':'Paused',canvas.width/2,canvas.height/2);ctx.font='14px system-ui';ctx.fillText(over?'Press Restart to play again':'Press Space to continue',canvas.width/2,canvas.height/2+28);}}
    function move(name){const next={up:{x:0,y:-1},down:{x:0,y:1},left:{x:-1,y:0},right:{x:1,y:0}}[name];if(next && !(next.x===-dir.x&&next.y===-dir.y)) queued=next;}
    document.addEventListener('keydown',event=>{const key=event.key.toLowerCase();if(key===' '){event.preventDefault();paused=!paused;draw();return;}const keys={arrowup:'up',w:'up',arrowdown:'down',s:'down',arrowleft:'left',a:'left',arrowright:'right',d:'right'};if(keys[key]){event.preventDefault();move(keys[key]);}});document.querySelector('#restart').addEventListener('click',reset);document.querySelectorAll('[data-dir]').forEach(button=>button.addEventListener('click',()=>move(button.dataset.dir)));reset();
  </script>
</body>
</html>`;
}

export async function createSandboxPreview(input: { title: string; html: string }): Promise<SandboxPreviewArtifact> {
  const html = validatePreviewHtml(input.html);
  const sandbox = await Sandbox.create({
    timeoutMs: PREVIEW_TIMEOUT_MS,
    metadata: { product: "imsnappy", purpose: "interactive-web-preview" },
  });

  try {
    await sandbox.files.write("/home/oai/share/index.html", html);
    await sandbox.commands.run(`python3 -m http.server ${PREVIEW_PORT} --directory /home/oai/share`, { background: true });
    const url = `https://${sandbox.getHost(PREVIEW_PORT)}`;
    return {
      artifactId: `sandbox-preview-${sandbox.sandboxId}`,
      name: previewNameFromTitle(input.title),
      type: "file",
      contentType: "text/html",
      url,
      expiresAt: new Date(Date.now() + PREVIEW_TIMEOUT_MS).toISOString(),
      preview: true,
    };
  } catch (error) {
    await sandbox.kill().catch(() => undefined);
    throw error;
  }
}
