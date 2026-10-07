/** Compras y gastos puntuales, filtrados por mes. */
document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const filtroMes = document.getElementById('filtro-mes');
  const subtotal = document.getElementById('subtotal-mes');
  const form = document.getElementById('form-gasto');
  const fechaInput = document.getElementById('gasto-fecha');
  const montoInput = document.getElementById('gasto-monto');
  const descripcionInput = document.getElementById('gasto-descripcion');
  const personaInput = document.getElementById('gasto-persona');
  const titulo = document.getElementById('form-gasto-titulo');
  const guardar = document.getElementById('btn-guardar-gasto');
  const cancelar = document.getElementById('btn-cancelar-gasto');
  const lista = document.getElementById('lista-gastos');
  const vacio = document.getElementById('empty-gastos');
  const userLabel = document.getElementById('user-label');
  let editId = null;

  userLabel.textContent = sesion.usuario;
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await clearSesion();
    window.location.href = 'index.html';
  });

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }

  function renderPersonas() {
    const selected = personaInput.value;
    personaInput.innerHTML = '<option value="">Sin persona asociada</option>' + getPersonasByUsuario(sesion.id)
      .map((persona) => `<option value="${persona.id}">${escapeHtml(persona.nombre)}</option>`).join('');
    personaInput.value = selected;
  }

  function resetForm() {
    editId = null;
    form.reset();
    fechaInput.value = fechaHoyInput();
    titulo.textContent = 'Nuevo gasto';
    guardar.textContent = 'Agregar gasto';
    cancelar.hidden = true;
  }

  function render() {
    renderPersonas();
    const mes = inputAMesAnio(filtroMes.value) || mesAnioActual();
    const gastos = gastosGeneralesByMes(sesion.id, mes);
    subtotal.textContent = formatMonto(totalGastosGeneralesEnMes(sesion.id, mes));
    vacio.hidden = gastos.length > 0;
    lista.innerHTML = gastos.map((gasto) => {
      const persona = gasto.personaId ? getPersonaById(gasto.personaId)?.nombre : '';
      return `<li class="hormiga-item">
        <div class="hormiga-item__info"><span class="hormiga-item__fecha">${formatFechaCorta(gasto.fecha)}</span><span class="hormiga-item__desc">${escapeHtml(gasto.descripcion)}</span>${persona ? `<span class="gasto-persona">${escapeHtml(persona)}</span>` : ''}</div>
        <span class="hormiga-item__monto">${formatMonto(gasto.monto)}</span>
        <div class="hormiga-item__actions"><button type="button" class="btn btn--ghost btn--sm" data-edit="${gasto.id}">Editar</button><button type="button" class="btn btn--danger btn--sm" data-delete="${gasto.id}">Eliminar</button></div>
      </li>`;
    }).join('');
  }

  lista.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      const gasto = getGastoById(editButton.dataset.edit);
      if (!gasto) return;
      editId = gasto.id;
      fechaInput.value = gasto.fecha;
      montoInput.value = gasto.monto;
      descripcionInput.value = gasto.descripcion;
      renderPersonas();
      personaInput.value = gasto.personaId || '';
      titulo.textContent = 'Editar gasto';
      guardar.textContent = 'Guardar cambios';
      cancelar.hidden = false;
      form.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    const deleteButton = event.target.closest('[data-delete]');
    if (deleteButton && confirm('¿Eliminar este gasto?')) {
      await deleteGasto(deleteButton.dataset.delete);
      document.dispatchEvent(new Event('datos-actualizados'));
      render();
    }
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = {
      usuarioId: sesion.id,
      fecha: fechaInput.value,
      monto: parseMontoInput(montoInput.value),
      descripcion: descripcionInput.value.trim(),
      personaId: personaInput.value || null
    };
    if (editId) await updateGasto(editId, data);
    else await createGasto(data);
    document.dispatchEvent(new Event('datos-actualizados'));
    resetForm();
    render();
  });

  cancelar.addEventListener('click', resetForm);
  filtroMes.addEventListener('change', render);
  document.addEventListener('datos-actualizados', render);
  filtroMes.value = mesAnioAInput(mesAnioActual());
  resetForm();
  render();
});
