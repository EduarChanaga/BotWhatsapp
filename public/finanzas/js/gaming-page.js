const STATUS_LABELS = { pending: 'Pendiente', playing: 'Jugando', completed: 'Completado', platinum: 'Completado platinando', abandoned: 'Abandonado', endless: 'Sin final' };
const $ = (selector) => document.querySelector(selector);
let games = [];

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function hasCost(game) {
  return game.cost !== '' && game.cost !== null && game.cost !== undefined && Number.isFinite(Number(game.cost));
}

function formatMoney(value) {
  return `$${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(value) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? escapeText(value) : date.toLocaleDateString('es-MX');
}

function populateTagFilter() {
  const tags = [...new Set(games.flatMap((game) => Array.isArray(game.tags) ? game.tags : []))].sort((a, b) => a.localeCompare(b, 'es'));
  $('#gaming-tag-filter').innerHTML = '<option value="all">Todas las etiquetas</option>' + tags.map((tag) => `<option value="${escapeText(tag)}">${escapeText(tag)}</option>`).join('');
}

function filteredGames() {
  const query = $('#gaming-search').value.trim().toLowerCase();
  const costFilter = $('#gaming-cost-filter').value;
  const statusFilter = $('#gaming-status-filter').value;
  const tagFilter = $('#gaming-tag-filter').value;
  const minCost = $('#gaming-cost-min').value === '' ? null : Number($('#gaming-cost-min').value);
  const maxCost = $('#gaming-cost-max').value === '' ? null : Number($('#gaming-cost-max').value);
  const dateFrom = $('#gaming-date-from').value;
  const dateTo = $('#gaming-date-to').value;
  return games.filter((game) => {
    const tags = Array.isArray(game.tags) ? game.tags : [];
    const cost = hasCost(game) ? Number(game.cost) : null;
    return (!query || game.name.toLowerCase().includes(query)) && (costFilter === 'all' || (costFilter === 'paid' ? hasCost(game) : !hasCost(game))) && (minCost === null || (cost !== null && cost >= minCost)) && (maxCost === null || (cost !== null && cost <= maxCost)) && (!dateFrom || (game.acquiredAt && game.acquiredAt >= dateFrom)) && (!dateTo || (game.acquiredAt && game.acquiredAt <= dateTo)) && (statusFilter === 'all' || game.status === statusFilter) && (tagFilter === 'all' || tags.includes(tagFilter));
  }).sort((first, second) => (second.acquiredAt || '').localeCompare(first.acquiredAt || '') || first.name.localeCompare(second.name, 'es'));
}

function renderSummary() {
  $('#gaming-total').textContent = formatMoney(games.reduce((total, game) => total + (hasCost(game) ? Number(game.cost) : 0), 0));
  $('#gaming-count').textContent = games.length;
  $('#gaming-dated').textContent = games.filter((game) => game.acquiredAt).length;
  $('#gaming-free').textContent = games.filter((game) => !hasCost(game)).length;
}

function renderList() {
  const visible = filteredGames();
  $('#gaming-result-count').textContent = `${visible.length} resultado${visible.length === 1 ? '' : 's'}`;
  $('#gaming-empty').hidden = visible.length > 0;
  $('#gaming-list').innerHTML = visible.map((game) => {
    const tags = (game.tags || []).map((tag) => `<span class="gaming-tag">${escapeText(tag)}</span>`).join('');
    const cover = game.image ? `<img src="${game.image}" alt="">` : '✦';
    return `<tr><td><div class="gaming-game"><div class="gaming-cover">${cover}</div><span>${escapeText(game.name)}</span></div></td><td class="gaming-date">${formatDate(game.acquiredAt)}</td><td><span class="gaming-status">${STATUS_LABELS[game.status] || 'Sin estado'}</span></td><td><div class="gaming-tags">${tags || '<span class="gaming-muted">Sin etiquetas</span>'}</div></td><td class="gaming-cost">${hasCost(game) ? formatMoney(game.cost) : 'Préstamo / $0'}</td></tr>`;
  }).join('');
}

async function loadGames() {
  try {
    const response = await fetch('/api/juegos/data', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudieron consultar los juegos.');
    const data = await response.json();
    games = Array.isArray(data) ? data : [];
    if (!games.length) {
      try {
        const localGames = JSON.parse(localStorage.getItem('pokecontrol-juegos'));
        if (Array.isArray(localGames) && localGames.length) {
          games = localGames.map((game) => ({
            ...game,
            rating: game.ratingScale === 10 ? (game.rating || 0) : (game.rating || 0) * 2,
            ratingScale: 10,
            tags: Array.isArray(game.tags) ? game.tags : []
          }));
          const migration = await fetch('/api/juegos/data', {
            method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: games })
          });
          if (!migration.ok) throw new Error('No se pudo completar la migración de juegos.');
        }
      } catch (migrationError) {
        console.error('No se pudo recuperar la biblioteca local:', migrationError);
      }
    }
    renderSummary(); populateTagFilter(); renderList();
  } catch (error) {
    $('#gaming-empty').hidden = false;
    $('#gaming-empty').textContent = error.message;
  }
}

['gaming-search', 'gaming-cost-filter', 'gaming-cost-min', 'gaming-cost-max', 'gaming-date-from', 'gaming-date-to', 'gaming-status-filter', 'gaming-tag-filter'].forEach((id) => { $(`#${id}`).addEventListener('input', renderList); $(`#${id}`).addEventListener('change', renderList); });
$('#btn-logout').addEventListener('click', async () => { await clearSesion(); window.location.href = 'index.html'; });
document.addEventListener('storage-ready', () => { const session = requireAuth(); if (session) { $('#user-label').textContent = session.usuario; loadGames(); } });
