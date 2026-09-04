const STORAGE_KEY = 'pokecontrol-juegos';
const STATUS_LABELS = { pending: 'Pendiente', playing: 'Jugando', completed: 'Completado', platinum: 'Completado platinando', abandoned: 'Abandonado', endless: 'Sin final' };
const $ = (selector) => document.querySelector(selector);
let games = loadGames();

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
}

function loadGames() {
  try {
    const games = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(games) ? games.map((game) => ({
      ...game,
      rating: game.ratingScale === 10 ? (game.rating || 0) : (game.rating || 0) * 2,
      ratingScale: 10,
      tags: Array.isArray(game.tags) ? game.tags : []
    })) : [];
  } catch (_error) {
    return [];
  }
}
 
async function loadServerGames() {
   try {
     const response = await fetch('/api/juegos/data', { cache: 'no-store' });
     if (!response.ok) throw new Error('No se pudieron cargar los juegos.');
     const serverGames = await response.json();
     if (Array.isArray(serverGames) && serverGames.length) {
       games = serverGames.map((game) => ({
         ...game,
         rating: game.ratingScale === 10 ? (game.rating || 0) : (game.rating || 0) * 2,
         ratingScale: 10,
         tags: Array.isArray(game.tags) ? game.tags : []
       }));
     }
     render();
   } catch (error) {
     console.error('Error cargando Toplist desde el servidor:', error);
   }
}

function getRankedGames(mode = 'rating') {
  return [...games].sort((first, second) => {
    const firstValue = mode === 'cost' ? Number(first.cost) || 0 : mode === 'hours' ? Number(first.hours) || 0 : Number(first.rating) || 0;
    const secondValue = mode === 'cost' ? Number(second.cost) || 0 : mode === 'hours' ? Number(second.hours) || 0 : Number(second.rating) || 0;
    return secondValue - firstValue || first.name.localeCompare(second.name, 'es');
  });
}

function stars(rating) {
  return '★★★★★★★★★★'.split('').map((star, index) => index < rating ? star : '☆').join('');
}

function coverMarkup(game, className) {
  return `<div class="${className}">${game.image ? `<img src="${game.image}" alt="Portada de ${escapeText(game.name)}">` : '<span>✦</span>'}</div>`;
}

function renderPodium(games) {
  const podium = $('#podium');
  if (!games.length) { podium.innerHTML = '<div class="podium-empty">Tu podio aparecerá aquí cuando guardes tus primeras aventuras.</div>'; return; }
  podium.innerHTML = games.slice(0, 3).map((game, index) => `<article class="podium-card"><span class="podium-rank">#${index + 1}</span>${coverMarkup(game, 'podium-cover')}<h3>${escapeText(game.name)}</h3><div class="podium-stars">${stars(game.rating || 0)}</div><small>${game.rating ? `${game.rating}/10 · ` : ''}${STATUS_LABELS[game.status] || 'Sin estado'}</small><div class="toplist-tags">${(game.tags || []).map((tag) => `<span>${escapeText(tag)}</span>`).join('')}</div></article>`).join('');
}

function renderRanking() {
  const mode = $('#rankingMode').value;
  const status = $('#statusFilter').value;
  const query = $('#rankingSearch').value.trim().toLowerCase();
  const games = getRankedGames(mode).filter((game) => (status === 'all' || game.status === status) && (!query || game.name.toLowerCase().includes(query)));
  const valueLabel = mode === 'cost' ? 'Costo' : mode === 'hours' ? 'Horas' : 'Rating';
  $('#rankingTitle').textContent = mode === 'cost' ? 'Más costosos' : mode === 'hours' ? 'Más horas jugadas' : 'Mejor valorados';
  const list = $('#rankingList');
  list.innerHTML = games.map((game, index) => { const metric = mode === 'cost' ? (game.cost === '' || game.cost == null ? '—' : `$${Number(game.cost).toFixed(2)}`) : mode === 'hours' ? (game.hours === '' || game.hours == null ? '—' : `${Number(game.hours)} h`) : `${game.rating || '—'}/10`; return `<article class="ranking-row"><span class="row-rank">#${index + 1}</span>${coverMarkup(game, 'row-cover')}<div><strong class="row-name">${escapeText(game.name)}</strong><span class="row-status">${STATUS_LABELS[game.status] || 'Sin estado'} · ${valueLabel}</span><div class="row-tags">${(game.tags || []).map((tag) => `<span>${escapeText(tag)}</span>`).join('')}</div></div><span class="row-stars">${mode === 'rating' ? stars(game.rating || 0) : ''}</span><span class="row-score">${metric}</span></article>`; }).join('');
  $('#rankingEmpty').hidden = games.length > 0;
}

function render() {
  const games = getRankedGames('rating');
  $('#heroTotal').textContent = games.length;
  renderPodium(games);
  renderRanking();
}

function pickRecommendation() {
  if (!games.length) { $('#radarResult').hidden = false; $('#radarName').textContent = 'Sin señales todavía'; $('#radarReason').textContent = 'Añade un juego para activar tu radar.'; $('#radarCover').innerHTML = '<span>?</span>'; return; }
  const queue = games.filter((game) => game.inQueue);
  const candidates = queue.length ? queue : games.filter((game) => ['pending', 'playing'].includes(game.status));
  const pool = candidates.length ? candidates : games;
  const game = pool[Math.floor(Math.random() * pool.length)];
  const reason = queue.includes(game) ? 'Está esperando su momento.' : game.status === 'playing' ? 'Hay una historia a medio descubrir.' : 'Quizá hoy sea el día de empezar.';
  $('#radarResult').hidden = false;
  $('#radarName').textContent = game.name;
  $('#radarReason').textContent = reason;
  $('#radarCover').innerHTML = game.image ? `<img src="${game.image}" alt="">` : '<span>✦</span>';
}

$('#rankingMode').addEventListener('change', renderRanking);
$('#statusFilter').addEventListener('change', renderRanking);
$('#rankingSearch').addEventListener('input', renderRanking);
$('#radarButton').addEventListener('click', pickRecommendation);
window.addEventListener('storage', render);
render();
loadServerGames();
