const fetch = require('node-fetch');

module.exports = async (req, res) => {
    const { gameName, tagLine } = req.query;
    const RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-07b26c13-eff7-4aaf-8d0a-c30e8c43770b';
    
    try {
        const url = `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
        const response = await fetch(url, { headers: { 'X-Riot-Token': RIOT_API_KEY } });
        const data = await response.json();
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
};
