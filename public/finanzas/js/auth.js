/**
 * Autenticación (index.html)
 */
document.addEventListener('storage-ready', () => {
  const formRegistro = document.getElementById('form-registro');
  const formLogin = document.getElementById('form-login');
  const msgRegistro = document.getElementById('msg-registro');
  const msgLogin = document.getElementById('msg-login');
  const tabs = document.querySelectorAll('[data-tab]');
  const panels = document.querySelectorAll('[data-panel]');

  if (getSesion()) {
    window.location.href = 'dashboard.html';
    return;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      tabs.forEach((t) => t.classList.toggle('active', t.dataset.tab === target));
      panels.forEach((p) =>
        p.classList.toggle('active', p.dataset.panel === target)
      );
    });
  });

  function showMsg(el, text, type) {
    el.textContent = text;
    el.className = `form-message ${type}`;
    el.hidden = !text;
  }

  formRegistro?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('reg-usuario').value.trim();
    const numero = document.getElementById('reg-numero').value.trim();
    const password = document.getElementById('reg-password').value;
    const confirm = document.getElementById('reg-confirm').value;

    if (!usuario || !numero || !password) {
      showMsg(msgRegistro, 'Completa todos los campos.', 'error');
      return;
    }
    if (password !== confirm) {
      showMsg(msgRegistro, 'Las contraseñas no coinciden.', 'error');
      return;
    }
    if (password.length < 4) {
      showMsg(msgRegistro, 'La contraseña debe tener al menos 4 caracteres.', 'error');
      return;
    }
    if (findUsuarioByNombre(usuario)) {
      showMsg(msgRegistro, 'Ese usuario ya está registrado.', 'error');
      return;
    }

    const nuevo = await createUsuario(usuario, password, numero);
    showMsg(
      msgRegistro,
      `Cuenta creada. Tu ID es ${nuevo.id}. Ya puedes iniciar sesión.`,
      'success'
    );
    formRegistro.reset();
  });

  formLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const usuario = document.getElementById('login-usuario').value.trim();
    const password = document.getElementById('login-password').value;

    const found = findUsuarioByNombre(usuario);
    if (!found || found.password !== password) {
      showMsg(msgLogin, 'Usuario o contraseña incorrectos.', 'error');
      return;
    }

    await setSesion(found);
    window.location.href = 'dashboard.html';
  });
});
