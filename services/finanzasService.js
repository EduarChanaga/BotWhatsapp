const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, '..', 'data', 'finanzas');
const gastosPath = path.join(dataDir, 'gastosHormiga.json');
const usuariosPath = path.join(dataDir, 'usuarios.json');
const cuentasPath = path.join(dataDir, 'cuentas.json');
const pagosPath = path.join(dataDir, 'historialPagos.json');
const prestamosPath = path.join(dataDir, 'prestamos.json');

function readJson(filePath, fallback = []) {
  try {
    const value = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return value ?? fallback;
  } catch (error) {
    console.error(`Error leyendo ${filePath}:`, error.message);
    return fallback;
  }
}

function writeJson(filePath, value) {
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

function formatDate(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatMonth(date = new Date()) {
  return `${String(date.getMonth() + 1).padStart(2, '0')}-${date.getFullYear()}`;
}

function normalizeWhatsappNumber(value) {
  return String(value || '').split(':')[0].replace(/\D/g, '');
}

function getFinanzasData() {
  return {
    usuarios: readJson(usuariosPath),
    cuentas: readJson(cuentasPath),
    pagos: readJson(pagosPath),
    gastos: readJson(gastosPath),
    prestamos: readJson(prestamosPath)
  };
}

function resolveFinanceUser(whatsappId, usuarios) {
  const numero = normalizeWhatsappNumber(whatsappId);
  return usuarios.find((item) => normalizeWhatsappNumber(item.numero) === numero) || null;
}

function registerFinanceUser(whatsappId, username, password) {
  const data = getFinanzasData();
  const usuario = String(username || '').trim();
  const clave = String(password || '').trim();
  const numero = normalizeWhatsappNumber(whatsappId);
  if (!usuario || !clave || !numero) return { error: 'formato' };
  if (data.usuarios.some((item) => String(item.usuario || '').toLowerCase() === usuario.toLowerCase())) {
    return { error: 'usuario_existente' };
  }
  if (data.usuarios.some((item) => normalizeWhatsappNumber(item.numero) === numero)) {
    return { error: 'numero_vinculado' };
  }
  const nuevo = { id: data.usuarios.length ? Math.max(...data.usuarios.map((item) => Number(item.id) || 0)) + 1 : 1, usuario, password: clave, numero };
  data.usuarios.push(nuevo);
  writeJson(usuariosPath, data.usuarios);
  return { usuario: nuevo };
}

function loginFinanceUser(whatsappId, username, password) {
  const data = getFinanzasData();
  const usuario = data.usuarios.find((item) => String(item.usuario || '').toLowerCase() === String(username || '').trim().toLowerCase());
  if (!usuario || String(usuario.password) !== String(password || '').trim()) return { error: 'credenciales' };
  const numero = normalizeWhatsappNumber(whatsappId);
  const vinculado = data.usuarios.find((item) => item.id !== usuario.id && normalizeWhatsappNumber(item.numero) === numero);
  if (vinculado) return { error: 'numero_vinculado' };
  usuario.numero = numero;
  writeJson(usuariosPath, data.usuarios);
  return { usuario };
}

function parseCommand(text) {
  const match = String(text || '').trim().match(/^#gastohormiga\s+(\d+(?:[.,]\d{1,2})?)\s+["“](.+?)["”]$/i);
  if (match) return { monto: Number(match[1].replace(',', '.')), descripcion: match[2].trim() };

  const fallback = String(text || '').trim().match(/^#gastohormiga\s+(\d+(?:[.,]\d{1,2})?)\s+(.+)$/i);
  if (!fallback) return null;
  return { monto: Number(fallback[1].replace(',', '.')), descripcion: fallback[2].trim().replace(/^['"]|['"]$/g, '') };
}

function addGastoHormiga(whatsappId, text) {
  const parsed = parseCommand(text);
  if (!parsed || !Number.isFinite(parsed.monto) || parsed.monto <= 0 || !parsed.descripcion) {
    return { error: 'formato' };
  }

  const usuarios = readJson(usuariosPath);
  const usuario = resolveFinanceUser(whatsappId, usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };

  const ahora = new Date();
  const gastos = readJson(gastosPath);
  const gasto = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    usuarioId: usuario.id,
    fecha: formatDate(ahora),
    mes: formatMonth(ahora),
    monto: Math.round(parsed.monto * 100) / 100,
    descripcion: parsed.descripcion
  };
  gastos.push(gasto);
  writeJson(gastosPath, gastos);
  return { gasto };
}

function normalizeMonth(value) {
  const raw = String(value || '').trim();
  if (/^\d{4}-\d{2}$/.test(raw)) return `${raw.slice(5)}-${raw.slice(0, 4)}`;
  if (/^\d{2}-\d{4}$/.test(raw)) return raw;
  return formatMonth(new Date());
}

function markAccountPaid(whatsappId, accountName, monthValue) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  const query = String(accountName || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  const cuenta = data.cuentas.find((item) => item.usuarioId === usuario.id && item.nombre.toLowerCase() === query)
    || data.cuentas.find((item) => item.usuarioId === usuario.id && item.nombre.toLowerCase().includes(query));
  if (!cuenta) return { error: 'cuenta_no_encontrada' };

  const mes = normalizeMonth(monthValue);
  const existing = data.pagos.find((pago) => pago.cuentaId === cuenta.id && pago.mes === mes);
  if (!existing) {
    const [month, year] = mes.split('-');
    data.pagos.push({
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      cuentaId: cuenta.id,
      usuarioId: usuario.id,
      mes,
      dia: new Date().getDate(),
      estado: 'pagado'
    });
    writeJson(pagosPath, data.pagos);
  }
  return { cuenta, mes, repetido: Boolean(existing) };
}

function updateFinanceSalary(whatsappId, salary) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  usuario.sueldoIngresado = Math.round(Number(salary));
  writeJson(usuariosPath, data.usuarios);
  return { usuario };
}

function findFinanceLoan(data, usuarioId, name) {
  const query = String(name || '').trim().replace(/^['"]|['"]$/g, '').toLowerCase();
  return data.prestamos.find((loan) => loan.usuarioId === usuarioId && loan.prestante.toLowerCase() === query)
    || data.prestamos.find((loan) => loan.usuarioId === usuarioId && loan.prestante.toLowerCase().includes(query));
}

function createFinanceLoan(whatsappId, loanData) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  const prestante = String(loanData.prestante || '').trim().replace(/^['"]|['"]$/g, '');
  const monto = Number(loanData.monto);
  const cuotas = Math.max(1, Number.parseInt(loanData.cuotas, 10) || 1);
  const intereses = Math.max(0, Number(loanData.intereses) || 0);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  if (!prestante || !Number.isFinite(monto) || monto <= 0 || !loanData.fechaVencimiento) return { error: 'formato' };
  const prestamo = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`, usuarioId: usuario.id, prestante, monto, intereses, fechaVencimiento: loanData.fechaVencimiento, cuotas, cuotasPagadas: 0 };
  data.prestamos.push(prestamo);
  writeJson(prestamosPath, data.prestamos);
  return { prestamo };
}

function addFinanceLoanPayment(whatsappId, name) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  const prestamo = findFinanceLoan(data, usuario.id, name);
  if (!prestamo) return { error: 'prestamo_no_encontrado' };
  if (prestamo.cuotasPagadas >= prestamo.cuotas) return { error: 'completado', prestamo };
  prestamo.cuotasPagadas += 1;
  writeJson(prestamosPath, data.prestamos);
  return { prestamo };
}

function updateFinanceLoan(whatsappId, name, field, value) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  const prestamo = findFinanceLoan(data, usuario.id, name);
  if (!prestamo) return { error: 'prestamo_no_encontrado' };
  const fields = { nombre: 'prestante', monto: 'monto', intereses: 'intereses', vencimiento: 'fechaVencimiento', cuotas: 'cuotas', pagadas: 'cuotasPagadas' };
  const target = fields[String(field || '').toLowerCase()];
  if (!target || value === undefined || value === '') return { error: 'formato' };
  if (target === 'prestante') prestamo[target] = String(value).replace(/^['"]|['"]$/g, '').trim();
  else if (target === 'monto' || target === 'intereses') prestamo[target] = Math.max(0, Number(value));
  else if (target === 'cuotas' || target === 'cuotasPagadas') prestamo[target] = Math.max(0, Number.parseInt(value, 10));
  else prestamo[target] = value;
  if (!prestamo.prestante || !Number.isFinite(prestamo.monto) || prestamo.monto <= 0 || prestamo.cuotas < 1 || prestamo.cuotasPagadas > prestamo.cuotas) return { error: 'valor_invalido' };
  writeJson(prestamosPath, data.prestamos);
  return { prestamo };
}

function deleteFinanceLoan(whatsappId, name) {
  const data = getFinanzasData();
  const usuario = resolveFinanceUser(whatsappId, data.usuarios);
  if (!usuario) return { error: 'usuario_no_encontrado' };
  const prestamo = findFinanceLoan(data, usuario.id, name);
  if (!prestamo) return { error: 'prestamo_no_encontrado' };
  data.prestamos = data.prestamos.filter((loan) => loan.id !== prestamo.id);
  writeJson(prestamosPath, data.prestamos);
  return { prestamo };
}

module.exports = { addGastoHormiga, dataDir, normalizeWhatsappNumber, getFinanzasData, resolveFinanceUser, registerFinanceUser, loginFinanceUser, normalizeMonth, markAccountPaid, updateFinanceSalary, createFinanceLoan, addFinanceLoanPayment, updateFinanceLoan, deleteFinanceLoan };
