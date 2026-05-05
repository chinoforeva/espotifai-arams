const PLAYERS = [
    { gameName: 'ReyDeLaGuasca', tagLine: 'G00N' },
    { gameName: 'Synx x', tagLine: 'CLK' },
    { gameName: '872', tagLine: '728' },
    { gameName: 'Nokia', tagLine: '184' },
    { gameName: 'Willi Wonka', tagLine: '30110' }
];

let allMatches = [];
let playerData = [];

document.addEventListener('DOMContentLoaded', () => {
    setupTabs();
    loadData();
});

function setupTabs() {
    const tabs = document.querySelectorAll('.tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(tab.dataset.tab).classList.add('active');
        });
    });
}

const API_BASE = window.location.origin;

async function loadData() {
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const tabs = document.getElementById('tabs');
    const content = document.getElementById('content');

    try {
        for (const player of PLAYERS) {
            const puuidData = await fetch(`${API_BASE}/api/puuid?gameName=${encodeURIComponent(player.gameName)}&tagLine=${encodeURIComponent(player.tagLine)}`).then(r => r.json());
            if (!puuidData.puuid) continue;
            const matchIds = await fetch(`${API_BASE}/api/matches?puuid=${puuidData.puuid}`).then(r => r.json());
            const aramMatches = await filterAramMatches(puuidData.puuid, matchIds);
            playerData.push({ ...player, puuid: puuidData.puuid, matches: aramMatches });
        }

        allMatches = playerData.flatMap(p => p.matches);
        renderAllTabs();
        loading.style.display = 'none';
        tabs.style.display = 'flex';
        content.style.display = 'block';
    } catch (err) {
        loading.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Error cargando datos: ' + err.message;
    }
}

async function filterAramMatches(puuid, matchIds) {
    const aramMatches = [];
    for (const id of matchIds) {
        const match = await fetch(`${API_BASE}/api/match?matchId=${id}`).then(r => r.json());
        if (match.info && match.info.queueId === 450) {
            const participant = match.info.participants.find(p => p.puuid === puuid);
            if (participant) aramMatches.push({ ...participant, matchId: id, gameEndTimestamp: match.info.gameEndTimestamp });
        }
        if (aramMatches.length >= 30) break;
    }
    return aramMatches;
}

function renderAllTabs() {
    renderTopDamage();
    renderTopHealing();
    renderTopKills();
    renderPlayerCards();
}

function renderTopDamage() {
    const all = playerData.flatMap(p => p.matches.map(m => ({ ...m, player: p.gameName })));
    const sorted = all.sort((a, b) => b.totalDamageDealtToChampions - a.totalDamageDealtToChampions).slice(0, 5);
    renderTable('damage-table', sorted, ['player', 'championName', 'totalDamageDealtToChampions'], 'Daño');
}

function renderTopHealing() {
    const all = playerData.flatMap(p => p.matches.map(m => ({ ...m, player: p.gameName })));
    const sorted = all.sort((a, b) => (b.totalHealsOnTeammates + b.totalDamageShieldedOnTeammates) - (a.totalHealsOnTeammates + a.totalDamageShieldedOnTeammates)).slice(0, 5);
    renderTable('healing-table', sorted, ['player', 'championName', 'totalHealsOnTeammates', 'totalDamageShieldedOnTeammates'], 'Curación/Escudo');
}

function renderTopKills() {
    const all = playerData.flatMap(p => p.matches.map(m => ({ ...m, player: p.gameName })));
    const sorted = all.sort((a, b) => b.kills - a.kills).slice(0, 5);
    renderTable('kills-table', sorted, ['player', 'championName', 'kills', 'deaths', 'assists'], 'Kills');
}

function renderTable(containerId, data, columns, valueLabel) {
    const container = document.getElementById(containerId);
    let html = '<table><thead><tr><th>#</th><th>Jugador</th><th>Campeón</th>';
    columns.slice(2).forEach(c => html += `<th>${c}</th>`);
    html += '</tr></thead><tbody>';

    data.forEach((row, i) => {
        html += `<tr><td class="rank-${i + 1}">${i + 1}</td><td>${row.player}</td><td>${row.championName}</td>`;
        columns.slice(2).forEach(c => {
            html += `<td class="highlight">${row[c] !== undefined ? row[c].toLocaleString() : 'N/A'}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderPlayerCards() {
    const container = document.getElementById('player-cards');
    let html = '';

    playerData.forEach(player => {
        if (player.matches.length === 0) return;
        const avgDamage = player.matches.reduce((s, m) => s + m.totalDamageDealtToChampions, 0) / player.matches.length;
        const avgKills = player.matches.reduce((s, m) => s + m.kills, 0) / player.matches.length;
        const avgDeaths = player.matches.reduce((s, m) => s + m.deaths, 0) / player.matches.length;
        const wins = player.matches.filter(m => m.win).length;

        html += `<div class="player-card">
            <h3>${player.gameName}#${player.tagLine}</h3>
            <div class="stat-row"><span class="stat-label">Partidas</span><span class="stat-value">${player.matches.length}</span></div>
            <div class="stat-row"><span class="stat-label">Victorias</span><span class="stat-value">${wins} (${(wins/player.matches.length*100).toFixed(1)}%)</span></div>
            <div class="stat-row"><span class="stat-label">Prom. Daño</span><span class="stat-value">${avgDamage.toFixed(0)}</span></div>
            <div class="stat-row"><span class="stat-label">Prom. K/D/A</span><span class="stat-value">${avgKills.toFixed(1)}/${avgDeaths.toFixed(1)}</span></div>
            <div class="stat-row"><span class="stat-label">Max Kills</span><span class="stat-value">${Math.max(...player.matches.map(m => m.kills))}</span></div>
        </div>`;
    });

    container.innerHTML = html;
}
