const db = require('./services/database');
const { consultarPokemon, getImagen } = require('./services/pokeapi');

const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');
const { execFile } = require('child_process');
const { WebSocketServer } = require('ws');
const bot = require('./services/bot');

const PORT = process.env.PORT || 3000;
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/imagenes', express.static(path.join(__dirname, 'imagenes')));
app.use('/finanzas', express.static(path.join(__dirname, 'public', 'finanzas')));

const clients = new Set();
const riotKeyMetaPath = path.join(__dirname, '.riot-key-meta.json');
const steamKeyPath = path.join(__dirname, '.steam-key.json');
const steamIdPath = path.join(__dirname, '.steam-id.json');
const finanzasDataDir = path.join(__dirname, 'data', 'finanzas');
const finanzasFiles = ['usuarios', 'cuentas', 'historialPagos', 'gastosHormiga', 'gastos', 'personas', 'prestamos', 'sesion'];
const juegosDataPath = path.join(__dirname, 'data', 'juegos.json');
const juegosImagesDir = path.join(__dirname, 'imagenes', 'juegos');
const steamCatalogPath = path.join(__dirname, 'data', 'steam-apps.json');
const steamApiBase = 'https://api.steampowered.com';

function loadSteamKey() {
  if (process.env.STEAM_API_KEY) return process.env.STEAM_API_KEY;
  try {
    const data = JSON.parse(fs.readFileSync(steamKeyPath, 'utf8'));
    return typeof data.apiKey === 'string' ? data.apiKey : '';
  } catch (_err) {
    return '';
  }
}

function loadSteamId() {
  if (process.env.STEAM_ID64) return process.env.STEAM_ID64;
  try {
    const data = JSON.parse(fs.readFileSync(steamIdPath, 'utf8'));
    return typeof data.steamId64 === 'string' ? data.steamId64 : '';
  } catch (_err) {
    return '';
  }
}

process.env.STEAM_API_KEY = loadSteamKey();
process.env.STEAM_ID64 = loadSteamId();

function readFinanzasFile(name, fallback) {
  try {
    return JSON.parse(fs.readFileSync(path.join(finanzasDataDir, `${name}.json`), 'utf8'));
  } catch (_err) {
    return fallback;
  }
}

function writeFinanzasFile(name, data) {
  const filePath = path.join(finanzasDataDir, `${name}.json`);
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function readJuegosFile() {
  try {
    const data = JSON.parse(fs.readFileSync(juegosDataPath, 'utf8'));
    return Array.isArray(data) ? data : [];
  } catch (_err) {
    return [];
  }
}

function writeJuegosFile(data) {
  const tempPath = `${juegosDataPath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, juegosDataPath);
}

function readSteamCatalog() {
  try {
    const data = JSON.parse(fs.readFileSync(steamCatalogPath, 'utf8'));
    return Array.isArray(data.apps) ? data : { apps: [] };
  } catch (_err) {
    return { apps: [], updatedAt: null };
  }
}

async function refreshSteamCatalog() {
  const response = await fetch(`${steamApiBase}/ISteamApps/GetAppList/v2/`);
  if (!response.ok) throw new Error(`Steam catálogo respondió ${response.status}.`);
  const payload = await response.json();
  const catalog = { apps: payload?.applist?.apps || [], updatedAt: new Date().toISOString() };
  writeJsonFile(steamCatalogPath, catalog);
  return catalog;
}

function writeJsonFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, filePath);
}

function requireSteamKey(res) {
  if (!process.env.STEAM_API_KEY) {
    res.status(503).json({ error: 'Configura STEAM_API_KEY en el servidor.' });
    return false;
  }
  return true;
}

function readRiotKeyMeta() {
  try {
    return JSON.parse(fs.readFileSync(riotKeyMetaPath, 'utf8'));
  } catch (_err) {
    return {};
  }
}

function saveRiotKeyMeta(apiKey) {
  const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  fs.writeFileSync(riotKeyMetaPath, JSON.stringify({ keyHash, updatedAt: Date.now() }));
}

function broadcast(event, data) {
  const payload = JSON.stringify({ event, data });
  for (const ws of clients) {
    if (ws.readyState === ws.OPEN) {
      ws.send(payload);
    }
  }
}

bot.on('status', (data) => broadcast('status', data));
bot.on('log', (entry) => broadcast('log', entry));

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ event: 'init', data: bot.getState() }));

  ws.on('close', () => clients.delete(ws));
});

app.get('/api/status', (_req, res) => {
  res.json(bot.getState());
});

app.get('/api/finanzas/data', (_req, res) => {
  const data = {};
  for (const name of finanzasFiles) data[name] = readFinanzasFile(name, name === 'sesion' ? null : []);
  res.json(data);
});

app.put('/api/finanzas/data/:name', (req, res) => {
  const { name } = req.params;
  if (!finanzasFiles.includes(name) || !Object.prototype.hasOwnProperty.call(req.body || {}, 'data')) {
    return res.status(400).json({ error: 'Archivo financiero inválido.' });
  }
  const value = req.body.data;
  if (name === 'sesion' ? (value !== null && typeof value !== 'object') : !Array.isArray(value)) {
    return res.status(400).json({ error: 'Formato de datos inválido.' });
  }
  try {
    writeFinanzasFile(name, value);
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error guardando datos financieros:', error.message);
    return res.status(500).json({ error: 'No se pudieron guardar los datos.' });
  }
});

app.get('/api/juegos/data', (_req, res) => {
  res.json(readJuegosFile());
});

app.put('/api/juegos/data', (req, res) => {
  if (!Array.isArray(req.body?.data)) {
    return res.status(400).json({ error: 'Formato de juegos inválido.' });
  }
  try {
    writeJuegosFile(req.body.data);
    return res.json({ ok: true, count: req.body.data.length });
  } catch (error) {
    console.error('Error guardando juegos:', error.message);
    return res.status(500).json({ error: 'No se pudieron guardar los juegos.' });
  }
});

app.post('/api/juegos/image', (req, res) => {
  const contentType = (req.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']);
  if (!allowedTypes.has(contentType)) {
    return res.status(400).json({ error: 'Formato de imagen no permitido.' });
  }

  const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[contentType];
  const imageName = `${crypto.randomUUID()}.${extension}`;
  const imagePath = path.join(juegosImagesDir, imageName);
  let size = 0;
  const chunks = [];

  req.on('data', (chunk) => {
    size += chunk.length;
    if (size <= 10 * 1024 * 1024) chunks.push(chunk);
  });
  req.on('end', () => {
    if (size > 10 * 1024 * 1024) return res.status(413).json({ error: 'La imagen no puede superar 10 MB.' });
    try {
      fs.mkdirSync(juegosImagesDir, { recursive: true });
      fs.writeFileSync(imagePath, Buffer.concat(chunks));
      return res.json({ ok: true, path: `/imagenes/juegos/${imageName}` });
    } catch (error) {
      console.error('Error guardando imagen de juego:', error.message);
      return res.status(500).json({ error: 'No se pudo guardar la imagen.' });
    }
  });
  req.on('error', () => res.status(400).json({ error: 'No se pudo recibir la imagen.' }));
});

app.get('/api/steam/status', (_req, res) => {
  const catalog = readSteamCatalog();
  res.json({ configured: Boolean(process.env.STEAM_API_KEY), steamIdConfigured: Boolean(process.env.STEAM_ID64), catalogCount: catalog.apps.length, catalogUpdatedAt: catalog.updatedAt });
});

app.post('/api/steam-key', (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!/^[A-Za-z0-9]{20,64}$/.test(apiKey)) {
    return res.status(400).json({ error: 'Introduce una clave Steam Web API válida.' });
  }
  try {
    fs.writeFileSync(steamKeyPath, `${JSON.stringify({ apiKey, updatedAt: Date.now() }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    process.env.STEAM_API_KEY = apiKey;
    return res.json({ ok: true });
  } catch (error) {
    console.error('Error guardando clave Steam:', error.message);
    return res.status(500).json({ error: 'No se pudo guardar la clave Steam.' });
  }
});

app.get('/api/steam/search', async (req, res) => {
  const query = typeof req.query.q === 'string' ? req.query.q.trim().toLowerCase() : '';
  if (query.length < 2) return res.json([]);
  try {
    const storeUrl = `https://store.steampowered.com/api/storesearch/?${new URLSearchParams({ term: query, cc: 'us', l: 'english' })}`;
    const storeResponse = await fetch(storeUrl);
    if (storeResponse.ok) {
      const storePayload = await storeResponse.json();
      const storeResults = (storePayload?.items || []).slice(0, 30).map((item) => ({ appid: item.id, name: item.name }));
      if (storeResults.length) return res.json(storeResults);
    }
  } catch (error) {
    console.warn('Buscador de tienda Steam no disponible:', error.message);
  }
  let catalog = readSteamCatalog();
  try {
    if (!catalog.apps.length) catalog = await refreshSteamCatalog();
  } catch (error) {
    console.error('Error cargando catálogo Steam:', error.message);
    return res.status(502).json({ error: 'No se pudo cargar el catálogo de Steam.' });
  }
  const results = catalog.apps.filter((app) => app.name?.toLowerCase().includes(query)).slice(0, 30);
  return res.json(results);
});

app.get('/api/steam/library', async (req, res) => {
  if (!requireSteamKey(res)) return;
  const linkedGame = readJuegosFile().find((game) => /^\d{10,20}$/.test(String(game.steamId64 || '')));
  const steamId = String(req.query.steamId64 || process.env.STEAM_ID64 || linkedGame?.steamId64 || '').trim();
  if (!/^\d{10,20}$/.test(steamId)) return res.status(400).json({ error: 'Configura un SteamID64 válido.' });
  try {
    const params = new URLSearchParams({ key: process.env.STEAM_API_KEY, steamid: steamId, include_appinfo: 'true', format: 'json' });
    const response = await fetch(`${steamApiBase}/IPlayerService/GetOwnedGames/v0001/?${params}`);
    if (!response.ok) return res.status(response.status).json({ error: 'Steam no pudo consultar tu biblioteca.' });
    const payload = await response.json();
    const games = (payload?.response?.games || []).map((game) => ({
      appid: game.appid,
      name: game.name,
      playtimeHours: Number((game.playtime_forever / 60).toFixed(1)),
      icon: game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.img_icon_url}.jpg` : null
    })).sort((first, second) => first.name.localeCompare(second.name, 'es'));
    return res.json({ steamId64: steamId, games });
  } catch (error) {
    console.error('Error cargando biblioteca Steam:', error.message);
    return res.status(502).json({ error: 'No se pudo conectar con Steam.' });
  }
});

app.post('/api/steam/sync', async (req, res) => {
  if (!requireSteamKey(res)) return;
  const appId = Number(req.body?.appId);
  let steamId = String(req.body?.steamId64 || process.env.STEAM_ID64 || '').trim();
  if (!Number.isInteger(appId) || appId <= 0 || !steamId) {
    return res.status(400).json({ error: 'AppID o perfil de Steam inválido.' });
  }
  try {
    if (!/^\d{10,20}$/.test(steamId)) {
      const vanity = steamId.replace(/^https?:\/\/(www\.)?steamcommunity\.com\/id\//i, '').replace(/\/$/, '');
      if (!vanity || /[\/\\]/.test(vanity)) return res.status(400).json({ error: 'Usa un SteamID64 o una URL /id/ de Steam válida.' });
      const vanityParams = new URLSearchParams({ key: process.env.STEAM_API_KEY, vanityurl: vanity, format: 'json' });
      const vanityResponse = await fetch(`${steamApiBase}/ISteamUser/ResolveVanityURL/v0001/?${vanityParams}`);
      const vanityPayload = await vanityResponse.json();
      if (!vanityResponse.ok || vanityPayload?.response?.success !== 1) return res.status(404).json({ error: 'No se pudo resolver ese perfil de Steam.' });
      steamId = vanityPayload.response.steamid;
    }
    if (!/^\d{10,20}$/.test(steamId)) return res.status(400).json({ error: 'SteamID64 inválido.' });
    fs.writeFileSync(steamIdPath, `${JSON.stringify({ steamId64: steamId, updatedAt: Date.now() }, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    process.env.STEAM_ID64 = steamId;
    const params = new URLSearchParams({ key: process.env.STEAM_API_KEY, steamid: steamId, include_appinfo: 'true', format: 'json' });
    params.set('appids_filter[0]', String(appId));
    const gamesResponse = await fetch(`${steamApiBase}/IPlayerService/GetOwnedGames/v0001/?${params}`);
    if (!gamesResponse.ok) return res.status(gamesResponse.status).json({ error: 'Steam no pudo consultar la biblioteca.' });
    const gamesPayload = await gamesResponse.json();
    const game = gamesPayload?.response?.games?.find((item) => Number(item.appid) === appId);
    if (!game) return res.status(404).json({ error: 'Steam no encontró ese juego en la biblioteca del usuario.' });
    let achievements = null;
    const achievementParams = new URLSearchParams({ appid: String(appId), key: process.env.STEAM_API_KEY, steamid: steamId });
    const achievementsResponse = await fetch(`${steamApiBase}/ISteamUserStats/GetPlayerAchievements/v0001/?${achievementParams}`);
    if (achievementsResponse.ok) {
      const achievementPayload = await achievementsResponse.json();
      achievements = achievementPayload?.playerstats?.achievements || [];
    }
    return res.json({ appId, name: game.name, playtimeHours: Number((game.playtime_forever / 60).toFixed(1)), achievements, icon: game.img_icon_url ? `https://media.steampowered.com/steamcommunity/public/images/apps/${appId}/${game.img_icon_url}.jpg` : null });
  } catch (error) {
    console.error('Error sincronizando Steam:', error.message);
    return res.status(502).json({ error: 'No se pudo conectar con Steam.' });
  }
});

app.get('/api/riot-key/status', (_req, res) => {
  const meta = readRiotKeyMeta();
  const configured = Boolean(process.env.RIOT_API_KEY || meta.keyHash);
  const nextUpdateAt = meta.updatedAt ? meta.updatedAt + 24 * 60 * 60 * 1000 : null;
  res.json({ configured, nextUpdateAt });
});

app.post('/api/riot-key', (req, res) => {
  const apiKey = typeof req.body?.apiKey === 'string' ? req.body.apiKey.trim() : '';
  if (!/^RGAPI-[A-Za-z0-9-]+$/.test(apiKey)) {
    return res.status(400).json({ error: 'Introduce una clave Riot API válida.' });
  }

  const meta = readRiotKeyMeta();
  const sameKey = meta.keyHash === crypto.createHash('sha256').update(apiKey).digest('hex');
  const stillValid = meta.updatedAt && Date.now() - meta.updatedAt < 24 * 60 * 60 * 1000;
  if (sameKey && stillValid) {
    process.env.RIOT_API_KEY = apiKey;
    return res.json({ ok: true, alreadyConfigured: true, nextUpdateAt: meta.updatedAt + 24 * 60 * 60 * 1000 });
  }

  const finish = (error) => {
    if (error) {
      console.error('Error guardando RIOT_API_KEY:', error.message);
      return res.status(500).json({ error: 'No se pudo guardar la clave en el servidor.' });
    }
    process.env.RIOT_API_KEY = apiKey;
    saveRiotKeyMeta(apiKey);
    return res.json({ ok: true, nextUpdateAt: Date.now() + 24 * 60 * 60 * 1000 });
  };

  if (process.platform !== 'win32') return finish(null);
  execFile('setx', ['RIOT_API_KEY', apiKey], { windowsHide: true }, finish);
});

app.get('/api/riot', async (req, res) => {
  const riotApiKey = req.get('X-Riot-Token') || process.env.RIOT_API_KEY;
  const requestedUrl = typeof req.query.url === 'string' ? req.query.url : '';
  const allowedHosts = new Set([
    'americas.api.riotgames.com',
    'la1.api.riotgames.com'
  ]);

  if (!riotApiKey) {
    return res.status(503).json({
      status: { status_code: 503, message: 'Falta configurar RIOT_API_KEY en el servidor.' }
    });
  }

  let riotUrl;
  try {
    riotUrl = new URL(requestedUrl);
  } catch (_err) {
    return res.status(400).json({ error: 'URL de Riot inválida.' });
  }

  if (riotUrl.protocol !== 'https:' || !allowedHosts.has(riotUrl.hostname)) {
    return res.status(400).json({ error: 'Destino de Riot no permitido.' });
  }

  try {
    const riotResponse = await fetch(riotUrl, {
      headers: { 'X-Riot-Token': riotApiKey }
    });
    const responseText = await riotResponse.text();
    let payload;

    try {
      payload = responseText ? JSON.parse(responseText) : {};
    } catch (_err) {
      payload = { error: responseText || 'Respuesta no válida de Riot.' };
    }

    if (!riotResponse.ok) {
      return res.status(riotResponse.status).json({
        status: {
          status_code: riotResponse.status,
          message: payload?.status?.message || payload?.message || 'Riot rechazó la solicitud.'
        }
      });
    }

    return res.json(payload);
  } catch (err) {
    console.error('Error en proxy de Riot:', err.message);
    return res.status(502).json({
      status: { status_code: 502, message: 'No se pudo conectar con Riot Games.' }
    });
  }
});

app.post('/api/start', async (_req, res) => {
  if (bot.isRunning()) {
    return res.status(409).json({ ok: false, message: 'El bot ya está en ejecución.' });
  }

  bot.start().catch((err) => {
    bot.log(`Error inesperado: ${err.message}`, 'error');
  });

  res.json({ ok: true, message: 'Bot iniciando...' });
});

app.post('/api/stop', async (_req, res) => {
  await bot.stop();
  res.json({ ok: true, message: 'Bot detenido.' });
});

function startServer() {
  server.once('error', (error) => {
    if (error.code === 'EADDRINUSE') {
      console.error(`\n❌ El puerto ${PORT} ya está ocupado. Cierra la instancia anterior o inicia con otro puerto usando $env:PORT.\n`);
      process.exitCode = 1;
      return;
    }
    throw error;
  });
  server.listen(PORT, () => {
    console.log(`\n🌐 Panel web: http://localhost:${PORT}`);
    console.log('   Abre esa URL en el navegador para controlar el bot.\n');
  });
}

process.on('SIGINT', async () => {
  console.log('\nCerrando servidor...');
  await bot.stop();
  server.close(() => process.exit(0));
});

app.get('/api/entrenadores', async (req, res) => {
  try {
    const [entrenadores] = await db.execute(`
      SELECT id, nombre_whatsapp, experiencia, nivel, pokeballs
      FROM usuarios
    `);

    for (let u of entrenadores) {
      const [pokes] = await db.execute('SELECT COUNT(*) as total FROM pokemon_atrapados WHERE usuario_id = ?', [u.id]);
      u.cantidad_pokemon = pokes[0].total;
    }

    res.json(entrenadores);
  } catch (err) {
    console.error('ERROR EN SQL:', err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/pokedex/:usuarioId', async (req, res) => {
  const { usuarioId } = req.params;
  try {
    const [usuarioRows] = await db.execute(
      'SELECT id, nombre_whatsapp, experiencia, nivel, pokeballs FROM usuarios WHERE id = ?',
      [usuarioId]
    );

    if (!usuarioRows.length) {
      return res.status(404).json({ error: 'Entrenador no encontrado' });
    }

    const usuario = usuarioRows[0];
    const [pokesBD] = await db.execute(
      `SELECT pa.pokemon_id, pa.nombre, pa.nivel, pa.experiencia, ep.jerarquia
       FROM pokemon_atrapados pa
       LEFT JOIN equipo_pokemon ep ON ep.pokemon_id = pa.id AND ep.usuario_id = ?
       WHERE pa.usuario_id = ?`,
      [usuarioId, usuarioId]
    );

    const pokedexDetallada = await Promise.all(pokesBD.map(async (p) => {
      try {
        const data = await consultarPokemon(p.pokemon_id);
        const imagen = getImagen(data);
        
        const nivelActual = p.nivel || 1;
        const multNivel = 1 + (nivelActual - 1) * 0.05;

        const stats = Array.isArray(data.stats)
          ? data.stats.map((stat) => {
              const statName = stat?.stat?.name || 'unknown';
              const baseValue = stat?.base_stat || 0;
              let finalValue = baseValue;

              if (statName === 'hp') {
                finalValue = Math.floor(baseValue * 2 * multNivel);
              } else if (statName === 'speed') {
                finalValue = Math.floor(baseValue);
              } else {
                finalValue = Math.floor(baseValue * multNivel);
              }

              return {
                name: statName,
                value: finalValue
              };
            })
          : [];

        const tipos = Array.isArray(data.types)
          ? data.types.map((typeSlot) => typeSlot?.type?.name || 'unknown')
          : [];

        return {
          nombre: p.nombre,
          imagen: imagen || null,
          nivel: p.nivel || 1,
          pokemon_id: p.pokemon_id,
          experiencia: p.experiencia || 0,
          stats,
          tipos,
          estaEnEquipo: !!p.jerarquia,
          jerarquia: p.jerarquia || null
        };
      } catch (e) {
        return {
          nombre: p.nombre,
          imagen: null,
          nivel: p.nivel || 1,
          pokemon_id: p.pokemon_id,
          experiencia: p.experiencia || 0,
          stats: [],
          tipos: [],
          estaEnEquipo: !!p.jerarquia,
          jerarquia: p.jerarquia || null
        };
      }
    }));

    res.json({ usuario, pokedex: pokedexDetallada });
  } catch (err) {
    console.error('ERROR EN POKEDEX:', err);
    res.status(500).json({ error: 'Error al consultar Pokédex' });
  }
});

app.get('/api/inventario-campos', async (req, res) => {
  try {
    const [columns] = await db.execute("SHOW COLUMNS FROM inventario");
    const inventarioCampos = columns
      .map(col => col.Field)
      .filter(field => field !== 'id' && field !== 'usuario_id');

    const todosLosCampos = ['monedas', 'pokeballs', ...inventarioCampos];
    res.json(todosLosCampos);
  } catch (err) {
    console.error('Error al obtener columnas de inventario:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==========================================================
// NUEVO: ENVIAR PAQUETE MULTIPLE CON AVISO POR WHATSAPP
// ==========================================================
app.post('/api/give-package', async (req, res) => {
  const { usuarioId, paquete } = req.body;

  if (!usuarioId || !Array.isArray(paquete) || paquete.length === 0) {
    return res.status(400).json({ error: 'Parámetros de entrega inválidos' });
  }

  const connection = await db.getConnection();
  let whatsappId = null;

  try {
    await connection.beginTransaction();

    // 1. Obtener whatsapp_id del usuario
    const [userRows] = await connection.execute('SELECT whatsapp_id FROM usuarios WHERE id = ?', [usuarioId]);
    if (userRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }
    whatsappId = userRows[0].whatsapp_id;

    const [columns] = await connection.execute("SHOW COLUMNS FROM inventario");
    const validFields = columns.map(col => col.Field);

    const [invRows] = await connection.execute('SELECT id FROM inventario WHERE usuario_id = ? FOR UPDATE', [usuarioId]);
    const necesitaInsertInventario = invRows.length === 0;

    let insertFields = ['usuario_id'];
    let insertValues = [usuarioId];
    let insertPlaceholders = ['?'];
    const updatesInventario = [];

    // Procesamos el carrito
    for (const reqItem of paquete) {
      const item = reqItem.item;
      const cantNum = parseInt(reqItem.cantidad);

      if (isNaN(cantNum) || cantNum <= 0) continue;

      if (item === 'monedas' || item === 'pokeballs') {
        await connection.execute(`UPDATE usuarios SET ${item} = ${item} + ? WHERE id = ?`, [cantNum, usuarioId]);
      } else if (validFields.includes(item)) {
        if (necesitaInsertInventario) {
          insertFields.push(item);
          insertValues.push(cantNum);
          insertPlaceholders.push('?');
        } else {
          updatesInventario.push({ field: item, value: cantNum });
        }
      } else {
        throw new Error(`Objeto inválido detectado: ${item}`);
      }
    }

    if (necesitaInsertInventario && insertFields.length > 1) {
      const query = `INSERT INTO inventario (${insertFields.join(', ')}) VALUES (${insertPlaceholders.join(', ')})`;
      await connection.execute(query, insertValues);
    } else if (!necesitaInsertInventario && updatesInventario.length > 0) {
      for (const up of updatesInventario) {
         await connection.execute(`UPDATE inventario SET ${up.field} = ${up.field} + ? WHERE usuario_id = ?`, [up.value, usuarioId]);
      }
    }

    await connection.commit();
  } catch (err) {
    await connection.rollback();
    console.error('Error entregando paquete por panel:', err);
    return res.status(500).json({ error: err.message });
  } finally {
    connection.release();
  }

  // =====================================
  // ENVIAR MENSAJE DE WHATSAPP AL USUARIO (CORREGIDO)
  // =====================================
  try {
    if (bot && bot.client && whatsappId) {
      let mensajeWpp = `🎁 *¡HAS RECIBIDO UN PAQUETE DE REGALO!* 🎁\n\nLos administradores te han enviado un paquete especial. Contiene:\n\n`;
      
      paquete.forEach(p => {
         const nombreBonito = p.item.toUpperCase().replace(/_/g, ' ');
         mensajeWpp += `• *${p.cantidad}x* ${nombreBonito}\n`;
      });
      
      mensajeWpp += `\n_Tus objetos ya han sido guardados en tu inventario. ¡Disfrútalos!_`;

      // ----------------------------------------------------
      // SOLUCIÓN: Limpiamos el ID multi-dispositivo (Los ":" )
      // ----------------------------------------------------
      const cleanId = whatsappId.split(':')[0];
      const chatId = cleanId.includes('@') ? cleanId : `${cleanId}@c.us`;

      console.log(`\n[Panel] Intentando notificar regalo a WhatsApp: ${chatId}`);
      await bot.client.sendMessage(chatId, mensajeWpp);
      console.log(`[Panel] Notificación enviada con éxito a ${chatId}`);
      bot.log(`Se entregó un paquete de regalo y se notificó a ${cleanId}`, 'info');
      
    } else {
      console.warn(`[Panel] No se pudo enviar WhatsApp. Cliente listo? ${!!(bot && bot.client)} | ID: ${whatsappId}`);
    }
  } catch (errMsg) {
    console.error('[Panel] Error enviando mensaje de WhatsApp tras regalo:', errMsg);
  }

  res.json({ success: true });
});


// ==========================================================
// NUEVO: CONSULTAR EFECTIVIDAD DIRECTAMENTE DESDE LA BASE DE DATOS
// ==========================================================
app.get('/api/efectividad', async (req, res) => {
  const tiposStr = req.query.tipos;
  if (!tiposStr) return res.json({ ofensivo: {}, defensivo: {}, inmunidades: {} });
  const tipos = tiposStr.split(',');

  try {
    // 1. DEFENSIVO & INMUNIDADES (Recibidas)
    const [todosLosTipos] = await db.execute('SELECT DISTINCT atacante_nombre as nombre FROM tipos_relaciones WHERE atacante_nombre IS NOT NULL');
    const multiplicadoresDef = {};
    for(let t of todosLosTipos) {
        multiplicadoresDef[t.nombre] = 1;
    }

    const placeholders = tipos.map(() => '?').join(',');
    const [relacionesDef] = await db.execute(`
      SELECT atacante_nombre as atacante, multiplicador 
      FROM tipos_relaciones 
      WHERE defensor_nombre IN (${placeholders})
    `, tipos);

    // Multiplicamos cruzado según los tipos que defienden
    relacionesDef.forEach(rel => {
      if (multiplicadoresDef[rel.atacante] !== undefined) {
         multiplicadoresDef[rel.atacante] *= parseFloat(rel.multiplicador);
      }
    });

    // Corrección neutral
    Object.keys(multiplicadoresDef).forEach(k => {
       if (Math.abs(multiplicadoresDef[k] - 0.9375) < 0.001) multiplicadoresDef[k] = 1;
    });

    const defensivo = { weak4x: [], weak2x: [], resist2x: [], resist4x: [] };
    const no_me_hacen_dano = [];

    Object.entries(multiplicadoresDef).forEach(([type, mult]) => {
        if (mult >= 1.5) defensivo.weak4x.push(type);
        else if (mult === 1.25) defensivo.weak2x.push(type);
        else if (mult === 0.75) defensivo.resist2x.push(type);
        else if (mult > 0 && mult <= 0.6) defensivo.resist4x.push(type);
        else if (mult === 0) no_me_hacen_dano.push(type);
    });

    // 2. OFENSIVO & INMUNIDADES (Causadas)
    const ofensivo = {};
    const no_hago_dano = [];

    // Evaluamos los ataques por CADA TIPO que tiene el Pokémon
    for (const miTipo of tipos) {
       ofensivo[miTipo] = { fuerte: [], debil: [] };
       
       const [relacionesOf] = await db.execute(`
         SELECT defensor_nombre as defensor, multiplicador 
         FROM tipos_relaciones 
         WHERE atacante_nombre = ?
       `, [miTipo]);

       relacionesOf.forEach(rel => {
          const mult = parseFloat(rel.multiplicador);
          if (mult === 1.25) ofensivo[miTipo].fuerte.push(rel.defensor);
          else if (mult === 0.75) ofensivo[miTipo].debil.push(rel.defensor);
          else if (mult === 0) no_hago_dano.push({ mi_tipo: miTipo, defensor: rel.defensor });
       });
    }

    res.json({
       defensivo,
       ofensivo,
       inmunidades: {
          no_me_hacen_dano,
          no_hago_dano
       }
    });
  } catch (err) {
    console.error('Error en api/efectividad:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = { startServer };