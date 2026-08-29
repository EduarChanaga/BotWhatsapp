/**
 * Préstamos — CRUD
 */
document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const lista = document.getElementById('lista-prestamos');
  const emptyState = document.getElementById('empty-prestamos');
  const modal = document.getElementById('modal-prestamo');
  const form = document.getElementById('form-prestamo');
  const modalTitle = document.getElementById('modal-prestamo-titulo');
  const fieldCuotasPagadas = document.getElementById('field-cuotas-pagadas');
  const btnNuevo = document.getElementById('btn-nuevo-prestamo');
  const btnLogout = document.getElementById('btn-logout');
  const userLabel = document.getElementById('user-label');
  const indicadores = document.getElementById('prestamos-indicadores');

  let editId = null;

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

  function openModal(prestamo = null) {
    editId = prestamo?.id ?? null;
    modalTitle.textContent = prestamo ? 'Editar préstamo' : 'Nuevo préstamo';
    form.reset();
    fieldCuotasPagadas.hidden = !prestamo;

    if (prestamo) {
      document.getElementById('prestamo-prestante').value = prestamo.prestante;
      document.getElementById('prestamo-monto').value = prestamo.monto;
      document.getElementById('prestamo-intereses').value = prestamo.intereses ?? 0;
      document.getElementById('prestamo-vencimiento').value = prestamo.fechaVencimiento;
      document.getElementById('prestamo-cuotas').value = prestamo.cuotas;
      document.getElementById('prestamo-cuotas-pagadas').value = prestamo.cuotasPagadas ?? 0;
      fieldCuotasPagadas.hidden = false;
    }

    modal.classList.add('open');
    modal.setAttribute('aria-hidden', 'false');
  }

  function closeModal() {
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden', 'true');
    editId = null;
  }

  btnNuevo?.addEventListener('click', () => openModal());
  modal.querySelectorAll('[data-close]').forEach((el) => {
    el.addEventListener('click', closeModal);
  });

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      prestante: document.getElementById('prestamo-prestante').value.trim(),
      monto: parseMontoInput(document.getElementById('prestamo-monto').value),
      intereses: parseMontoInput(document.getElementById('prestamo-intereses').value),
      fechaVencimiento: document.getElementById('prestamo-vencimiento').value,
      cuotas: document.getElementById('prestamo-cuotas').value
    };

    if (!data.prestante || !data.fechaVencimiento) return;

    if (editId) {
      data.cuotasPagadas = document.getElementById('prestamo-cuotas-pagadas').value;
      await updatePrestamo(editId, data);
    } else {
      await createPrestamo({ usuarioId: sesion.id, ...data });
    }

    document.dispatchEvent(new Event('datos-actualizados'));
    closeModal();
    render();
  });

  function renderCard(prestamo) {
    const estado = getEstadoPrestamo(prestamo);
    const total = totalPrestamoConInteres(prestamo);
    const cuota = valorCuotaPrestamo(prestamo);
    const pagadas = prestamo.cuotasPagadas ?? 0;
    const puedeMarcar = pagadas < prestamo.cuotas;

    const li = document.createElement('li');
    li.className = 'cuenta-card prestamo-card';
    li.innerHTML = `
      <div class="cuenta-card__header">
        <h3 class="cuenta-card__title">${escapeHtml(prestamo.prestante)}</h3>
        <span class="badge ${badgePrestamo(estado)}">${etiquetaEstadoPrestamo(estado)}</span>
      </div>
      <p class="cuenta-card__monto">${formatMonto(total)}</p>
      <div class="cuenta-card__meta">
        <p>Capital ${formatMonto(prestamo.monto)} · Int. ${prestamo.intereses ?? 0}%</p>
        <p>Vence ${formatFecha(prestamo.fechaVencimiento)}</p>
        <p>Cuota ${formatMonto(cuota)} · ${pagadas}/${prestamo.cuotas} pagadas</p>
      </div>
      <div class="prestamo-card__progress">
        <div class="prestamo-card__bar" style="width:${Math.min(100, (pagadas / prestamo.cuotas) * 100)}%"></div>
      </div>
      <div class="cuenta-card__actions">
        ${puedeMarcar ? `<button type="button" class="btn btn--primary btn--sm" data-cuota="${prestamo.id}">+ Cuota</button>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-edit="${prestamo.id}">Editar</button>
        <button type="button" class="btn btn--danger btn--sm" data-delete="${prestamo.id}">Eliminar</button>
      </div>
    `;
    return li;
  }

  async function render() {
    const prestamos = getPrestamosByUsuario(sesion.id);
    const r = resumenPrestamos(sesion.id);

    lista.innerHTML = '';
    const hasItems = prestamos.length > 0;
    emptyState.hidden = hasItems;
    lista.hidden = !hasItems;
    indicadores.hidden = !hasItems;

    if (hasItems) {
      document.getElementById('ind-prestamos-cantidad').textContent = r.cantidad;
      document.getElementById('ind-prestamos-activos').textContent =
        `${r.activos} activo${r.activos !== 1 ? 's' : ''}`;
      document.getElementById('ind-prestamos-capital').textContent = formatMonto(r.capital);
      document.getElementById('ind-prestamos-total').textContent = formatMonto(r.totalConInteres);
      document.getElementById('ind-prestamos-pendiente').textContent = formatMonto(r.pendiente);
    }

    prestamos.forEach((p) => lista.appendChild(renderCard(p)));

    lista.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const p = getPrestamoById(btn.dataset.edit);
        if (p) openModal(p);
      });
    });

    lista.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar este préstamo?')) {
          await deletePrestamo(btn.dataset.delete);
          document.dispatchEvent(new Event('datos-actualizados'));
          render();
        }
      });
    });

    lista.querySelectorAll('[data-cuota]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const p = getPrestamoById(btn.dataset.cuota);
        if (!p) return;
        const nuevas = Math.min(p.cuotas, (p.cuotasPagadas ?? 0) + 1);
        await updatePrestamo(p.id, { cuotasPagadas: nuevas });
        document.dispatchEvent(new Event('datos-actualizados'));
        render();
      });
    });
  }

  render();
});
