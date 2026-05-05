const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;
const RIOT_API_KEY = 'RGAPI-dcfd2b50-91d3-4a8e-a688-5b73dacfc498';
const REGION = 'americas';

app.use(express.static(__dirname));

app.get('/api/puuid', async (req, res) => {
    const { gameName, tagLine } = req.query;
    try {
        const url = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/matches', async (req, res) => {
    const { puuid } = req.query;
    try {
        const url = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=30&type=ranked`;
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/match', async (req, res) => {
    const { matchId } = req.query;
    try {
        const url = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
});
