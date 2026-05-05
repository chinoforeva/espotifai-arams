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

async function loadData() {
    const loading = document.getElementById('loading');
    const errorDiv = document.getElementById('error');
    const tabs = document.getElementById('tabs');
    const content = document.getElementById('content');

    try {
        const result = await window.electronAPI.fetchGames();
        console.log('Games fetched:', result);
        
        const data = await window.electronAPI.getData();
        renderAllTabs(data);
        
        loading.style.display = 'none';
        tabs.style.display = 'flex';
        content.style.display = 'block';
    } catch (err) {
        console.error('Error:', err);
        loading.style.display = 'none';
        errorDiv.style.display = 'block';
        errorDiv.textContent = 'Error: ' + err.message;
    }
}

function renderAllTabs(data) {
    renderTable('damage-table', data.topDamage, ['championName', 'totalDamageDealtToChampions'], 'Daño');
    renderTable('healing-table', data.topHealing, ['championName', 'totalHealsOnTeammates', 'totalDamageShieldedOnTeammates'], 'Curación');
    renderTable('kills-table', data.topKills, ['championName', 'kills', 'deaths', 'assists'], 'Kills');
    renderPlayerCards(data.games);
}

function renderTable(containerId, data, columns, valueLabel) {
    const container = document.getElementById(containerId);
    if (!data || data.length === 0) {
        container.innerHTML = '<p>No hay datos disponibles</p>';
        return;
    }
    
    let html = '<table><thead><tr><th>#</th><th>Campeón</th>';
    columns.forEach(c => html += `<th>${c}</th>`);
    html += '</tr></thead><tbody>';

    data.forEach((row, i) => {
        html += `<tr><td class="rank-${i + 1}">${i + 1}</td><td>${row.championName}</td>`;
        columns.forEach(c => {
            html += `<td class="highlight">${row[c] !== undefined ? row[c].toLocaleString() : 'N/A'}</td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
}

function renderPlayerCards(games) {
    const container = document.getElementById('player-cards');
    if (!games || games.length === 0) {
        container.innerHTML = '<p>No hay partidas registradas</p>';
        return;
    }
    
    const playerStats = {};
    games.forEach(game => {
        if (!playerStats[game.puuid]) {
            playerStats[game.puuid] = { games: [], gameName: game.gameName || 'Unknown' };
        }
        playerStats[game.puuid].games.push(game);
    });
    
    let html = '';
    Object.values(playerStats).forEach(player => {
        const matches = player.games;
        if (matches.length === 0) return;
        
        const avgDamage = matches.reduce((s, m) => s + m.totalDamageDealtToChampions, 0) / matches.length;
        const avgKills = matches.reduce((s, m) => s + m.kills, 0) / matches.length;
        const avgDeaths = matches.reduce((s, m) => s + m.deaths, 0) / matches.length;
        const wins = matches.filter(m => m.win).length;
        
        html += `<div class="player-card">
            <h3>${player.gameName}</h3>
            <div class="stat-row"><span class="stat-label">Partidas</span><span class="stat-value">${matches.length}</span></div>
            <div class="stat-row"><span class="stat-label">Victorias</span><span class="stat-value">${wins} (${(wins/matches.length*100).toFixed(1)}%)</span></div>
            <div class="stat-row"><span class="stat-label">Prom. Daño</span><span class="stat-value">${avgDamage.toFixed(0)}</span></div>
            <div class="stat-row"><span class="stat-label">Prom. K/D/A</span><span class="stat-value">${avgKills.toFixed(1)}/${avgDeaths.toFixed(1)}</span></div>
        </div>`;
    });
    
    container.innerHTML = html;
}

window.electronAPI.onGamesUpdated(() => {
    loadData();
});
