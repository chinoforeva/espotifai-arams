const { app, BrowserWindow, ipcMain } = require('electron');
const { authenticate, createHttp1Request } = require('league-connect');
const path = require('path');
const Database = require('better-sqlite3');

let mainWindow;
let credentials = null;
let pollTimer = null;
let db;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        webPreferences: {
            preload: path.join(__dirname, '../preload.js'),
            nodeIntegration: false,
            contextIsolation: true
        }
    });
    
    mainWindow.loadFile('index.html');
}

function initDB() {
    db = new Database('aram-mayhem.db');
    db.exec(`
        CREATE TABLE IF NOT EXISTS games (
            gameId INTEGER PRIMARY KEY,
            puuid TEXT,
            queueId INTEGER,
            gameCreation INTEGER,
            gameDuration INTEGER,
            championId INTEGER,
            championName TEXT,
            kills INTEGER,
            deaths INTEGER,
            assists INTEGER,
            totalDamageDealtToChampions INTEGER,
            totalHealsOnTeammates INTEGER,
            totalDamageShieldedOnTeammates INTEGER,
            win BOOLEAN,
            augments TEXT,
            gameData TEXT
        );
        CREATE TABLE IF NOT EXISTS summoners (
            puuid TEXT PRIMARY KEY,
            gameName TEXT,
            tagLine TEXT
        );
    `);
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

async function fetchNewGames() {
    try {
        const summoner = await lcuRequest('/lol-summoner/v1/current-summoner');
        db.prepare('INSERT OR REPLACE INTO summoners (puuid, gameName, tagLine) VALUES (?, ?, ?)')
            .run(summoner.puuid, summoner.gameName, summoner.tagLine);
        
        const history = await fetchMatchHistory(summoner.puuid, 0, 99);
        const games = history.games?.games || history.games || [];
        let newGames = 0;
        
        for (const game of games) {
            if (db.prepare('SELECT 1 FROM games WHERE gameId = ?').get(game.gameId)) continue;
            if (game.queueId !== 2400) continue;
            
            let fullGame;
            try {
                fullGame = await fetchGameDetails(game.gameId);
            } catch {
                fullGame = game;
            }
            
            const participant = fullGame.participants?.find(p => p.puuid === summoner.puuid) || fullGame;
            db.prepare(`INSERT OR REPLACE INTO games 
                (gameId, puuid, queueId, gameCreation, gameDuration, championId, championName, 
                 kills, deaths, assists, totalDamageDealtToChampions, totalHealsOnTeammates, 
                 totalDamageShieldedOnTeammates, win, augments, gameData)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
                .run(
                    fullGame.gameId || game.gameId,
                    summoner.puuid,
                    fullGame.queueId || game.queueId,
                    fullGame.gameCreation || Date.now(),
                    fullGame.gameDuration || 0,
                    participant.championId || 0,
                    participant.championName || 'Unknown',
                    participant.kills || 0,
                    participant.deaths || 0,
                    participant.assists || 0,
                    participant.totalDamageDealtToChampions || 0,
                    participant.totalHealsOnTeammates || 0,
                    participant.totalDamageShieldedOnTeammates || 0,
                    participant.win ? 1 : 0,
                    JSON.stringify(participant.augments || []),
                    JSON.stringify(fullGame)
                );
            newGames++;
        }
        
        return { newGames, totalGames: getDashboardData().totalGames };
    } catch (err) {
        console.error('Error fetching games:', err);
        return { newGames: 0, totalGames: 0 };
    }
}

function getDashboardData() {
    const games = db.prepare('SELECT * FROM games ORDER BY gameCreation DESC LIMIT 30').all();
    const totalGames = db.prepare('SELECT COUNT(*) as count FROM games').get().count;
    
    const topDamage = db.prepare(`SELECT *, 'damage' as type FROM games ORDER BY totalDamageDealtToChampions DESC LIMIT 5`).all();
    const topHealing = db.prepare(`SELECT *, 'healing' as type FROM games ORDER BY (totalHealsOnTeammates + totalDamageShieldedOnTeammates) DESC LIMIT 5`).all();
    const topKills = db.prepare(`SELECT *, 'kills' as type FROM games ORDER BY kills DESC LIMIT 5`).all();
    
    return { games, totalGames, topDamage, topHealing, topKills };
}

ipcMain.handle('fetch-games', async () => {
    return await fetchNewGames();
});

ipcMain.handle('get-data', () => {
    return getDashboardData();
});

app.whenReady().then(() => {
    initDB();
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
