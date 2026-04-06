const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

let MOVIES = [];

try {
    const data = JSON.parse(fs.readFileSync(path.join(__dirname, process.env.DATA_FILE || 'data.json'), 'utf8'));
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

// 🎬 Agrupar por año
app.get('/api/movies-by-year', (req, res) => {
    const grouped = {};

    MOVIES.forEach(m => {
        const y = m.year || 'Desconocido';
        if (!grouped[y]) grouped[y] = [];
        grouped[y].push(m);
    });

    const sorted = Object.keys(grouped)
        .sort((a, b) => b - a)
        .map(year => ({
            year,
            movies: grouped[year]
        }));

    res.json(sorted);
});

// 🌐 Frontend
app.get('/', (req, res) => res.send(`<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Movies+ Netflix</title>

<style>
body{
    margin:0;
    background:#0a0a0a;
    color:#fff;
    font-family:Arial;
}

.hdr{
    padding:15px;
    background:#111;
    font-size:20px;
    font-weight:bold;
    color:#f5c518;
}

.rows{
    display:flex;
    flex-direction:column;
    gap:25px;
    padding:10px;
}

.row-title{
    font-size:18px;
    font-weight:bold;
    margin-bottom:10px;
}

.row-list{
    display:flex;
    gap:10px;
    overflow-x:auto;
}

.card{
    min-width:130px;
    height:195px;
    background:#222;
    border-radius:6px;
    overflow:hidden;
    cursor:pointer;
    transition:.2s;
}

.card:hover{
    transform:scale(1.1);
}

.card img{
    width:100%;
    height:100%;
    object-fit:cover;
}

.player{
    position:fixed;
    inset:0;
    background:#000;
    display:none;
    z-index:999;
}

.player video{
    width:100%;
    height:100%;
}
</style>
</head>

<body>

<div class="hdr">🎬 Movies+ Netflix</div>
<div class="rows" id="rows"></div>

<div class="player" id="player">
    <video id="video" controls autoplay></video>
</div>

<script>
const rows = document.getElementById('rows');
const player = document.getElementById('player');
const video = document.getElementById('video');

// 🎬 Cargar filas por año
fetch('/api/movies-by-year')
.then(r=>r.json())
.then(data=>{
    data.forEach(group=>{
        const row = document.createElement('div');

        const title = document.createElement('div');
        title.className = 'row-title';
        title.textContent = group.year;

        const list = document.createElement('div');
        list.className = 'row-list';

        group.movies.forEach(m=>{
            const card = document.createElement('div');
            card.className = 'card';

            card.innerHTML = '<img src="'+m.poster+'">';

            card.onclick = ()=>{
                player.style.display='block';
                video.src = m.url;
                video.play();
            };

            list.appendChild(card);
        });

        row.appendChild(title);
        row.appendChild(list);
        rows.appendChild(row);
    });
});

// cerrar reproductor
player.onclick = ()=>{
    video.pause();
    player.style.display='none';
};
</script>

</body>
</html>`));

app.listen(PORT, () => console.log('🔥 Movies+ Netflix corriendo en puerto ' + PORT));
