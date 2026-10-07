document.addEventListener('storage-ready', () => {
  const sesion = requireAuth();
  if (!sesion) return;

  const form = document.getElementById('form-persona');
  const nombreInput = document.getElementById('persona-nombre');
  const guardarButton = document.getElementById('guardar-persona');
  const cancelarButton = document.getElementById('cancelar-persona');
  const lista = document.getElementById('lista-personas');
  const contador = document.getElementById('personas-count');
  const empty = document.getElementById('personas-empty');
  const mensaje = document.getElementById('personas-mensaje');
  let editId = null;

  document.getElementById('user-label').textContent = sesion.usuario;
  document.getElementById('btn-logout')?.addEventListener('click', async () => {
    await clearSesion();
    window.location.href = 'index.html';
  });

  function escapeHtml(value) {
    const div = document.createElement('div');
    div.textContent = value || '';
    return div.innerHTML;
  }

  function getUsageCount(personaId) {
    const loans = getPrestamosByUsuario(sesion.id).filter((prestamo) => prestamo.personaId === personaId).length;
    const smallExpenses = getHormigaByUsuario(sesion.id).filter((gasto) => gasto.personaId === personaId).length;
    const expenses = getGastos().filter((gasto) => gasto.usuarioId === sesion.id && gasto.personaId === personaId).length;
    return { loans, expenses: smallExpenses + expenses };
  }

  function render() {
    const personas = getPersonasByUsuario(sesion.id);
    contador.textContent = personas.length;
    empty.hidden = personas.length > 0;
    lista.hidden = personas.length === 0;
    lista.innerHTML = personas.map((persona) => {
      const usage = getUsageCount(persona.id);
      return `<li class="persona-row">
        <span class="persona-row__name">${escapeHtml(persona.nombre)}</span>
        <span class="persona-row__usage">${usage.loans} préstamo${usage.loans === 1 ? '' : 's'} · ${usage.expenses} gasto${usage.expenses === 1 ? '' : 's'}</span>
        <span class="persona-row__actions"><button type="button" class="btn btn--ghost btn--sm" data-edit="${persona.id}">Editar</button><button type="button" class="btn btn--danger btn--sm" data-delete="${persona.id}">Eliminar</button></span>
      </li>`;
    }).join('');
  }

  function resetForm() {
    editId = null;
    form.reset();
    guardarButton.textContent = 'Agregar persona';
    cancelarButton.hidden = true;
    mensaje.hidden = true;
    nombreInput.focus();
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const nombre = nombreInput.value.trim();
    if (!nombre) return;
    const duplicate = getPersonasByUsuario(sesion.id).some((persona) => persona.id !== editId && persona.nombre.toLocaleLowerCase() === nombre.toLocaleLowerCase());
    if (duplicate) {
      mensaje.textContent = 'Ya existe una persona con ese nombre.';
      mensaje.hidden = false;
      return;
    }

    try {
      if (editId) await updatePersona(editId, nombre);
      else await createPersona({ usuarioId: sesion.id, nombre });
      resetForm();
      render();
    } catch (error) {
      mensaje.textContent = error.message || 'No se pudo guardar la persona.';
      mensaje.hidden = false;
    }
  });

  cancelarButton.addEventListener('click', resetForm);
  lista.addEventListener('click', async (event) => {
    const editButton = event.target.closest('[data-edit]');
    if (editButton) {
      const persona = getPersonaById(editButton.dataset.edit);
      if (!persona) return;
      editId = persona.id;
      nombreInput.value = persona.nombre;
      guardarButton.textContent = 'Guardar cambios';
      cancelarButton.hidden = false;
      mensaje.hidden = true;
      nombreInput.focus();
      form.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }

    const deleteButton = event.target.closest('[data-delete]');
    if (!deleteButton) return;
    const persona = getPersonaById(deleteButton.dataset.delete);
    if (!persona) return;
    const usage = getUsageCount(persona.id);
    const warning = usage.loans || usage.expenses
      ? `Eliminar a ${persona.nombre} quitará su relación de ${usage.loans} préstamo(s) y ${usage.expenses} gasto(s). Los registros financieros se conservarán. ¿Continuar?`
      : `¿Eliminar a ${persona.nombre}?`;
    if (!confirm(warning)) return;
    await deletePersona(persona.id);
    if (editId === persona.id) resetForm();
    render();
  });

  render();
});
