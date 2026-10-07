/**
 * Resumen mensual — cuentas pagadas + gastos hormiga
 * + bloque general de préstamos (no mensual)
 */
document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const inputMes = document.getElementById('resumen-mes');
  const elCuentas = document.getElementById('resumen-cuentas');
  const elCuentasDet = document.getElementById('resumen-cuentas-det');
  const elHormiga = document.getElementById('resumen-hormiga');
  const elHormigaDet = document.getElementById('resumen-hormiga-det');
  const elGastos = document.getElementById('resumen-gastos');
  const elGastosDet = document.getElementById('resumen-gastos-det');
  const elTotal = document.getElementById('resumen-total');
  const elMesLabel = document.getElementById('resumen-mes-label');
  const cardTotal = document.querySelector('.resumen-card--total');
  const inputSueldo = document.getElementById('sueldo-ingresado');
  const btnGuardarSueldo = document.getElementById('btn-guardar-sueldo');
  const listaPagos = document.getElementById('detalle-pagos');
  const listaHormiga = document.getElementById('detalle-hormiga');
  const listaGastos = document.getElementById('detalle-gastos');
  const listaPersonas = document.getElementById('resumen-personas-lista');
  const seccionGeneral = document.getElementById('resumen-general-prestamos');
  const prestamosVacio = document.getElementById('resumen-prestamos-vacio');
  const listaPrestamosGeneral = document.getElementById('gen-prestamos-lista');
  const btnLogout = document.getElementById('btn-logout');
  const userLabel = document.getElementById('user-label');

  userLabel.textContent = sesion.usuario;
  inputSueldo.value = sesion.sueldoIngresado || 2000000;

  btnGuardarSueldo?.addEventListener('click', async () => {
    const sueldo = Math.max(0, Number(inputSueldo.value) || 0);
    if (!sueldo) return;
    const usuario = getUsuarios().find((item) => item.id === sesion.id);
    if (!usuario) return;
    usuario.sueldoIngresado = sueldo;
    await saveUsuarios(getUsuarios().map((item) => item.id === usuario.id ? usuario : item));
    await setSesion({ ...usuario, sueldoIngresado: sueldo });
    renderMensual();
  });

  btnLogout?.addEventListener('click', async () => {
    await clearSesion();
    window.location.href = 'index.html';
  });

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function renderPrestamosGeneral() {
    const prestamos = getPrestamosByUsuario(sesion.id);
    const r = resumenPrestamos(sesion.id);
    const hasItems = prestamos.length > 0;

    seccionGeneral.hidden = !hasItems;
    prestamosVacio.hidden = hasItems;

    if (!hasItems) return;

    document.getElementById('gen-prestamos-cantidad').textContent = r.cantidad;
    document.getElementById('gen-prestamos-activos').textContent =
      `${r.activos} activo${r.activos !== 1 ? 's' : ''}`;
    document.getElementById('gen-prestamos-capital').textContent = formatMonto(r.capital);
    document.getElementById('gen-prestamos-total').textContent = formatMonto(r.totalConInteres);
    document.getElementById('gen-prestamos-pendiente').textContent = formatMonto(r.pendiente);

    listaPrestamosGeneral.innerHTML = prestamos
      .map((p) => {
        const estado = getEstadoPrestamo(p);
        const pendiente = montoPendientePrestamo(p);
        return `<li>
          <span>
            ${escapeHtml(p.prestante)}
            <span class="badge ${badgePrestamo(estado)}">${etiquetaEstadoPrestamo(estado)}</span>
          </span>
          <span>${formatMonto(pendiente)} pend.</span>
        </li>`;
      })
      .join('');
  }

  function renderMensual() {
    const mes = inputAMesAnio(inputMes.value) || mesAnioActual();
    const r = resumenMensual(sesion.id, mes);

    elCuentas.textContent = formatMonto(r.cuentasPagadas);
    elCuentasDet.textContent =
      r.cantidadPagos === 0
        ? 'Ningún pago marcado'
        : `${r.cantidadPagos} pago${r.cantidadPagos !== 1 ? 's' : ''} marcado${r.cantidadPagos !== 1 ? 's' : ''}`;

    elHormiga.textContent = formatMonto(r.gastosHormiga);
    elHormigaDet.textContent =
      r.cantidadHormiga === 0
        ? 'Sin gastos registrados'
        : `${r.cantidadHormiga} gasto${r.cantidadHormiga !== 1 ? 's' : ''}`;

    elGastos.textContent = formatMonto(r.comprasGastos);
    elGastosDet.textContent = r.cantidadComprasGastos === 0
      ? 'Sin compras o gastos registrados'
      : `${r.cantidadComprasGastos} registro${r.cantidadComprasGastos !== 1 ? 's' : ''}`;

    elTotal.textContent = formatMonto(r.total);
    elMesLabel.textContent = formatMesLabel(mes);

    const escala = escalaColorTotalMes(r.total, Number(inputSueldo.value) || 2000000);
    elTotal.style.color = escala.color;
    if (cardTotal) {
      cardTotal.style.borderColor = escala.borde;
      cardTotal.style.background = escala.fondo;
      cardTotal.classList.toggle('resumen-card--exceso', escala.exceso);
    }
    if (escala.exceso) {
      elMesLabel.innerHTML = `${formatMesLabel(mes)} · <strong class="resumen-exceso-tag">${escala.etiqueta}</strong>`;
    } else {
      elMesLabel.textContent = formatMesLabel(mes);
    }

    listaPagos.innerHTML =
      r.detallePagos.length === 0
        ? '<li class="resumen-detalle-empty">—</li>'
        : r.detallePagos
            .map(
              (p) =>
                `<li><span>${escapeHtml(p.nombre)}</span><span>${formatMonto(p.monto)}</span></li>`
            )
            .join('');

    listaHormiga.innerHTML =
      r.detalleHormiga.length === 0
        ? '<li class="resumen-detalle-empty">—</li>'
        : r.detalleHormiga
            .map((g) => {
              const persona = g.personaId ? getPersonaById(g.personaId)?.nombre : '';
              return `<li><span>${formatFechaCorta(g.fecha)} · ${escapeHtml(g.descripcion)}${persona ? ` · ${escapeHtml(persona)}` : ''}</span><span>${formatMonto(g.monto)}</span></li>`;
            })
            .join('');

    listaGastos.innerHTML = r.detalleComprasGastos.length === 0
      ? '<li class="resumen-detalle-empty">—</li>'
      : r.detalleComprasGastos.map((gasto) => {
        const persona = gasto.personaId ? getPersonaById(gasto.personaId)?.nombre : '';
        return `<li><span>${formatFechaCorta(gasto.fecha)} · ${escapeHtml(gasto.descripcion)}${persona ? ` · ${escapeHtml(persona)}` : ''}</span><span>${formatMonto(gasto.monto)}</span></li>`;
      }).join('');

    const registrosPersonas = [...r.detalleHormiga, ...r.detalleComprasGastos]
      .filter((gasto) => gasto.personaId)
      .reduce((agrupado, gasto) => {
        const persona = getPersonaById(gasto.personaId);
        if (!persona) return agrupado;
        const actual = agrupado.get(persona.id) || { nombre: persona.nombre, cantidad: 0, total: 0 };
        actual.cantidad += 1;
        actual.total += Number(gasto.monto) || 0;
        agrupado.set(persona.id, actual);
        return agrupado;
      }, new Map());
    const filasPersonas = [...registrosPersonas.values()].sort((a, b) => b.total - a.total);
    listaPersonas.innerHTML = filasPersonas.length
      ? filasPersonas.map((persona) => `<li><span>${escapeHtml(persona.nombre)} · ${persona.cantidad} registro${persona.cantidad === 1 ? '' : 's'}</span><span>${formatMonto(persona.total)}</span></li>`).join('')
      : '<li class="resumen-detalle-empty">No hay gastos asociados a personas este mes.</li>';
  }

  function render() {
    renderMensual();
    renderPrestamosGeneral();
  }

  inputMes?.addEventListener('change', renderMensual);
  document.addEventListener('datos-actualizados', renderPrestamosGeneral);
  inputMes.value = mesAnioAInput(mesAnioActual());
  render();
});
