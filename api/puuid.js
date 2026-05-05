const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { gameName, tagLine } = req.query;
    const RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-dcfd2b50-91d3-4a8e-a688-5b73dacfc498';
    
    try {
        const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
