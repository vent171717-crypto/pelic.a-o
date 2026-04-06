const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
let MOVIES = [];

try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.DATA_FILE || 'data.json'), 'utf8'));
    // Mapeo incluyendo el año
    MOVIES = data.map((m, i) => ({ id: i, title: m.title || 'Sin título', poster: m.logo || '', url: m.url || '', year: m.year || 'N/A' }));
    console.log(`✓ ${MOVIES.length} películas`);
} catch (e) { console.error('Error:', e.message); }

app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Range');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range,Accept-Ranges,Content-Length');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

app.get('/api/movies', (req, res) => {
    const { page = 0, limit = 200, q = '', random, year } = req.query;
    let list = [...MOVIES];
    if (q) list = list.filter(m => m.title.toLowerCase().includes(q.toLowerCase()));
    if (year && year !== 'Todos') list = list.filter(m => m.year == year);
    if (random === 'true') list.sort(() => Math.random() - 0.5);
    const start = page * limit;
    res.json({ total: list.length, hasMore: start + +limit < list.length, data: list.slice(start, start + +limit) });
});

app.get('/video-proxy', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).end();
    let parsed;
    try { parsed = new URL(decodeURIComponent(url)); } catch { return res.status(400).end(); }
    const client = parsed.protocol === 'https:' ? https : http;
    const headers = { 'User-Agent': 'Mozilla/5.0', 'Accept': '*/*', 'Accept-Encoding': 'identity', 'Referer': parsed.origin + '/' };
    if (req.headers.range) headers['Range'] = req.headers.range;
    const proxyReq = client.request({ hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80), path: parsed.pathname + parsed.search, headers, timeout: 30000 }, proxyRes => {
        if ([301, 302, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
            proxyRes.destroy();
            return res.redirect(307, '/video-proxy?url=' + encodeURIComponent(proxyRes.headers.location));
        }
        const h = { 'Content-Type': proxyRes.headers['content-type'] || 'video/mp4', 'Accept-Ranges': 'bytes' };
        if (proxyRes.headers['content-length']) h['Content-Length'] = proxyRes.headers['content-length'];
        if (proxyRes.headers['content-range']) h['Content-Range'] = proxyRes.headers['content-range'];
        res.writeHead(proxyRes.statusCode, h);
        proxyRes.pipe(res);
        proxyRes.on('error', () => res.end());
    });
    proxyReq.on('error', () => !res.headersSent && res.status(502).end());
    proxyReq.on('timeout', () => { proxyReq.destroy(); !res.headersSent && res.status(504).end(); });
    req.on('close', () => proxyReq.destroy());
    proxyReq.end();
});

app.get('/', (req, res) => res.send(`<!DOCTYPE html><html lang="es"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<title>Movies+</title><style>
*{margin:0;padding:0;box-sizing:border-box}
:root{--p:#f5c518;--bg:#0a0a0a;--s:#161616;--c:#1a1a1a;--t:#e0e0e0;--t2:#888}
html,body{background:var(--bg);color:var(--t);font-family:system-ui,sans-serif;height:100%}
#app{display:flex;flex-direction:column;height:100%}
.hdr{display:flex;align-items:center;gap:10px;padding:12px;background:var(--s)}
.years{display:flex;gap:6px;padding:8px 12px;background:var(--s);overflow-x:auto;border-bottom:1px solid #333}
.y-btn{background:var(--c);color:var(--t);border:1px solid #333;padding:4px 12px;border-radius:15px;cursor:pointer;font-size:12px;white-space:nowrap}
.y-btn.f{background:var(--p);color:#000;border-color:var(--p)}
.srch{flex:1;background:var(--bg);border:1px solid #333;color:var(--t);padding:8px;border-radius:4px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(130px,1fr));gap:8px;padding:10px}
.card{aspect-ratio:2/3;background:var(--c);border-radius:4px;cursor:pointer;overflow:hidden;position:relative}
.card img{width:100%;height:100%;object-fit:cover}
.card-t{position:absolute;bottom:0;width:100%;padding:10px;background:linear-gradient(transparent,#000);font-size:11px}
.player{position:fixed;inset:0;background:#000;display:none;z-index:999}
.player.open{display:flex;flex-direction:column}
video{flex:1;width:100%}
</style></head><body>
<div id="app">
    <div class="hdr"><div id="logo" style="color:var(--p);font-weight:bold">MOVIES+</div><input class="srch" id="srch" placeholder="Buscar..."></div>
    <div class="years" id="years"></div>
    <div class="grid" id="grid"></div>
</div>
<div class="player" id="player"><video id="vid" controls></video><button onclick="closeP()" style="padding:10px">Volver</button></div>
<script>
const $=id=>document.getElementById(id);
let allMovies = [];
const el = { grid:$('grid'), srch:$('srch'), years:$('years'), player:$('player'), vid:$('vid') };

fetch('/api/movies').then(r=>r.json()).then(d=>{
    allMovies = d.data;
    render(allMovies);
    const yrs = ['Todos', ...new Set(allMovies.map(m=>m.year).filter(y=>y!='N/A').sort((a,b)=>b-a))];
    el.years.innerHTML = yrs.map(y=>\`<button class="y-btn \${y=='Todos'?'f':''}" onclick="filterY('\${y}',this)">\${y}</button>\`).join('');
});

function render(list) {
    el.grid.innerHTML = list.map((m,i)=>\`<div class="card" onclick="play('\${m.url}','\${m.title}')"><img src="\${m.poster}"><div class="card-t">\${m.title}</div></div>\`).join('');
}

function filterY(y, btn) {
    document.querySelectorAll('.y-btn').forEach(b=>b.classList.remove('f'));
    btn.classList.add('f');
    const filtered = y === 'Todos' ? allMovies : allMovies.filter(m=>m.year == y);
    render(filtered);
}

el.srch.oninput = (e) => {
    const q = e.target.value.toLowerCase();
    render(allMovies.filter(m=>m.title.toLowerCase().includes(q)));
};

function play(u, t) { el.player.classList.add('open'); el.vid.src = '/video-proxy?url=' + encodeURIComponent(u); el.vid.play(); }
function closeP() { el.player.classList.remove('open'); el.vid.pause(); }
</script></body></html>`));

app.listen(PORT,'0.0.0.0',()=>console.log('🎬 Movies+ corriendo en '+PORT));
