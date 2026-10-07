/**
 * Utilidades de fechas y tipos de cuenta
 */

const TIPOS_CUENTA = {
  PERMANENTE: 'permanente',
  UNICO: 'unico',
  LIMITADA: 'limitada'
};

function tipoFromCantidadMeses(cantidadMeses) {
  if (cantidadMeses === 0) return TIPOS_CUENTA.PERMANENTE;
  if (cantidadMeses === 1) return TIPOS_CUENTA.UNICO;
  return TIPOS_CUENTA.LIMITADA;
}

function cantidadMesesFromTipo(tipo, mesesInput) {
  if (tipo === TIPOS_CUENTA.PERMANENTE) return 0;
  if (tipo === TIPOS_CUENTA.UNICO) return 1;
  return Math.max(2, parseInt(mesesInput, 10) || 2);
}

function etiquetaTipo(cantidadMeses) {
  const t = tipoFromCantidadMeses(cantidadMeses);
  if (t === TIPOS_CUENTA.PERMANENTE) return 'Permanente';
  if (t === TIPOS_CUENTA.UNICO) return 'Único coste';
  return `Mensual (${cantidadMeses} meses)`;
}

function esPagoSoloDia(cantidadMeses) {
  return cantidadMeses === 0 || cantidadMeses >= 2;
}

function parseFecha(str) {
  if (!str) return null;
  if (/^\d{1,2}$/.test(String(str).trim())) return null;
  const d = new Date(str + 'T12:00:00');
  return isNaN(d.getTime()) ? null : d;
}

function getDiaPago(cuenta) {
  if (esPagoSoloDia(cuenta.cantidadMeses)) {
    if (/^\d{1,2}$/.test(String(cuenta.fechaPago).trim())) {
      return parseInt(cuenta.fechaPago, 10);
    }
    const d = parseFecha(cuenta.fechaPago);
    return d ? d.getDate() : 1;
  }
  const d = parseFecha(cuenta.fechaPago);
  return d ? d.getDate() : null;
}

function formatFecha(str) {
  const d = parseFecha(str);
  if (!d) return str;
  return d.toLocaleDateString('es-ES', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatFechaPago(cuenta) {
  if (esPagoSoloDia(cuenta.cantidadMeses)) {
    return `Día ${getDiaPago(cuenta)} de cada mes`;
  }
  return formatFecha(cuenta.fechaPago);
}

function getMesInicioCuenta(cuenta) {
  if (!cuenta) return mesAnioActual();
  if (cuenta.mesInicio) return cuenta.mesInicio;
  if (cuenta.cantidadMeses === 1) {
    const d = parseFecha(cuenta.fechaPago);
    return d ? mesAnioFromDate(d) : mesAnioActual();
  }
  const d = parseFecha(cuenta.fechaPago);
  if (d) return mesAnioFromDate(d);
  return mesAnioActual();
}

function resolverMesInicio(cantidadMeses, mesInput, fechaCompleta, cuentaExistente) {
  if (cantidadMeses === 1) {
    const d = parseFecha(fechaCompleta);
    return d ? mesAnioFromDate(d) : mesAnioActual();
  }
  return mesInput || getMesInicioCuenta(cuentaExistente) || mesAnioActual();
}

function buildFechaPago(cantidadMeses, diaValor, fechaCompleta, mesInicioValor, cuentaExistente) {
  if (esPagoSoloDia(cantidadMeses)) {
    const dia = Math.min(31, Math.max(1, parseInt(diaValor, 10) || 1));
    if (cantidadMeses === 0) return String(dia);
    const mesIni = mesInicioValor || getMesInicioCuenta(cuentaExistente);
    const [m, y] = mesIni.split('-');
    const dd = String(dia).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
  return fechaCompleta;
}

function mesAnioFromDate(date) {
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const y = date.getFullYear();
  return `${m}-${y}`;
}

function mesAnioActual() {
  return mesAnioFromDate(new Date());
}

function formatMesLabel(mesAnio) {
  const d = parseMesAnio(mesAnio);
  return d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
}

function mesesOrdenadosParaTabla(cuenta) {
  return [...mesesActivosCuenta(cuenta)].sort((a, b) => {
    const da = parseMesAnio(a);
    const db = parseMesAnio(b);
    return db - da;
  });
}

/** Meses de izquierda a derecha (más antiguo → más reciente) */
function mesesOrdenadosHorizontal(cuenta) {
  return [...mesesActivosCuenta(cuenta)].sort(
    (a, b) => parseMesAnio(a) - parseMesAnio(b)
  );
}

function formatMesCorto(mesAnio) {
  const d = parseMesAnio(mesAnio);
  const mes = d.toLocaleDateString('es-ES', { month: 'short' });
  const y = String(d.getFullYear()).slice(-2);
  return `${mes} ${y}`;
}

/** Rango por defecto: 2 meses antes del próximo trimestre + ese trimestre (ej. en junio: may–sep) */
function getRangoMesesPorDefecto() {
  const hoy = new Date();
  const mes = hoy.getMonth();
  const año = hoy.getFullYear();

  let triSig = Math.floor(mes / 3) + 1;
  let añoTri = año;
  if (triSig > 3) {
    triSig = 0;
    añoTri = año + 1;
  }

  const mesInicioTri = triSig * 3;
  let mesDesde = mesInicioTri - 2;
  let añoDesde = añoTri;
  while (mesDesde < 0) {
    mesDesde += 12;
    añoDesde -= 1;
  }

  const mesHasta = mesInicioTri + 2;

  return {
    desde: `${String(mesDesde + 1).padStart(2, '0')}-${añoDesde}`,
    hasta: `${String(mesHasta + 1).padStart(2, '0')}-${añoTri}`
  };
}

function mesAnioAInput(mesAnio) {
  const [m, y] = mesAnio.split('-');
  return `${y}-${m}`;
}

function inputAMesAnio(valorInput) {
  if (!valorInput) return null;
  const [y, m] = valorInput.split('-');
  return `${m}-${y}`;
}

function mesesEntreRango(desde, hasta) {
  const inicio = parseMesAnio(desde);
  const fin = parseMesAnio(hasta);
  if (!inicio || !fin || inicio > fin) return [];
  return mesesEntre(inicio, fin);
}

function mesesVisiblesEnRango(cuenta, desde, hasta) {
  const enRango = mesesEntreRango(desde, hasta);
  const activos = new Set(mesesActivosCuenta(cuenta));
  return enRango.map((mes) => ({
    mes,
    activo: activos.has(mes)
  }));
}

function esMesPasado(mesAnio) {
  const actual = parseMesAnio(mesAnioActual());
  const m = parseMesAnio(mesAnio);
  return m < actual;
}

function esMesActual(mesAnio) {
  return mesAnio === mesAnioActual();
}

function parseMesAnio(mesAnio) {
  const [m, y] = mesAnio.split('-').map(Number);
  return new Date(y, m - 1, 1);
}

function addMeses(fecha, n) {
  const d = new Date(fecha);
  d.setMonth(d.getMonth() + n);
  return d;
}

function mesesEntre(inicio, fin) {
  const meses = [];
  let cur = new Date(inicio.getFullYear(), inicio.getMonth(), 1);
  const end = new Date(fin.getFullYear(), fin.getMonth(), 1);
  while (cur <= end) {
    meses.push(mesAnioFromDate(cur));
    cur = addMeses(cur, 1);
  }
  return meses;
}

/**
 * Meses en los que la cuenta está activa para pago
 */
function mesesActivosCuenta(cuenta) {
  const ahora = new Date();
  const inicioMes = parseMesAnio(getMesInicioCuenta(cuenta));
  if (!inicioMes) return [];

  if (cuenta.cantidadMeses === 0) {
    const limite = addMeses(ahora, 24);
    if (inicioMes > limite) return [];
    return mesesEntre(inicioMes, limite);
  }

  if (cuenta.cantidadMeses === 1) {
    return [getMesInicioCuenta(cuenta)];
  }

  const fin = addMeses(inicioMes, cuenta.cantidadMeses - 1);
  return mesesEntre(inicioMes, fin);
}

function cuentaActivaEnMes(cuenta, mesAnio) {
  if (cuenta.estado !== 'pagando') return false;
  return mesesActivosCuenta(cuenta).includes(mesAnio);
}

function contarPagosCuenta(cuentaId) {
  return getHistorialPagos().filter(
    (h) => h.cuentaId === cuentaId && h.estado === 'pagado'
  ).length;
}

function verificarCompletado(cuenta) {
  if (cuenta.cantidadMeses === 0) return cuenta;
  const pagos = contarPagosCuenta(cuenta.id);
  if (pagos >= cuenta.cantidadMeses && cuenta.estado === 'pagando') {
    return updateCuenta(cuenta.id, { estado: 'completado' });
  }
  return cuenta;
}

function estadoBadge(estado) {
  const map = {
    pagando: 'badge--pagando',
    completado: 'badge--completado',
    cancelado: 'badge--cancelado'
  };
  return map[estado] || 'badge--pagando';
}

function capitalizar(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function formatMonto(monto) {
  const n = Number(monto);
  if (monto == null || monto === '' || Number.isNaN(n)) return '—';
  return new Intl.NumberFormat('es-ES', {
    style: 'currency',
    currency: 'EUR'
  }).format(n);
}

function parseMontoInput(valor) {
  const n = parseFloat(String(valor).replace(',', '.'));
  return Number.isNaN(n) || n < 0 ? 0 : Math.round(n * 100) / 100;
}

function hoyMediodia() {
  const h = new Date();
  h.setHours(12, 0, 0, 0);
  return h;
}

function diasHastaFecha(fecha) {
  if (!fecha) return null;
  return Math.ceil((fecha - hoyMediodia()) / 86400000);
}

/** Próxima fecha límite de pago (o la de este mes si aún aplica) */
function getFechaLimiteReferencia(cuenta) {
  if (cuenta.estado !== 'pagando') return null;

  if (cuenta.cantidadMeses === 1) {
    return parseFecha(cuenta.fechaPago);
  }

  const dia = getDiaPago(cuenta);
  const hoy = hoyMediodia();
  let fecha = new Date(hoy.getFullYear(), hoy.getMonth(), dia);

  const mesRef = mesAnioFromDate(fecha);
  if (!cuentaActivaEnMes(cuenta, mesRef)) {
    const ordenados = mesesOrdenadosHorizontal(cuenta);
    const actual = parseMesAnio(mesAnioActual());
    for (const m of ordenados) {
      const ms = parseMesAnio(m);
      if (ms >= actual) {
        fecha = new Date(ms.getFullYear(), ms.getMonth(), dia);
        break;
      }
    }
  }

  return fecha;
}

function obtenerAlertasProximoPago(usuarioId) {
  return getCuentasByUsuario(usuarioId)
    .filter((c) => c.estado === 'pagando')
    .map((cuenta) => {
      const fecha = getFechaLimiteReferencia(cuenta);
      if (!fecha) return null;
      const mes = mesAnioFromDate(fecha);
      if (getEstadoMes(cuenta.id, mes) === 'pagado') return null;
      const dias = diasHastaFecha(fecha);
      if (dias === null || dias > 7 || dias < -7) return null;
      return { cuenta, fecha, dias, mes };
    })
    .filter(Boolean)
    .sort((a, b) => a.dias - b.dias);
}

function textoAlertaDias(dias) {
  if (dias === 0) return 'vence hoy';
  if (dias === 1) return 'vence mañana';
  if (dias > 1) return `vence en ${dias} días`;
  if (dias === -1) return 'venció ayer';
  return `venció hace ${Math.abs(dias)} días`;
}

/** Suma montos de cuentas marcadas pagadas en un mes */
function totalGastadoEnMes(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  const cuentasPorId = new Map(
    getCuentasByUsuario(usuarioId).map((c) => [c.id, c])
  );
  return getHistorialPagos()
    .filter(
      (h) =>
        h.usuarioId === usuarioId &&
        h.mes === mes &&
        h.estado === 'pagado'
    )
    .reduce((suma, h) => {
      const cuenta = cuentasPorId.get(h.cuentaId);
      return suma + (cuenta ? Number(cuenta.monto) || 0 : 0);
    }, 0);
}

function contarPagosMes(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  return getHistorialPagos().filter(
    (h) =>
      h.usuarioId === usuarioId &&
      h.mes === mes &&
      h.estado === 'pagado'
  ).length;
}

function totalHormigaEnMes(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  return getHormigaByMes(usuarioId, mes)
    .reduce((suma, g) => suma + (Number(g.monto) || 0), 0);
}

function contarHormigaMes(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  return getHormigaByMes(usuarioId, mes).length;
}

function gastosGeneralesByMes(usuarioId, mesAnio) {
  return getGastosByMes(usuarioId, mesAnio).sort((a, b) => (parseFecha(b.fecha) || 0) - (parseFecha(a.fecha) || 0));
}

function totalGastosGeneralesEnMes(usuarioId, mesAnio) {
  return gastosGeneralesByMes(usuarioId, mesAnio).reduce((suma, gasto) => suma + (Number(gasto.monto) || 0), 0);
}

function detallePagosMes(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  const cuentasPorId = new Map(
    getCuentasByUsuario(usuarioId).map((c) => [c.id, c])
  );
  return getHistorialPagos()
    .filter(
      (h) =>
        h.usuarioId === usuarioId &&
        h.mes === mes &&
        h.estado === 'pagado'
    )
    .map((h) => {
      const cuenta = cuentasPorId.get(h.cuentaId);
      return {
        nombre: cuenta ? cuenta.nombre : 'Cuenta eliminada',
        monto: cuenta ? Number(cuenta.monto) || 0 : 0
      };
    });
}

function resumenMensual(usuarioId, mesAnio) {
  const mes = mesAnio || mesAnioActual();
  const cuentasPagadas = totalGastadoEnMes(usuarioId, mes);
  const gastosHormiga = totalHormigaEnMes(usuarioId, mes);
  const comprasGastos = totalGastosGeneralesEnMes(usuarioId, mes);
  return {
    mes,
    cuentasPagadas,
    gastosHormiga,
    comprasGastos,
    total: cuentasPagadas + gastosHormiga + comprasGastos,
    cantidadPagos: contarPagosMes(usuarioId, mes),
    cantidadHormiga: contarHormigaMes(usuarioId, mes),
    cantidadComprasGastos: gastosGeneralesByMes(usuarioId, mes).length,
    detallePagos: detallePagosMes(usuarioId, mes),
    detalleHormiga: getHormigaByMes(usuarioId, mes).sort(
      (a, b) => (parseFecha(b.fecha) || 0) - (parseFecha(a.fecha) || 0)
    ),
    detalleComprasGastos: gastosGeneralesByMes(usuarioId, mes)
  };
}

function fechaHoyInput() {
  const h = new Date();
  const y = h.getFullYear();
  const m = String(h.getMonth() + 1).padStart(2, '0');
  const d = String(h.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatFechaCorta(str) {
  const d = parseFecha(str);
  if (!d) return str;
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

/* ---------- Préstamos ---------- */
function interesMontoPrestamo(prestamo) {
  const m = Number(prestamo.monto) || 0;
  const pct = Number(prestamo.intereses) || 0;
  return Math.round(m * (pct / 100) * 100) / 100;
}

function totalPrestamoConInteres(prestamo) {
  const m = Number(prestamo.monto) || 0;
  return Math.round((m + interesMontoPrestamo(prestamo)) * 100) / 100;
}

function valorCuotaPrestamo(prestamo) {
  const cuotas = Math.max(1, parseInt(prestamo.cuotas, 10) || 1);
  return Math.round((totalPrestamoConInteres(prestamo) / cuotas) * 100) / 100;
}

function getEstadoPrestamo(prestamo) {
  if (montoPendientePrestamo(prestamo) <= 0) return 'completado';
  const venc = parseFecha(prestamo.fechaVencimiento);
  if (venc && venc < hoyMediodia()) return 'vencido';
  return 'activo';
}

function badgePrestamo(estado) {
  const map = {
    activo: 'badge--pagando',
    completado: 'badge--completado',
    vencido: 'badge--cancelado'
  };
  return map[estado] || 'badge--pagando';
}

function etiquetaEstadoPrestamo(estado) {
  const map = { activo: 'Activo', completado: 'Completado', vencido: 'Vencido' };
  return map[estado] || estado;
}

function montoPendientePrestamo(prestamo) {
  const total = totalPrestamoConInteres(prestamo);
  const cuotas = Math.max(1, prestamo.cuotas ?? 1);
  const pagadas = prestamo.cuotasPagadas ?? 0;
  const cuotasAbonadas = valorCuotaPrestamo(prestamo) * Math.min(cuotas, pagadas);
  const abonos = (Array.isArray(prestamo.abonos) ? prestamo.abonos : []).reduce((suma, abono) => suma + (Number(abono.monto) || 0), 0);
  const pendiente = total - cuotasAbonadas - abonos;
  return Math.round(Math.max(0, pendiente) * 100) / 100;
}

function resumenPrestamos(usuarioId) {
  const prestamos = getPrestamosByUsuario(usuarioId);
  let capital = 0;
  let totalInteres = 0;
  let pendiente = 0;
  let activos = 0;

  prestamos.forEach((p) => {
    capital += Number(p.monto) || 0;
    totalInteres += totalPrestamoConInteres(p);
    pendiente += montoPendientePrestamo(p);
    if (getEstadoPrestamo(p) !== 'completado') activos += 1;
  });

  return {
    cantidad: prestamos.length,
    activos,
    capital: Math.round(capital * 100) / 100,
    totalConInteres: Math.round(totalInteres * 100) / 100,
    pendiente: Math.round(pendiente * 100) / 100
  };
}

const LIMITE_TOTAL_MES = 2000000;

/** Escala de color: verde oscuro (bajo) → rojo (sueldo ingresado) → exceso */
function escalaColorTotalMes(total, sueldoIngresado = LIMITE_TOTAL_MES) {
  const monto = Math.max(0, Number(total) || 0);
  const limite = Math.max(1, Number(sueldoIngresado) || LIMITE_TOTAL_MES);
  const exceso = monto > limite;
  const t = Math.min(monto / limite, 1);

  if (exceso) {
    return {
      color: '#f87171',
      fondo: 'rgba(127, 29, 29, 0.35)',
      borde: 'rgba(239, 68, 68, 0.65)',
      exceso: true,
      etiqueta: `Exceso (+${formatMonto(monto - limite)} sobre el sueldo)`
    };
  }

  const hue = Math.round(142 * (1 - t));
  const sat = Math.round(55 + 30 * t);
  const light = Math.round(28 + 20 * t);
  const color = `hsl(${hue}, ${sat}%, ${light}%)`;
  const fondo = `hsla(${hue}, ${sat}%, ${light}%, 0.12)`;
  const borde = `hsla(${hue}, ${sat}%, ${light}%, 0.45)`;

  return { color, fondo, borde, exceso: false, etiqueta: null };
}
