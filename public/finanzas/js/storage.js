/**
 * Guardado en archivos .json (carpeta data/ junto al proyecto)
 * Intenta conectar automáticamente; si no puede, pide seleccionar carpeta.
 */
const JSON_FILES = {
  usuarios: 'usuarios.json',
  cuentas: 'cuentas.json',
  historialPagos: 'historialPagos.json',
  gastosHormiga: 'gastosHormiga.json',
  prestamos: 'prestamos.json',
  sesion: 'sesion.json'
};

const RUTA_DATA = 'data/';

const cache = {
  usuarios: [],
  cuentas: [],
  historialPagos: [],
  gastosHormiga: [],
  prestamos: [],
  sesion: null
};

let dirHandle = null;
let listo = false;
let modoFetch = false;
let modoServidor = window.location.pathname.startsWith('/finanzas');

async function cargarDatosServidor() {
  const response = await fetch('/api/finanzas/data', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se pudieron cargar los datos financieros.');
  const datos = await response.json();
  await aplicarCacheDesdeDatos(
    datos.usuarios,
    datos.cuentas,
    datos.historialPagos,
    datos.gastosHormiga,
    datos.prestamos,
    datos.sesion
  );
}

async function guardarDatosServidor(tipo) {
  const response = await fetch(`/api/finanzas/data/${tipo}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: tipo === 'usuarios' ? cache.usuarios
      : tipo === 'cuentas' ? cache.cuentas
      : tipo === 'historialPagos' ? cache.historialPagos
      : tipo === 'gastosHormiga' ? cache.gastosHormiga
      : tipo === 'prestamos' ? cache.prestamos : cache.sesion })
  });
  if (!response.ok) throw new Error(`No se pudo guardar ${tipo}.`);
}

function supportsFiles() {
  return typeof window.showDirectoryPicker === 'function';
}

async function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open('finanzas-db', 1);
    req.onerror = () => reject(req.error);
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = (e) => {
      e.target.result.createObjectStore('config');
    };
  });
}

async function guardarCarpeta(handle) {
  const db = await openDb();
  const tx = db.transaction('config', 'readwrite');
  tx.objectStore('config').put(handle, 'dir');
  return new Promise((res, rej) => {
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

async function cargarCarpetaGuardada() {
  try {
    const db = await openDb();
    const tx = db.transaction('config', 'readonly');
    const req = tx.objectStore('config').get('dir');
    return new Promise((res) => {
      req.onsuccess = () => res(req.result || null);
      req.onerror = () => res(null);
    });
  } catch {
    return null;
  }
}

async function leerArchivo(nombre) {
  const fileHandle = await dirHandle.getFileHandle(nombre);
  const file = await fileHandle.getFile();
  const text = await file.text();
  return text.trim() ? JSON.parse(text) : null;
}

async function escribirArchivo(nombre, data) {
  const fileHandle = await dirHandle.getFileHandle(nombre, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
}

async function fetchJsonRelativo(archivo, valorPorDefecto) {
  const res = await fetch(RUTA_DATA + archivo, { cache: 'no-store' });
  if (!res.ok) throw new Error(`No se pudo leer ${archivo}`);
  const text = await res.text();
  if (!text.trim()) return valorPorDefecto;
  return JSON.parse(text);
}

/** Si ya es data/ o busca la subcarpeta data dentro del proyecto */
async function resolveDataDirectory(handle) {
  try {
    await handle.getFileHandle(JSON_FILES.usuarios);
    return handle;
  } catch {
    /* no es la carpeta data directamente */
  }
  return handle.getDirectoryHandle('data', { create: false });
}

async function aplicarCacheDesdeDatos(usuarios, cuentas, historial, hormiga, prestamos, sesion) {
  cache.usuarios = Array.isArray(usuarios) ? usuarios : [];
  cache.cuentas = Array.isArray(cuentas) ? cuentas : [];
  cache.historialPagos = Array.isArray(historial) ? historial : [];
  cache.gastosHormiga = Array.isArray(hormiga) ? hormiga : [];
  cache.prestamos = Array.isArray(prestamos) ? prestamos : [];
  cache.sesion = sesion && sesion.id ? sesion : null;
}

async function cargarTodosLosJSON() {
  const [usuarios, cuentas, historial, hormiga, prestamos, sesion] = await Promise.all([
    leerArchivo(JSON_FILES.usuarios).catch(() => []),
    leerArchivo(JSON_FILES.cuentas).catch(() => []),
    leerArchivo(JSON_FILES.historialPagos).catch(() => []),
    leerArchivo(JSON_FILES.gastosHormiga).catch(() => []),
    leerArchivo(JSON_FILES.prestamos).catch(() => []),
    leerArchivo(JSON_FILES.sesion).catch(() => null)
  ]);
  await aplicarCacheDesdeDatos(usuarios, cuentas, historial, hormiga, prestamos, sesion);
}

async function cargarDesdeRutaRelativa() {
  const [usuarios, cuentas, historial, hormiga, prestamos, sesion] = await Promise.all([
    fetchJsonRelativo(JSON_FILES.usuarios, []),
    fetchJsonRelativo(JSON_FILES.cuentas, []),
    fetchJsonRelativo(JSON_FILES.historialPagos, []),
    fetchJsonRelativo(JSON_FILES.gastosHormiga, []),
    fetchJsonRelativo(JSON_FILES.prestamos, []),
    fetchJsonRelativo(JSON_FILES.sesion, null)
  ]);
  await aplicarCacheDesdeDatos(usuarios, cuentas, historial, hormiga, prestamos, sesion);
}

async function conectarData(handle) {
  dirHandle = await resolveDataDirectory(handle);
  await guardarCarpeta(dirHandle);
  await cargarTodosLosJSON();
  listo = true;
  modoFetch = false;
  ocultarPanelCarpeta();
  ocultarAvisoSoloLectura();
}

async function intentarConexionGuardada() {
  const guardada = await cargarCarpetaGuardada();
  if (!guardada) return false;

  try {
    const dataDir = await resolveDataDirectory(guardada);
    let perm = await dataDir.queryPermission({ mode: 'readwrite' });
    if (perm === 'prompt') {
      perm = await dataDir.requestPermission({ mode: 'readwrite' });
    }
    if (perm !== 'granted') return false;

    dirHandle = dataDir;
    await guardarCarpeta(dirHandle);
    await cargarTodosLosJSON();
    listo = true;
    modoFetch = false;
    return true;
  } catch {
    return false;
  }
}

async function intentarCargarDesdeRutaRelativa() {
  try {
    await cargarDesdeRutaRelativa();
    listo = true;
    modoFetch = !dirHandle;
    if (modoFetch) mostrarAvisoSoloLectura();
    return true;
  } catch {
    return false;
  }
}

async function asegurarEscritura() {
  if (dirHandle) return true;
  if (await intentarConexionGuardada()) return true;
  return elegirCarpetaData(false);
}

function ocultarPanelCarpeta() {
  document.getElementById('panel-carpeta')?.remove();
}

function mostrarAvisoSoloLectura() {
  if (document.getElementById('aviso-solo-lectura')) return;
  const aviso = document.createElement('div');
  aviso.id = 'aviso-solo-lectura';
  aviso.className = 'aviso-solo-lectura';
  aviso.innerHTML = `
    <p>Datos cargados desde <code>data/</code>. Para guardar cambios en los archivos, conecta la carpeta.</p>
    <button type="button" class="btn btn--primary btn--sm" id="btn-conectar-guardar">Conectar carpeta data</button>
  `;
  document.body.prepend(aviso);
  document.getElementById('btn-conectar-guardar').addEventListener('click', async () => {
    await elegirCarpetaData(false);
    document.dispatchEvent(new Event('storage-ready'));
  });
}

function ocultarAvisoSoloLectura() {
  document.getElementById('aviso-solo-lectura')?.remove();
}

async function guardarEnJSON(tipo) {
  if (modoServidor) {
    await guardarDatosServidor(tipo);
    return;
  }
  await asegurarEscritura();
  if (!dirHandle) return;
  if (tipo === 'usuarios') await escribirArchivo(JSON_FILES.usuarios, cache.usuarios);
  if (tipo === 'cuentas') await escribirArchivo(JSON_FILES.cuentas, cache.cuentas);
  if (tipo === 'historialPagos') {
    await escribirArchivo(JSON_FILES.historialPagos, cache.historialPagos);
  }
  if (tipo === 'gastosHormiga') {
    await escribirArchivo(JSON_FILES.gastosHormiga, cache.gastosHormiga);
  }
  if (tipo === 'prestamos') {
    await escribirArchivo(JSON_FILES.prestamos, cache.prestamos);
  }
  if (tipo === 'sesion') {
    await escribirArchivo(JSON_FILES.sesion, cache.sesion || {});
  }
}

async function elegirCarpetaData(removerPanel = true) {
  if (!supportsFiles()) {
    alert('Tu navegador no permite guardar en archivos. Usa Chrome o Edge actualizado.');
    return false;
  }
  try {
    const picked = await window.showDirectoryPicker({
      id: 'finanzas-root',
      mode: 'readwrite'
    });
    await conectarData(picked);
    if (removerPanel) ocultarPanelCarpeta();
    return true;
  } catch (err) {
    if (err?.name !== 'AbortError') {
      alert('No se encontró la carpeta data. Selecciona la carpeta del proyecto o la carpeta data.');
    }
    return false;
  }
}

async function initStorage() {
  if (listo) return true;

  if (modoServidor) {
    try {
      await cargarDatosServidor();
      listo = true;
      return true;
    } catch (error) {
      console.error('Error cargando Finanzas desde el servidor:', error);
    }
  }

  if (await intentarConexionGuardada()) return true;
  if (await intentarCargarDesdeRutaRelativa()) return true;

  if (!supportsFiles()) {
    mostrarPanelCarpeta(true);
    return false;
  }

  mostrarPanelCarpeta(false);
  return false;
}

function mostrarPanelCarpeta(navegadorViejo) {
  if (document.getElementById('panel-carpeta')) return;

  const panel = document.createElement('div');
  panel.id = 'panel-carpeta';
  panel.className = 'panel-carpeta';
  panel.innerHTML = navegadorViejo
    ? `
    <div class="panel-carpeta__card">
      <header class="panel-carpeta__header">
        <h2>Navegador no compatible</h2>
      </header>
      <div class="panel-carpeta__body">
        <p>Usa Chrome o Edge para guardar en archivos .json</p>
      </div>
    </div>`
    : `
    <div class="panel-carpeta__card">
      <header class="panel-carpeta__header">
        <h2>Conectar datos</h2>
      </header>
      <div class="panel-carpeta__body">
        <p>No se pudo cargar la carpeta <code>data/</code> automáticamente.</p>
        <p>Selecciona la carpeta del proyecto (donde está <code>index.html</code>) o directamente la carpeta <code>data</code>.</p>
      </div>
      <div class="panel-carpeta__actions">
        <button type="button" class="btn btn--primary btn--block" id="btn-elegir-carpeta">Seleccionar carpeta</button>
      </div>
    </div>`;
  document.body.prepend(panel);

  if (!navegadorViejo) {
    document.getElementById('btn-elegir-carpeta').addEventListener('click', async () => {
      const ok = await elegirCarpetaData(true);
      if (ok) document.dispatchEvent(new Event('storage-ready'));
    });
  }
}

function estaListo() {
  return listo;
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/* ---------- Usuarios ---------- */
function getUsuarios() {
  return [...cache.usuarios];
}

async function saveUsuarios(usuarios) {
  cache.usuarios = usuarios;
  await guardarEnJSON('usuarios');
}

function getNextUsuarioId() {
  const usuarios = getUsuarios();
  if (usuarios.length === 0) return 1;
  return Math.max(...usuarios.map((u) => u.id)) + 1;
}

function findUsuarioByNombre(nombre) {
  return getUsuarios().find(
    (u) => u.usuario.toLowerCase() === nombre.toLowerCase()
  );
}

async function createUsuario(usuario, password, numero = '') {
  const usuarios = getUsuarios();
  const nuevo = {
    id: getNextUsuarioId(),
    usuario: usuario.trim(),
    password,
    numero: String(numero || '').trim()
  };
  usuarios.push(nuevo);
  await saveUsuarios(usuarios);
  return nuevo;
}

async function updateUsuario(id, updates) {
  const usuarios = getUsuarios();
  const index = usuarios.findIndex((usuario) => usuario.id === id);
  if (index === -1) return null;
  usuarios[index] = { ...usuarios[index], numero: String(updates.numero || '').trim() };
  await saveUsuarios(usuarios);
  return usuarios[index];
}

/* ---------- Sesión ---------- */
function getSesion() {
  return cache.sesion;
}

async function setSesion(usuario) {
  cache.sesion = {
    id: usuario.id,
    usuario: usuario.usuario,
    numero: usuario.numero || '',
    sueldoIngresado: usuario.sueldoIngresado || 0
  };
  await guardarEnJSON('sesion');
}

async function clearSesion() {
  cache.sesion = null;
  await guardarEnJSON('sesion');
}

function requireAuth() {
  if (!listo) return null;
  const sesion = getSesion();
  if (!sesion) {
    window.location.href = 'index.html';
    return null;
  }
  return sesion;
}

/* ---------- Cuentas ---------- */
function getCuentas() {
  return [...cache.cuentas];
}

async function saveCuentas(cuentas) {
  cache.cuentas = cuentas;
  await guardarEnJSON('cuentas');
}

function getCuentasByUsuario(usuarioId) {
  return getCuentas().filter((c) => c.usuarioId === usuarioId);
}

function getCuentaById(id) {
  return getCuentas().find((c) => c.id === id);
}

async function createCuenta(data) {
  const cuentas = getCuentas();
  const cuenta = {
    id: generateId(),
    usuarioId: data.usuarioId,
    nombre: data.nombre.trim(),
    monto: data.monto ?? 0,
    mesInicio: data.mesInicio ?? null,
    fechaPago: data.fechaPago,
    cantidadMeses: data.cantidadMeses,
    estado: data.estado ?? 'pagando'
  };
  cuentas.push(cuenta);
  await saveCuentas(cuentas);
  return cuenta;
}

async function updateCuenta(id, updates) {
  const cuentas = getCuentas();
  const index = cuentas.findIndex((c) => c.id === id);
  if (index === -1) return null;
  cuentas[index] = { ...cuentas[index], ...updates };
  await saveCuentas(cuentas);
  return cuentas[index];
}

async function deleteCuenta(id) {
  const cuentas = getCuentas().filter((c) => c.id !== id);
  await saveCuentas(cuentas);
  const historial = getHistorialPagos().filter((h) => h.cuentaId !== id);
  await saveHistorialPagos(historial);
}

/* ---------- Historial ---------- */
function getHistorialPagos() {
  return [...cache.historialPagos];
}

async function saveHistorialPagos(historial) {
  cache.historialPagos = historial;
  await guardarEnJSON('historialPagos');
}

function getRegistroPago(cuentaId, mes) {
  return getHistorialPagos().find(
    (h) => h.cuentaId === cuentaId && h.mes === mes
  );
}

function getEstadoMes(cuentaId, mes) {
  const r = getRegistroPago(cuentaId, mes);
  return r && r.estado === 'pagado' ? 'pagado' : 'pendiente';
}

function getPagoMes(cuentaId, mes) {
  const r = getRegistroPago(cuentaId, mes);
  return r && r.estado === 'pagado' ? r : null;
}

async function setEstadoMes(cuentaId, usuarioId, mes, dia, estado) {
  const historial = getHistorialPagos();
  const idx = historial.findIndex(
    (h) => h.cuentaId === cuentaId && h.mes === mes
  );

  if (estado === 'pagado') {
    const registro = {
      id: idx >= 0 ? historial[idx].id : generateId(),
      cuentaId,
      usuarioId,
      mes,
      dia,
      estado: 'pagado'
    };
    if (idx >= 0) historial[idx] = registro;
    else historial.push(registro);
  } else if (idx >= 0) {
    historial.splice(idx, 1);
  }

  await saveHistorialPagos(historial);
  return estado;
}

async function toggleEstadoMes(cuentaId, usuarioId, mes, dia) {
  const actual = getEstadoMes(cuentaId, mes);
  const nuevo = actual === 'pagado' ? 'pendiente' : 'pagado';
  await setEstadoMes(cuentaId, usuarioId, mes, dia, nuevo);
  return nuevo;
}

/* ---------- Gastos hormiga ---------- */
function getGastosHormiga() {
  return [...cache.gastosHormiga];
}

async function saveGastosHormiga(gastos) {
  cache.gastosHormiga = gastos;
  await guardarEnJSON('gastosHormiga');
}

function getHormigaByUsuario(usuarioId) {
  return getGastosHormiga().filter((g) => g.usuarioId === usuarioId);
}

function getHormigaByMes(usuarioId, mes) {
  return getHormigaByUsuario(usuarioId).filter((g) => g.mes === mes);
}

function getGastoHormigaById(id) {
  return getGastosHormiga().find((g) => g.id === id);
}

function mesDesdeFecha(fechaStr) {
  const d = parseFecha(fechaStr);
  return d ? mesAnioFromDate(d) : mesAnioActual();
}

async function createGastoHormiga(data) {
  const gastos = getGastosHormiga();
  const fecha = data.fecha;
  const gasto = {
    id: generateId(),
    usuarioId: data.usuarioId,
    fecha,
    mes: mesDesdeFecha(fecha),
    monto: data.monto ?? 0,
    descripcion: (data.descripcion || '').trim()
  };
  gastos.push(gasto);
  await saveGastosHormiga(gastos);
  return gasto;
}

async function updateGastoHormiga(id, updates) {
  const gastos = getGastosHormiga();
  const index = gastos.findIndex((g) => g.id === id);
  if (index === -1) return null;
  const actualizado = { ...gastos[index], ...updates };
  if (updates.fecha) {
    actualizado.mes = mesDesdeFecha(updates.fecha);
  }
  if (updates.descripcion !== undefined) {
    actualizado.descripcion = updates.descripcion.trim();
  }
  gastos[index] = actualizado;
  await saveGastosHormiga(gastos);
  return actualizado;
}

async function deleteGastoHormiga(id) {
  const gastos = getGastosHormiga().filter((g) => g.id !== id);
  await saveGastosHormiga(gastos);
}

/* ---------- Préstamos ---------- */
function getPrestamos() {
  return [...cache.prestamos];
}

async function savePrestamos(prestamos) {
  cache.prestamos = prestamos;
  await guardarEnJSON('prestamos');
}

function getPrestamosByUsuario(usuarioId) {
  return getPrestamos().filter((p) => p.usuarioId === usuarioId);
}

function getPrestamoById(id) {
  return getPrestamos().find((p) => p.id === id);
}

async function createPrestamo(data) {
  const prestamos = getPrestamos();
  const prestamo = {
    id: generateId(),
    usuarioId: data.usuarioId,
    prestante: data.prestante.trim(),
    monto: data.monto ?? 0,
    intereses: data.intereses ?? 0,
    fechaVencimiento: data.fechaVencimiento,
    cuotas: Math.max(1, parseInt(data.cuotas, 10) || 1),
    cuotasPagadas: data.cuotasPagadas ?? 0
  };
  prestamos.push(prestamo);
  await savePrestamos(prestamos);
  return prestamo;
}

async function updatePrestamo(id, updates) {
  const prestamos = getPrestamos();
  const index = prestamos.findIndex((p) => p.id === id);
  if (index === -1) return null;
  const actualizado = { ...prestamos[index], ...updates };
  if (updates.prestante !== undefined) {
    actualizado.prestante = updates.prestante.trim();
  }
  if (updates.cuotas !== undefined) {
    actualizado.cuotas = Math.max(1, parseInt(updates.cuotas, 10) || 1);
  }
  if (updates.cuotasPagadas !== undefined) {
    actualizado.cuotasPagadas = Math.max(
      0,
      Math.min(actualizado.cuotas, parseInt(updates.cuotasPagadas, 10) || 0)
    );
  }
  prestamos[index] = actualizado;
  await savePrestamos(prestamos);
  return actualizado;
}

async function deletePrestamo(id) {
  const prestamos = getPrestamos().filter((p) => p.id !== id);
  await savePrestamos(prestamos);
}

document.addEventListener('DOMContentLoaded', async () => {
  const ok = await initStorage();
  if (ok) {
    document.dispatchEvent(new Event('storage-ready'));
  }
});
