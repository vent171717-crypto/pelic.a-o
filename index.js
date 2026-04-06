const express = require('express');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;

let MOVIES = [];

try {
    const data = JSON.parse(
        fs.readFileSync(path.join(__dirname, process.env.DATA_FILE || 'data.json'), 'utf8')
    );

    MOVIES = data.map((m, i) => ({
        id: i,
        title: m.title || 'Sin título',
        poster: m.logo || '',
        url: m.url || '',
        year: m.year || 'Desconocido'
    }));

    console.log(`✓ ${MOVIES.length} películas`);
} catch (e) {
    console.error('Error:', e.message);
}

// CORS
app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    next();
});

// 🔎 API NORMAL
app.get('/api/movies', (req, res) => {
    const { q = '' } = req.query;
    let list = q
        ? MOVIES.filter(m => m.title.toLowerCase().includes(q.toLowerCase()))
        : [...MOVIES];

    res.json(list);
});

// 🎬 API POR AÑO (Netflix)
app.get('/api/movies-by-year', (req, res) => {
    const { q = '' } = req.query;

    let list = q
        ? MOVIES.filter(m => m.title.toLowerCase().includes(q.toLowerCase()))
        : [...MOVIES];

    const grouped = {};

    list.forEach(m => {
        const year = m.year || 'Desconocido';
        if (!grouped[year]) grouped[year] = [];
        grouped[year].push(m);
    });

    const sorted = Object.keys(grouped)
        .sort((a, b) => b - a)
        .map(year => ({
            year,
            movies: grouped[year]
        }));

    res.json(sorted);
});

// 🎥 PROXY VIDEO
app.get('/video-proxy', (req, res) => {
    const url = req.query.url;
    if (!url) return res.status(400).end();

    const parsed = new URL(url);
    const client = parsed.protocol === 'https:' ? https : http;

    const proxyReq = client.request({
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search
    }, proxyRes => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res);
    });

    proxyReq.end();
});

// 🌐 FRONTEND
app.get('/', (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Movies+ PRO</title>

<style>
body{margin:0;background:#0a0a0a;color:#fff;font-family:sans-serif}
.hdr{display:flex;gap:10px;padding:10px;background:#111}
input{flex:1;padding:8px;border-radius:6px;border:none}
button{padding:8px 12px;border:none;background:#f5c518;color:#000;font-weight:bold;border-radius:6px;cursor:pointer}

.row{margin:15px}
.row-title{font-size:18px;font-weight:bold;margin-bottom:8px}
.row-list{display:flex;gap:10px;overflow-x:auto}
.card{min-width:130px;height:190px;background:#222;border-radius:6px;overflow:hidden;cursor:pointer;position:relative}
.card img{width:100%;height:100%;object-fit:cover}
.fav{position:absolute;top:5px;right:5px;background:#000a;padding:3px;border-radius:50%}

video{width:100%;height:100%;background:#000}
.player{position:fixed;inset:0;background:#000;display:none}
.player.open{display:block}
</style>
</head>

<body>

<div class="hdr">
<input id="search" placeholder="Buscar...">
<button id="random">🎲</button>
<button id="favBtn">⭐</button>
</div>

<div id="app"></div>

<div class="player" id="player">
<video id="video" controls></video>
</div>

<script>
const appEl = document.getElementById('app');
const search = document.getElementById('search');
const video = document.getElementById('video');
const player = document.getElementById('player');

let favorites = JSON.parse(localStorage.getItem('fav') || '[]');

function saveFav(){
    localStorage.setItem('fav', JSON.stringify(favorites));
}

function isFav(id){
    return favorites.includes(id);
}

function toggleFav(id){
    if(isFav(id)){
        favorites = favorites.filter(f=>f!==id);
    }else{
        favorites.push(id);
    }
    saveFav();
    load();
}

function load(q='', random=false){
    fetch('/api/movies-by-year?q='+encodeURIComponent(q))
    .then(r=>r.json())
    .then(rows=>{
        appEl.innerHTML='';

        rows.forEach(row=>{
            if(random) row.movies.sort(()=>Math.random()-0.5);

            const div=document.createElement('div');
            div.className='row';

            div.innerHTML=\`
                <div class="row-title">Año \${row.year}</div>
                <div class="row-list"></div>
            \`;

            const list=div.querySelector('.row-list');

            row.movies.forEach(m=>{
                const card=document.createElement('div');
                card.className='card';

                card.innerHTML=\`
                    <img loading="lazy" src="\${m.poster}">
                    <div class="fav">\${isFav(m.id)?'⭐':''}</div>
                \`;

                card.onclick=()=>{
                    video.src='/video-proxy?url='+encodeURIComponent(m.url);
                    player.classList.add('open');
                    video.play();
                };

                card.oncontextmenu=(e)=>{
                    e.preventDefault();
                    toggleFav(m.id);
                };

                list.appendChild(card);
            });

            appEl.appendChild(div);
        });
    });
}

search.oninput=()=>load(search.value);
document.getElementById('random').onclick=()=>load(search.value,true);

player.onclick=()=>{
    video.pause();
    player.classList.remove('open');
};

load();
</script>

</body>
</html>`);
});

app.listen(PORT, () => console.log("🎬 Movies+ PRO corriendo en puerto " + PORT));
