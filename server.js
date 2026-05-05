const express = require('express');
const fetch = require('node-fetch');
const path = require('path');

const app = express();
const PORT = 3000;
const RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-07b26c13-eff7-4aaf-8d0a-c30e8c43770b';
const REGION = 'americas';

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    next();
});

app.use(express.static(__dirname));

app.get('/api/puuid', async (req, res) => {
    const { gameName, tagLine } = req.query;
    console.log(`[PUUID] Request for ${gameName}#${tagLine}`);
    try {
        const url = `https://${REGION}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
        console.log(`[PUUID] Fetching: ${url}`);
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        console.log(`[PUUID] Response status: ${response.status}, data:`, data);
        res.json(data);
    } catch (e) {
        console.error(`[PUUID] Error:`, e);
        res.status(500).json({ error: e.message });
    }
});

app.get('/api/matches', async (req, res) => {
    const { puuid } = req.query;
    try {
        const url = `https://${REGION}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?count=100`;
        console.log(`[MATCHES] Fetching matches for puuid: ${puuid}`);
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        console.log(`[MATCHES] Got ${data.length || 0} match IDs`);
        res.json(data);
    } catch (e) {
        console.error(`[MATCHES] Error:`, e);
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
