/**
 * Banner: cuentas con pago en los próximos 7 días (todas las páginas con sesión)
 */
function renderAlertaPagosSemana() {
  let el = document.getElementById('alerta-pagos-semana');
  if (!el) {
    el = document.createElement('div');
    el.id = 'alerta-pagos-semana';
    el.className = 'alerta-pagos-semana';
    el.setAttribute('role', 'alert');
    const nav = document.querySelector('.app-nav');
    if (nav) nav.insertAdjacentElement('afterend', el);
    else document.body.prepend(el);
  }

  const sesion = typeof getSesion === 'function' ? getSesion() : null;
  if (!sesion) {
    el.hidden = true;
    return;
  }

  const alertas = obtenerAlertasProximoPago(sesion.id);
  if (!alertas.length) {
    el.hidden = true;
    return;
  }

  el.hidden = false;
  const items = alertas
    .map(({ cuenta, fecha, dias }) => {
      const fechaTxt = fecha.toLocaleDateString('es-ES', {
        day: 'numeric',
        month: 'short'
      });
      return `<li><strong>${cuenta.nombre}</strong> — ${formatMonto(cuenta.monto)} · ${textoAlertaDias(dias)} (${fechaTxt})</li>`;
    })
    .join('');

  el.innerHTML = `
    <div class="alerta-pagos-semana__inner">
      <span class="alerta-pagos-semana__icon" aria-hidden="true">⚠</span>
      <div>
        <p class="alerta-pagos-semana__titulo">Pagos en la próxima semana</p>
        <ul class="alerta-pagos-semana__lista">${items}</ul>
      </div>
      <a href="pagos.html" class="btn btn--sm btn--primary">Ver pagos</a>
    </div>
  `;
}

document.addEventListener('storage-ready', renderAlertaPagosSemana);
document.addEventListener('datos-actualizados', renderAlertaPagosSemana);
