const { app, BrowserWindow, ipcMain } = require('electron');
const { authenticate, createHttp1Request } = require('league-connect');
const path = require('path');
const fs = require('fs');

let mainWindow;
let credentials = null;
let pollTimer = null;
let db = { games: [], summoners: [] };

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    mainWindow.loadFile('index.html');
}

function loadDB() {
    try {
        if (fs.existsSync('aram-mayhem.json')) {
            db = JSON.parse(fs.readFileSync('aram-mayhem.json', 'utf8'));
        }
    } catch (e) {
        db = { games: [], summoners: [] };
    }
}

function saveDB() {
    fs.writeFileSync('aram-mayhem.json', JSON.stringify(db, null, 2));
}

async function lcuRequest(url, method = 'GET') {
    if (!credentials) {
        credentials = await authenticate({ windowsShell: 'powershell' });
    }
    const response = await createHttp1Request({ url, method }, credentials);
    if (!response.ok) throw new Error(`LCU request failed: ${response.status}`);
    return response.json();
}

async function fetchMatchHistory(puuid, begIndex = 0, endIndex = 19) {
    try {
        return await lcuRequest(`/lol-match-history/v1/products/lol/${puuid}/matches?begIndex=${begIndex}&endIndex=${endIndex}`);
    } catch {
        return await lcuRequest(`/lol-match-history/v1/products/lol/current-summoner/matches?begIndex=${begIndex}&endIndex=${endIndex}`);
    }
}

async function fetchGameDetails(gameId) {
    return await lcuRequest(`/lol-match-history/v1/games/${gameId}`);
}

function gameExists(gameId) {
    return db.games.some(g => g.gameId === gameId);
}

function insertGame(fullGame, puuid) {
    const participant = fullGame.participants?.find(p => p.puuid === puuid) || fullGame;
    const game = {
        gameId: fullGame.gameId,
        puuid: puuid,
        queueId: fullGame.queueId,
        gameCreation: fullGame.gameCreation || Date.now(),
        gameDuration: fullGame.gameDuration || 0,
        championId: participant.championId || 0,
        championName: participant.championName || 'Unknown',
        kills: participant.kills || 0,
        deaths: participant.deaths || 0,
        assists: participant.assists || 0,
        totalDamageDealtToChampions: participant.totalDamageDealtToChampions || 0,
        totalHealsOnTeammates: participant.totalHealsOnTeammates || 0,
        totalDamageShieldedOnTeammates: participant.totalDamageShieldedOnTeammates || 0,
        win: participant.win || false,
        augments: participant.augments || []
    };
    
    if (!gameExists(game.gameId)) {
        db.games.push(game);
        saveDB();
        return true;
    }
    return false;
}

async function fetchNewGames() {
    try {
        const summoner = await lcuRequest('/lol-summoner/v1/current-summoner');
        
        if (!db.summoners.some(s => s.puuid === summoner.puuid)) {
            db.summoners.push({
                puuid: summoner.puuid,
                gameName: summoner.gameName,
                tagLine: summoner.tagLine
            });
            saveDB();
        }
        
        const history = await fetchMatchHistory(summoner.puuid, 0, 99);
        const games = history.games?.games || history.games || [];
        let newGames = 0;
        
        for (const game of games) {
            if (gameExists(game.gameId)) continue;
            if (game.queueId !== 2400) continue;
            
            let fullGame;
            try {
                fullGame = await fetchGameDetails(game.gameId);
            } catch {
                fullGame = game;
            }
            
            if (insertGame(fullGame, summoner.puuid)) {
                newGames++;
                console.log(`Stored ARAM Mayhem game ${fullGame.gameId || game.gameId}`);
            }
        }
        
        return { newGames, totalGames: db.games.length };
    } catch (err) {
        console.error('Error fetching games:', err);
        return { newGames: 0, totalGames: 0 };
    }
}

function getDashboardData() {
    const games = db.games.sort((a, b) => b.gameCreation - a.gameCreation).slice(0, 30);
    
    const topDamage = [...games].sort((a, b) => b.totalDamageDealtToChampions - a.totalDamageDealtToChampions).slice(0, 5);
    const topHealing = [...games].sort((a, b) => (b.totalHealsOnTeammates + b.totalDamageShieldedOnTeammates) - (a.totalHealsOnTeammates + a.totalDamageShieldedOnTeammates)).slice(0, 5);
    const topKills = [...games].sort((a, b) => b.kills - a.kills).slice(0, 5);
    
    return { games, totalGames: db.games.length, topDamage, topHealing, topKills };
}

ipcMain.handle('fetch-games', async () => {
    return await fetchNewGames();
});

ipcMain.handle('get-data', () => {
    return getDashboardData();
});

app.whenReady().then(() => {
    loadDB();
    createWindow();
    
    setInterval(async () => {
        if (mainWindow && !mainWindow.isDestroyed()) {
            const result = await fetchNewGames();
            if (result.newGames > 0) {
                mainWindow.webContents.send('games-updated');
            }
        }
    }, 60000);
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
});
