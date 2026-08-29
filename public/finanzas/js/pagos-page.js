/**
 * Pagos mensuales — todas las cuentas a la vez, tablas horizontales
 */
document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const panel = document.getElementById('panel-pagos');
  const emptyState = document.getElementById('empty-pagos');
  const contenedor = document.getElementById('lista-pagos');
  const inputDesde = document.getElementById('rango-desde');
  const inputHasta = document.getElementById('rango-hasta');
  const btnRangoDefecto = document.getElementById('btn-rango-defecto');
  const btnLogout = document.getElementById('btn-logout');
  const userLabel = document.getElementById('user-label');
  const resumenBox = document.getElementById('pagos-resumen-mes');
  const resumenTotal = document.getElementById('resumen-mes-total');
  const resumenDetalle = document.getElementById('resumen-mes-detalle');
  const resumenMesNombre = document.getElementById('resumen-mes-nombre');

  let rangoDesde = null;
  let rangoHasta = null;

  userLabel.textContent = sesion.usuario;

  btnLogout?.addEventListener('click', async () => {
    await clearSesion();
    window.location.href = 'index.html';
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function aplicarRangoPorDefecto() {
    const { desde, hasta } = getRangoMesesPorDefecto();
    rangoDesde = desde;
    rangoHasta = hasta;
    inputDesde.value = mesAnioAInput(desde);
    inputHasta.value = mesAnioAInput(hasta);
  }

  function leerRangoDesdeInputs() {
    const desde = inputAMesAnio(inputDesde.value);
    const hasta = inputAMesAnio(inputHasta.value);
    if (!desde || !hasta) return false;
    if (parseMesAnio(desde) > parseMesAnio(hasta)) {
      alert('El mes «Desde» no puede ser posterior al mes «Hasta».');
      return false;
    }
    rangoDesde = desde;
    rangoHasta = hasta;
    return true;
  }

  function claseEstado(cuentaId, mes) {
    const estado = getEstadoMes(cuentaId, mes);
    if (estado === 'pagado') return 'pagado';
    if (esMesPasado(mes)) return 'vencido';
    return 'pendiente';
  }

  function etiquetaEstado(clase) {
    if (clase === 'pagado') return 'Pagado';
    if (clase === 'vencido') return 'Vencido';
    return 'Pendiente';
  }

  function htmlTablaCuenta(cuenta) {
    if (!rangoDesde || !rangoHasta) return '';

    const meses = mesesVisiblesEnRango(cuenta, rangoDesde, rangoHasta);
    const montoValor = formatMonto(cuenta.monto);
    const diaValor =
      cuenta.cantidadMeses === 1
        ? formatFecha(cuenta.fechaPago)
        : String(getDiaPago(cuenta));
    const filaDia =
      cuenta.cantidadMeses === 1 ? 'Fecha' : 'Día';

    if (meses.length === 0) {
      return `
        <article class="pagos-bloque" data-cuenta-id="${cuenta.id}">
          <header class="pagos-bloque__head">
            <h2>${escapeHtml(cuenta.nombre)}</h2>
            <span>${montoValor} · Sin meses en el rango</span>
          </header>
        </article>
      `;
    }

    const encabezados = meses
      .map(({ mes }) => {
        const actual = esMesActual(mes) ? ' col-mes-actual' : '';
        return `<th class="col-mes${actual}" title="${formatMesLabel(mes)}">${formatMesCorto(mes)}${actual ? ' ●' : ''}</th>`;
      })
      .join('');

    const filaMonto = meses
      .map(({ mes, activo }) => {
        const c = (esMesActual(mes) ? ' col-mes-actual' : '') + (activo ? '' : ' celda-inactiva');
        return `<td class="celda-monto${c}">${activo ? montoValor : '—'}</td>`;
      })
      .join('');

    const filaDiaCells = meses
      .map(({ mes, activo }) => {
        const c = (esMesActual(mes) ? ' col-mes-actual' : '') + (activo ? '' : ' celda-inactiva');
        return `<td class="${c.trim()}">${activo ? diaValor : '—'}</td>`;
      })
      .join('');

    const filaEstado = meses
      .map(({ mes, activo }) => {
        const actual = esMesActual(mes) ? ' col-mes-actual' : '';
        if (!activo) {
          return `<td class="celda-estado celda-inactiva${actual}"><span class="estado-btn estado-btn--inactivo">—</span></td>`;
        }
        const clase = claseEstado(cuenta.id, mes);
        return `
          <td class="celda-estado${actual}" data-cuenta="${cuenta.id}" data-mes="${mes}" data-dia="${diaValor}">
            <button type="button" class="estado-btn estado-btn--${clase}" data-toggle>${etiquetaEstado(clase)}</button>
          </td>
        `;
      })
      .join('');

    return `
      <article class="pagos-bloque" data-cuenta-id="${cuenta.id}">
        <header class="pagos-bloque__head">
          <h2>${escapeHtml(cuenta.nombre)}</h2>
          <span>${montoValor} · ${formatFechaPago(cuenta)}</span>
        </header>
        <div class="tabla-scroll">
          <table class="pagos-tabla pagos-tabla--horizontal pagos-tabla--compacta">
            <thead><tr><th class="th-fijo"></th>${encabezados}</tr></thead>
            <tbody>
              <tr><th class="th-fijo">$</th>${filaMonto}</tr>
              <tr><th class="th-fijo">${filaDia}</th>${filaDiaCells}</tr>
              <tr><th class="th-fijo">Est.</th>${filaEstado}</tr>
            </tbody>
          </table>
        </div>
      </article>
    `;
  }

  contenedor?.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-toggle]');
    if (!btn) return;

    const td = btn.closest('[data-mes]');
    await toggleEstadoMes(
      td.dataset.cuenta,
      sesion.id,
      td.dataset.mes,
      td.dataset.dia
    );
    const c = getCuentaById(td.dataset.cuenta);
    if (c) await verificarCompletado(c);
    document.dispatchEvent(new Event('datos-actualizados'));
    renderTablas();
  });

  function renderResumenMes() {
    const mes = mesAnioActual();
    const total = totalGastadoEnMes(sesion.id, mes);
    const cantidad = contarPagosMes(sesion.id, mes);

    resumenMesNombre.textContent = formatMesLabel(mes);
    resumenTotal.textContent = formatMonto(total);
    resumenDetalle.textContent =
      cantidad === 0
        ? 'Ningún pago marcado como pagado este mes'
        : `${cantidad} pago${cantidad !== 1 ? 's' : ''} marcado${cantidad !== 1 ? 's' : ''} como pagado`;
    resumenBox.hidden = false;
  }

  function renderTablas() {
    if (!leerRangoDesdeInputs()) return;

    const cuentas = getCuentasByUsuario(sesion.id).filter(
      (c) => c.estado === 'pagando'
    );

    contenedor.innerHTML = cuentas.map((c) => htmlTablaCuenta(c)).join('');

    const hasItems = cuentas.length > 0;
    emptyState.hidden = hasItems;
    panel.hidden = !hasItems;
    renderResumenMes();
  }

  function initPagina() {
    aplicarRangoPorDefecto();
    renderResumenMes();
    renderTablas();
  }

  inputDesde?.addEventListener('change', renderTablas);
  inputHasta?.addEventListener('change', renderTablas);
  btnRangoDefecto?.addEventListener('click', () => {
    aplicarRangoPorDefecto();
    renderTablas();
  });

  initPagina();
});
