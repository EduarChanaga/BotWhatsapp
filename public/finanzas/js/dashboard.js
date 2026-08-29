/**

 * Dashboard - gestión de cuentas (dashboard.html)

 */

document.addEventListener('storage-ready', () => {

  const sesion = requireAuth();

  if (!sesion) return;



  const lista = document.getElementById('lista-cuentas');

  const emptyState = document.getElementById('empty-cuentas');

  const modal = document.getElementById('modal-cuenta');

  const form = document.getElementById('form-cuenta');

  const modalTitle = document.getElementById('modal-titulo');

  const btnNueva = document.getElementById('btn-nueva-cuenta');

  const btnLogout = document.getElementById('btn-logout');

  const userLabel = document.getElementById('user-label');
  const btnEditarUsuario = document.getElementById('btn-editar-usuario');
  const formUsuario = document.getElementById('form-usuario');
  const inputNumeroUsuario = document.getElementById('usuario-numero');
  const btnCancelarUsuario = document.getElementById('btn-cancelar-usuario');
  const msgUsuario = document.getElementById('msg-usuario');

  const fieldMeses = document.getElementById('field-meses');

  const inputMeses = document.getElementById('cuenta-meses');

  const fieldMesInicio = document.getElementById('field-mes-inicio');

  const inputMesInicio = document.getElementById('cuenta-mes-inicio');

  const fieldFechaDia = document.getElementById('field-fecha-dia');

  const fieldFechaCompleta = document.getElementById('field-fecha-completa');

  const inputDia = document.getElementById('cuenta-dia');

  const inputFecha = document.getElementById('cuenta-fecha');

  const tipoRadios = document.querySelectorAll('input[name="tipo-cuenta"]');



  let editId = null;

  let cuentaEditando = null;



  userLabel.textContent = sesion.usuario;
  const usuarioActual = getUsuarios().find((usuario) => usuario.id === sesion.id);
  inputNumeroUsuario.value = usuarioActual?.numero || sesion.numero || '';

  btnEditarUsuario?.addEventListener('click', () => {
    formUsuario.hidden = false;
    inputNumeroUsuario.focus();
  });

  btnCancelarUsuario?.addEventListener('click', () => {
    formUsuario.hidden = true;
    msgUsuario.hidden = true;
  });

  formUsuario?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const numero = inputNumeroUsuario.value.trim();
    if (!numero) return;
    const actualizado = await updateUsuario(sesion.id, { numero });
    if (!actualizado) return;
    await setSesion(actualizado);
    msgUsuario.textContent = 'Número actualizado correctamente.';
    msgUsuario.className = 'form-message success';
    msgUsuario.hidden = false;
    formUsuario.hidden = true;
  });



  btnLogout?.addEventListener('click', async () => {

    await clearSesion();

    window.location.href = 'index.html';

  });



  function tipoSeleccionado() {

    return document.querySelector('input[name="tipo-cuenta"]:checked')?.value;

  }



  function actualizarCamposFecha() {

    const tipo = tipoSeleccionado();

    const soloDia = tipo === TIPOS_CUENTA.PERMANENTE || tipo === TIPOS_CUENTA.LIMITADA;



    fieldFechaDia.hidden = !soloDia;

    fieldFechaCompleta.hidden = soloDia;

    fieldMeses.hidden = tipo !== TIPOS_CUENTA.LIMITADA;

    fieldMesInicio.hidden = tipo === TIPOS_CUENTA.UNICO;

    inputDia.required = soloDia;

    inputFecha.required = !soloDia;

    inputMesInicio.required = !fieldMesInicio.hidden;

  }



  tipoRadios.forEach((radio) => {

    radio.addEventListener('change', actualizarCamposFecha);

  });



  function openModal(cuenta = null) {

    editId = cuenta?.id ?? null;

    cuentaEditando = cuenta;

    modalTitle.textContent = cuenta ? 'Editar cuenta' : 'Nueva cuenta';

    form.reset();

    fieldMeses.hidden = true;



    if (cuenta) {

      document.getElementById('cuenta-nombre').value = cuenta.nombre;
      document.getElementById('cuenta-monto').value = cuenta.monto ?? 0;

      const tipo = tipoFromCantidadMeses(cuenta.cantidadMeses);

      const radio = document.querySelector(`input[name="tipo-cuenta"][value="${tipo}"]`);

      if (radio) radio.checked = true;

      if (tipo === TIPOS_CUENTA.LIMITADA) {

        fieldMeses.hidden = false;

        inputMeses.value = cuenta.cantidadMeses;

      }

      if (esPagoSoloDia(cuenta.cantidadMeses)) {

        inputDia.value = getDiaPago(cuenta);

        inputMesInicio.value = mesAnioAInput(getMesInicioCuenta(cuenta));

      } else {

        inputFecha.value = cuenta.fechaPago;

      }

      document.getElementById('cuenta-estado').value = cuenta.estado;

    } else {

      document.querySelector('input[name="tipo-cuenta"][value="permanente"]').checked = true;

      document.getElementById('cuenta-estado').value = 'pagando';

      inputDia.value = 1;

      inputMesInicio.value = mesAnioAInput(mesAnioActual());

    }



    actualizarCamposFecha();

    modal.classList.add('open');

    modal.setAttribute('aria-hidden', 'false');

  }



  function closeModal() {

    modal.classList.remove('open');

    modal.setAttribute('aria-hidden', 'true');

    editId = null;

    cuentaEditando = null;

  }



  btnNueva?.addEventListener('click', () => openModal());

  modal.querySelectorAll('[data-close]').forEach((el) => {

    el.addEventListener('click', closeModal);

  });



  form?.addEventListener('submit', async (e) => {

    e.preventDefault();

    const nombre = document.getElementById('cuenta-nombre').value.trim();
    const monto = parseMontoInput(document.getElementById('cuenta-monto').value);

    const estado = document.getElementById('cuenta-estado').value;

    const tipo = tipoSeleccionado();

    const cantidadMeses = cantidadMesesFromTipo(tipo, inputMeses.value);

    const mesInicio = resolverMesInicio(
      cantidadMeses,
      inputAMesAnio(inputMesInicio.value),
      inputFecha.value,
      cuentaEditando
    );

    const fechaPago = buildFechaPago(
      cantidadMeses,
      inputDia.value,
      inputFecha.value,
      mesInicio,
      cuentaEditando
    );

    if (!nombre || !fechaPago) return;

    if (editId) {
      await updateCuenta(editId, {
        nombre,
        monto,
        mesInicio,
        fechaPago,
        cantidadMeses,
        estado
      });
    } else {
      await createCuenta({
        usuarioId: sesion.id,
        nombre,
        monto,
        mesInicio,
        fechaPago,
        cantidadMeses,
        estado: 'pagando'
      });

    }

    closeModal();

    await render();
    document.dispatchEvent(new Event('datos-actualizados'));

  });



  function escapeHtml(text) {

    const div = document.createElement('div');

    div.textContent = text;

    return div.innerHTML;

  }



  function renderCard(cuenta) {

    const pagos = contarPagosCuenta(cuenta.id);

    const li = document.createElement('li');

    li.className = 'cuenta-card';

    li.innerHTML = `
      <div class="cuenta-card__header">
        <h3 class="cuenta-card__title">${escapeHtml(cuenta.nombre)}</h3>
        <span class="badge ${estadoBadge(cuenta.estado)}">${capitalizar(cuenta.estado)}</span>
      </div>
      <p class="cuenta-card__monto">${formatMonto(cuenta.monto)}</p>
      <div class="cuenta-card__meta">
        <p>${etiquetaTipo(cuenta.cantidadMeses)} · ${formatFechaPago(cuenta)}</p>
        <p>Desde ${formatMesLabel(getMesInicioCuenta(cuenta))} · Pagos ${pagos}${cuenta.cantidadMeses > 0 ? `/${cuenta.cantidadMeses}` : ''}</p>
      </div>
      <div class="cuenta-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-edit="${cuenta.id}">Editar</button>
        <button type="button" class="btn btn--danger btn--sm" data-delete="${cuenta.id}">Eliminar</button>
      </div>
    `;

    return li;

  }



  async function render() {

    const cuentas = getCuentasByUsuario(sesion.id);

    lista.innerHTML = '';

    const hasItems = cuentas.length > 0;

    emptyState.hidden = hasItems;

    lista.hidden = !hasItems;



    for (const c of cuentas) {

      await verificarCompletado(c);

      lista.appendChild(renderCard(c));

    }



    lista.querySelectorAll('[data-edit]').forEach((btn) => {

      btn.addEventListener('click', () => {

        const c = getCuentaById(btn.dataset.edit);

        if (c) openModal(c);

      });

    });



    lista.querySelectorAll('[data-delete]').forEach((btn) => {

      btn.addEventListener('click', async () => {

        if (confirm('¿Eliminar esta cuenta y su historial de pagos?')) {

          await deleteCuenta(btn.dataset.delete);

          await render();
          document.dispatchEvent(new Event('datos-actualizados'));

        }

      });

    });

  }



  render();

});


