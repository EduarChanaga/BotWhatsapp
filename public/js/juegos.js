const STORAGE_KEY = 'pokecontrol-juegos';
const STATUS_LABELS = { pending: 'Pendiente', playing: 'Jugando', completed: 'Completado', platinum: 'Completado platinando', abandoned: 'Abandonado', endless: 'Sin final' };

let games = loadGames();
let activeFilter = 'all';
let activeSort = 'rating-desc';
let selectedRating = 0;
let currentImage = '';
let currentImageFile = null;
let serverReady = false;
let steamGameId = null;
let selectedSteamApp = null;
let steamLibrary = [];

const $ = (selector) => document.querySelector(selector);

function loadGames() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return Array.isArray(stored) ? stored.map((game) => ({
      ...game,
      rating: game.ratingScale === 10 ? (game.rating || 0) : (game.rating || 0) * 2,
      ratingScale: 10,
      tags: Array.isArray(game.tags) ? game.tags : []
    })) : [];
  } catch (_error) {
    return [];
  }
}

async function saveGames() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
  if (!serverReady) return;
  const response = await fetch('/api/juegos/data', {
    method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: games })
  });
  if (!response.ok) throw new Error('No se pudieron guardar los juegos en el servidor.');
}

async function uploadImage(file) {
  const contentType = (file.type || '').split(';')[0].trim().toLowerCase();
  if (!contentType.startsWith('image/')) throw new Error('Selecciona un archivo de imagen válido.');
  const response = await fetch('/api/juegos/image', {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: file
  });
  if (!response.ok) throw new Error('No se pudo guardar la portada.');
  const result = await response.json();
  return result.path;
}

async function prepareGamesForServer() {
  let changed = false;
  for (const game of games) {
    if (!String(game.image || '').startsWith('data:')) continue;
    const file = await fetch(game.image).then((response) => response.blob());
    game.image = await uploadImage(file);
    changed = true;
  }
  return changed;
}

function escapeText(value) {
  return String(value || '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));
}

function stars(rating) {
  return '★★★★★★★★★★'.split('').map((star, index) => index < rating ? star : '☆').join('');
}

function purchaseDetails(game) {
  const details = [];
  if (game.cost !== '' && game.cost !== null && game.cost !== undefined && Number.isFinite(Number(game.cost))) {
    details.push(`$${Number(game.cost).toFixed(2)}`);
  }
  if (game.acquiredAt) {
    const acquiredDate = new Date(`${game.acquiredAt}T00:00:00`);
    details.push(Number.isNaN(acquiredDate.getTime()) ? game.acquiredAt : acquiredDate.toLocaleDateString('es-MX'));
  }
  if (game.hours !== '' && game.hours !== null && game.hours !== undefined && Number.isFinite(Number(game.hours))) details.push(`${Number(game.hours)} h`);
  return details.join(' · ');
}

function updateStats() {
  $('#totalCount').textContent = games.length;
  $('#playingCount').textContent = games.filter((game) => game.status === 'playing').length;
  $('#completedCount').textContent = games.filter((game) => ['completed', 'platinum'].includes(game.status)).length;
  $('#queueCount').textContent = games.filter((game) => game.inQueue).length;
  $('#queueLabel').textContent = games.filter((game) => game.inQueue).length;
  $('#endlessCount').textContent = games.filter((game) => game.endless || game.status === 'endless').length;
}

function sortGames(list) {
  const direction = activeSort.endsWith('-asc') ? 1 : -1;
  const field = activeSort.replace(/-(asc|desc)$/, '');
  return [...list].sort((first, second) => {
    if (field === 'name') return direction * first.name.localeCompare(second.name, 'es');
    const firstValue = field === 'rating' ? Number(first.rating) || 0 : field === 'hours' ? Number(first.hours) || 0 : field === 'cost' ? Number(first.cost) || 0 : first.acquiredAt || '';
    const secondValue = field === 'rating' ? Number(second.rating) || 0 : field === 'hours' ? Number(second.hours) || 0 : field === 'cost' ? Number(second.cost) || 0 : second.acquiredAt || '';
    if (firstValue === secondValue) return first.name.localeCompare(second.name, 'es');
    return (firstValue > secondValue ? 1 : -1) * direction;
  });
}

function renderLibrary() {
  const query = $('#searchInput').value.trim().toLowerCase();
  const visibleGames = sortGames(games.filter((game) => {
    const matchesFilter = activeFilter === 'all' || game.status === activeFilter;
    return matchesFilter && (!query || game.name.toLowerCase().includes(query));
  }));
  const list = $('#gameList');
  list.innerHTML = '';
  $('#emptyState').hidden = visibleGames.length > 0;
  visibleGames.forEach((game) => {
    const article = document.createElement('article');
    article.className = 'game-card';
    const cover = game.image ? `<img src="${game.image}" alt="Portada de ${escapeText(game.name)}">` : '<span>✦</span>';
    const tags = (game.tags || []).map((tag) => `<span class="tag-chip">${escapeText(tag)}</span>`).join('');
    const purchase = purchaseDetails(game);
    const steamLabel = game.steamAppId ? `<span class="steam-chip">Steam ${game.steamAppId}</span>` : '';
    const achievementSummary = Array.isArray(game.steamAchievements) ? (() => { const unlocked = game.steamAchievements.filter((achievement) => achievement.achieved === 1).length; const total = game.steamAchievements.length; const percent = total ? Math.round(unlocked / total * 100) : 0; return `<div class="steam-progress"><span>Steam · ${unlocked}/${total} logros · ${percent}%</span><i><b style="width:${percent}%"></b></i></div>`; })() : '';
    const steamHours = Number.isFinite(Number(game.steamPlaytimeHours)) ? `<span class="steam-hours">${Number(game.steamPlaytimeHours)} h en Steam</span>` : '';
    article.innerHTML = `<div class="cover">${cover}</div><div class="game-info"><h3>${escapeText(game.name)}</h3><span class="status status-${game.status}">${STATUS_LABELS[game.status]}</span><div class="stars" aria-label="${game.rating} de 10 estrellas">${stars(game.rating)}</div>${purchase ? `<div class="purchase-details">${escapeText(purchase)}</div>` : ''}<div class="game-tags">${tags}${steamLabel}</div>${steamHours}${achievementSummary}<p class="description">${escapeText(game.description) || 'Sin descripción todavía.'}</p><div class="card-actions"><button class="text-button" data-action="edit" data-id="${game.id}" type="button">Editar</button><button class="text-button" data-action="steam" data-id="${game.id}" type="button">${game.steamAppId ? 'Steam' : 'Vincular Steam'}</button><button class="text-button danger" data-action="delete" data-id="${game.id}" type="button">Eliminar</button></div></div>`;
    list.append(article);
  });
}

function renderQueue() {
  const queue = games.filter((game) => game.inQueue).sort((first, second) => first.queueOrder - second.queueOrder);
  const list = $('#queueList');
  list.innerHTML = '';
  $('#queueEmpty').hidden = queue.length > 0;
  queue.forEach((game, index) => {
    const item = document.createElement('div');
    item.className = 'queue-item';
    item.draggable = true;
    item.dataset.id = game.id;
    item.innerHTML = `<span class="queue-number">${index + 1}</span><div class="queue-cover">${game.image ? `<img src="${game.image}" alt="">` : '✦'}</div><span class="queue-name">${escapeText(game.name)}</span><span class="queue-move"><button type="button" aria-label="Subir ${escapeText(game.name)}" data-queue-action="up" data-id="${game.id}">▲</button><button type="button" aria-label="Bajar ${escapeText(game.name)}" data-queue-action="down" data-id="${game.id}">▼</button></span>`;
    list.append(item);
  });
}

function openSteamDialog(game) {
  steamGameId = game.id;
  selectedSteamApp = game.steamAppId ? { appid: game.steamAppId, name: game.steamName || game.name } : null;
  $('#steamCurrentGame').textContent = `Biblioteca: ${game.name}`;
  $('#steamSearch').value = '';
  $('#steamApiKey').value = '';
  $('#steamKeyStatus').textContent = '';
  $('#steamId64').value = game.steamId64 || '';
  $('#steamResults').innerHTML = '<p class="steam-hint">Escribe al menos dos caracteres para buscar un AppID.</p>';
  updateSteamSelection();
  $('#steamDialog').showModal();
}

function updateSteamSelection() {
  const selection = $('#steamSelection');
  const button = $('#syncSteamButton');
  if (!selectedSteamApp) { selection.hidden = true; button.disabled = true; return; }
  selection.hidden = false;
  selection.textContent = `Seleccionado: ${selectedSteamApp.name} · AppID ${selectedSteamApp.appid}`;
  button.disabled = false;
}

function renderSteamLibrary() {
  const query = $('#steamSearch').value.trim().toLowerCase();
  const results = steamLibrary.filter((game) => game.name.toLowerCase().includes(query));
  $('#steamResults').innerHTML = results.length ? results.map((game) => `<button type="button" class="steam-result" data-appid="${game.appid}" data-name="${escapeText(game.name)}"><strong>${escapeText(game.name)}</strong><small>${game.playtimeHours} h · AppID ${game.appid}</small></button>`).join('') : '<p class="steam-hint">No hay coincidencias en tu biblioteca.</p>';
}

async function loadSteamLibrary() {
  $('#steamResults').innerHTML = '<p class="steam-hint">Cargando tu biblioteca de Steam...</p>';
  try {
    const response = await fetch('/api/steam/library');
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo cargar tu biblioteca.');
    steamLibrary = result.games || [];
    renderSteamLibrary();
  } catch (error) { $('#steamResults').innerHTML = `<p class="steam-error">${escapeText(error.message)}</p>`; }
}

async function syncSteamGame() {
  if (!selectedSteamApp) return;
  const game = games.find((item) => item.id === steamGameId);
  if (!game) return;
  const response = await fetch('/api/steam/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: selectedSteamApp.appid, steamId64: $('#steamId64').value.trim() }) });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'No se pudo sincronizar Steam.');
  game.steamAppId = result.appId;
  game.steamName = result.name;
  game.steamId64 = $('#steamId64').value.trim() || undefined;
  game.steamPlaytimeHours = result.playtimeHours;
  game.steamAchievements = result.achievements;
  if (Number.isFinite(result.playtimeHours)) game.hours = result.playtimeHours;
  await saveGames();
  render();
  $('#steamDialog').close();
  showToast(`Steam vinculado: ${result.playtimeHours} h sincronizadas`);
}

function render() { updateStats(); renderLibrary(); renderQueue(); }

async function initializeGames() {
  try {
    const response = await fetch('/api/juegos/data', { cache: 'no-store' });
    if (!response.ok) throw new Error('No se pudo cargar la biblioteca.');
    const serverGames = await response.json();
    if (!serverGames.length && games.length) {
      serverReady = true;
      await prepareGamesForServer();
      await saveGames();
      showToast(`${games.length} juego${games.length === 1 ? '' : 's'} migrado${games.length === 1 ? '' : 's'} al servidor`);
    } else {
      games = Array.isArray(serverGames) ? serverGames.map((game) => ({
        ...game,
        rating: game.ratingScale === 10 ? (game.rating || 0) : (game.rating || 0) * 2,
        ratingScale: 10,
        tags: Array.isArray(game.tags) ? game.tags : []
      })) : [];
      await prepareGamesForServer();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(games));
      serverReady = true;
    }
  } catch (error) {
    console.error('Error cargando juegos desde el servidor:', error);
  }
  render();
}

function openDialog(game = null) {
  $('#gameForm').reset();
  $('#gameId').value = game?.id || '';
  $('#dialogTitle').textContent = game ? 'Editar juego' : 'Añadir juego';
  $('#gameName').value = game?.name || '';
  $('#gameStatus').value = game?.status || 'pending';
  $('#gameCost').value = game?.cost ?? '';
  $('#gameAcquiredAt').value = game?.acquiredAt || '';
  $('#gameHours').value = game?.hours ?? '';
  $('#gameEndless').checked = Boolean(game?.endless || game?.status === 'endless');
  $('#gameDescription').value = game?.description || '';
  document.querySelectorAll('.tag-checklist input').forEach((input) => { input.checked = (game?.tags || []).includes(input.value); });
  $('#gameInQueue').checked = Boolean(game?.inQueue);
  selectedRating = game?.rating || 0;
  currentImage = game?.image || '';
  currentImageFile = null;
  renderRating(); renderPreview();
  $('#gameDialog').showModal();
  $('#gameName').focus();
}

function renderRating() {
  $('#ratingInput').innerHTML = '';
  for (let rating = 1; rating <= 10; rating += 1) {
    const button = document.createElement('button');
    button.className = `rating-star${rating <= selectedRating ? ' selected' : ''}`;
    button.type = 'button'; button.textContent = '★'; button.setAttribute('aria-label', `${rating} estrellas`);
    button.addEventListener('click', () => { selectedRating = rating === selectedRating ? 0 : rating; renderRating(); });
    $('#ratingInput').append(button);
  }
}

function renderPreview() {
  const preview = $('#coverPreview');
  preview.innerHTML = currentImage ? `<img src="${currentImage}" alt="Vista previa de la portada">` : '<span>＋</span><small>Portada</small>';
  $('#removeImageButton').hidden = !currentImage;
}

function moveQueue(id, direction) {
  const queue = games.filter((game) => game.inQueue).sort((first, second) => first.queueOrder - second.queueOrder);
  const index = queue.findIndex((game) => game.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= queue.length) return;
  [queue[index].queueOrder, queue[target].queueOrder] = [queue[target].queueOrder, queue[index].queueOrder];
  saveGames().catch((error) => showToast(error.message)); render();
}

function reorderQueue(sourceId, targetId) {
  if (sourceId === targetId) return;
  const queue = games.filter((game) => game.inQueue).sort((first, second) => first.queueOrder - second.queueOrder);
  const sourceIndex = queue.findIndex((game) => game.id === sourceId);
  const targetIndex = queue.findIndex((game) => game.id === targetId);
  if (sourceIndex < 0 || targetIndex < 0) return;
  const [movedGame] = queue.splice(sourceIndex, 1);
  queue.splice(targetIndex, 0, movedGame);
  queue.forEach((game, index) => { game.queueOrder = index + 1; });
  saveGames().catch((error) => showToast(error.message)); render(); showToast('Orden de la cola actualizado');
}

$('#newGameButton').addEventListener('click', () => openDialog());
$('#emptyAddButton').addEventListener('click', () => openDialog());
$('#closeDialogButton').addEventListener('click', () => $('#gameDialog').close());
$('#cancelButton').addEventListener('click', () => $('#gameDialog').close());
$('#gameEndless').addEventListener('change', () => {
  if ($('#gameEndless').checked) $('#gameStatus').value = 'endless';
  else if ($('#gameStatus').value === 'endless') $('#gameStatus').value = 'pending';
});
$('#gameStatus').addEventListener('change', () => { $('#gameEndless').checked = $('#gameStatus').value === 'endless'; });
$('#searchInput').addEventListener('input', renderLibrary);
$('#sortSelect').addEventListener('change', (event) => { activeSort = event.target.value; renderLibrary(); });
$('#filterRow').addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]'); if (!button) return;
  activeFilter = button.dataset.filter;
  document.querySelectorAll('.filter-button').forEach((item) => item.classList.toggle('active', item === button));
  renderLibrary();
});
$('#gameList').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]'); if (!button) return;
  const index = games.findIndex((game) => game.id === button.dataset.id);
  if (button.dataset.action === 'edit') openDialog(games[index]);
  if (button.dataset.action === 'steam') openSteamDialog(games[index]);
  if (button.dataset.action === 'delete' && window.confirm(`¿Eliminar “${games[index].name}” de tu biblioteca?`)) { games.splice(index, 1); saveGames().catch((error) => showToast(error.message)); render(); showToast('Juego eliminado'); }
});
$('#closeSteamButton').addEventListener('click', () => $('#steamDialog').close());
$('#cancelSteamButton').addEventListener('click', () => $('#steamDialog').close());
$('#loadSteamLibraryButton').addEventListener('click', loadSteamLibrary);
$('#steamSearch').addEventListener('input', renderSteamLibrary);
$('#saveSteamKeyButton').addEventListener('click', async () => {
  const apiKey = $('#steamApiKey').value.trim();
  const status = $('#steamKeyStatus');
  if (!apiKey) { status.textContent = 'Introduce una clave.'; return; }
  try {
    const response = await fetch('/api/steam-key', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ apiKey }) });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No se pudo guardar la clave.');
    $('#steamApiKey').value = '';
    status.textContent = 'Clave guardada en el servidor.';
    status.classList.remove('steam-error');
  } catch (error) { status.textContent = error.message; status.classList.add('steam-error'); }
});
$('#steamResults').addEventListener('click', (event) => {
  const result = event.target.closest('.steam-result');
  if (!result) return;
  selectedSteamApp = { appid: Number(result.dataset.appid), name: result.dataset.name };
  updateSteamSelection();
});
$('#steamForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  try { await syncSteamGame(); } catch (error) { $('#steamSyncNote').textContent = error.message; $('#steamSyncNote').classList.add('steam-error'); }
});
$('#queueList').addEventListener('click', (event) => { const button = event.target.closest('[data-queue-action]'); if (button) moveQueue(button.dataset.id, button.dataset.queueAction === 'up' ? -1 : 1); });
$('#queueList').addEventListener('dragstart', (event) => {
  const item = event.target.closest('.queue-item');
  if (!item) return;
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', item.dataset.id);
  item.classList.add('dragging');
});
$('#queueList').addEventListener('dragover', (event) => {
  const item = event.target.closest('.queue-item');
  if (!item) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = 'move';
});
$('#queueList').addEventListener('drop', (event) => {
  const item = event.target.closest('.queue-item');
  if (!item) return;
  event.preventDefault();
  reorderQueue(event.dataTransfer.getData('text/plain'), item.dataset.id);
});
$('#queueList').addEventListener('dragend', (event) => { const item = event.target.closest('.queue-item'); if (item) item.classList.remove('dragging'); });
$('#removeImageButton').addEventListener('click', () => { currentImage = ''; renderPreview(); });
$('#gameImage').addEventListener('change', () => {
  const file = $('#gameImage').files[0]; if (!file) return;
  currentImageFile = file;
  currentImage = URL.createObjectURL(file);
  renderPreview();
});
$('#gameForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const id = $('#gameId').value || crypto.randomUUID();
  const existing = games.find((game) => game.id === id);
  const wasInQueue = existing?.inQueue || false;
  const inQueue = $('#gameInQueue').checked;
  const nextOrder = games.reduce((highest, game) => Math.max(highest, game.queueOrder || 0), 0) + 1;
  const tags = [...document.querySelectorAll('.tag-checklist input:checked')].map((input) => input.value);
  const rawCost = $('#gameCost').value.trim();
  if (currentImageFile) currentImage = await uploadImage(currentImageFile);
  const endless = $('#gameEndless').checked;
  const rawHours = $('#gameHours').value.trim();
  const game = { id, name: $('#gameName').value.trim(), status: endless ? 'endless' : $('#gameStatus').value, endless, hours: rawHours === '' ? '' : Number(rawHours), cost: rawCost === '' ? '' : Number(rawCost), acquiredAt: $('#gameAcquiredAt').value, rating: selectedRating, ratingScale: 10, tags, description: $('#gameDescription').value.trim(), image: currentImage, inQueue, queueOrder: existing?.queueOrder || (inQueue && !wasInQueue ? nextOrder : 0) };
  games = existing ? games.map((item) => item.id === id ? game : item) : [...games, game];
  saveGames().catch((error) => showToast(error.message)); render(); $('#gameDialog').close(); showToast(existing ? 'Juego actualizado' : 'Juego añadido');
});

function showToast(message) { const toast = $('#toast'); toast.textContent = message; toast.classList.add('show'); window.setTimeout(() => toast.classList.remove('show'), 2200); }
render();
initializeGames();
