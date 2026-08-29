/**
 * Gastos hormiga — registro por mes
 */
document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const filtroMes = document.getElementById('filtro-mes');
  const subtotalEl = document.getElementById('subtotal-mes');
  const form = document.getElementById('form-hormiga');
  const formTitulo = document.getElementById('form-hormiga-titulo');
  const inputFecha = document.getElementById('hormiga-fecha');
  const inputMonto = document.getElementById('hormiga-monto');
  const inputDesc = document.getElementById('hormiga-descripcion');
  const btnGuardar = document.getElementById('btn-guardar-hormiga');
  const btnCancelar = document.getElementById('btn-cancelar-hormiga');
  const lista = document.getElementById('lista-hormiga');
  const emptyState = document.getElementById('empty-hormiga');
  const btnLogout = document.getElementById('btn-logout');
  const userLabel = document.getElementById('user-label');

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

  function mesSeleccionado() {
    return inputAMesAnio(filtroMes.value) || mesAnioActual();
  }

  function resetForm() {
    editId = null;
    form.reset();
    inputFecha.value = fechaHoyInput();
    formTitulo.textContent = 'Nuevo gasto';
    btnGuardar.textContent = 'Agregar';
    btnCancelar.hidden = true;
  }

  function iniciarEdicion(gasto) {
    editId = gasto.id;
    inputFecha.value = gasto.fecha;
    inputMonto.value = gasto.monto;
    inputDesc.value = gasto.descripcion;
    formTitulo.textContent = 'Editar gasto';
    btnGuardar.textContent = 'Guardar';
    btnCancelar.hidden = false;
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function render() {
    const mes = mesSeleccionado();
    const gastos = getHormigaByMes(sesion.id, mes).sort(
      (a, b) => (parseFecha(b.fecha) || 0) - (parseFecha(a.fecha) || 0)
    );

    subtotalEl.textContent = formatMonto(totalHormigaEnMes(sesion.id, mes));
    lista.innerHTML = '';
    emptyState.hidden = gastos.length > 0;

    gastos.forEach((g) => {
      const li = document.createElement('li');
      li.className = 'hormiga-item';
      li.innerHTML = `
        <div class="hormiga-item__info">
          <span class="hormiga-item__fecha">${formatFechaCorta(g.fecha)}</span>
          <span class="hormiga-item__desc">${escapeHtml(g.descripcion)}</span>
        </div>
        <span class="hormiga-item__monto">${formatMonto(g.monto)}</span>
        <div class="hormiga-item__actions">
          <button type="button" class="btn btn--ghost btn--sm" data-edit="${g.id}">Editar</button>
          <button type="button" class="btn btn--danger btn--sm" data-delete="${g.id}">Eliminar</button>
        </div>
      `;
      lista.appendChild(li);
    });

    lista.querySelectorAll('[data-edit]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const g = getGastoHormigaById(btn.dataset.edit);
        if (g) iniciarEdicion(g);
      });
    });

    lista.querySelectorAll('[data-delete]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        if (confirm('¿Eliminar este gasto?')) {
          await deleteGastoHormiga(btn.dataset.delete);
          document.dispatchEvent(new Event('datos-actualizados'));
          render();
        }
      });
    });
  }

  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fecha = inputFecha.value;
    const monto = parseMontoInput(inputMonto.value);
    const descripcion = inputDesc.value.trim();
    if (!fecha || !descripcion) return;

    if (editId) {
      await updateGastoHormiga(editId, { fecha, monto, descripcion });
    } else {
      await createGastoHormiga({
        usuarioId: sesion.id,
        fecha,
        monto,
        descripcion
      });
    }

    document.dispatchEvent(new Event('datos-actualizados'));
    resetForm();
    render();
  });

  btnCancelar?.addEventListener('click', resetForm);
  filtroMes?.addEventListener('change', render);

  filtroMes.value = mesAnioAInput(mesAnioActual());
  resetForm();
  render();
});
