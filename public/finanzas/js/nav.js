/**
 * Menú de navegación responsive (hamburguesa en móvil/tablet estrecha)
 */
(function initNav() {
  const nav = document.querySelector('.app-nav');
  if (!nav) return;

  const toggle = document.getElementById('nav-toggle');
  const menu = document.getElementById('nav-menu');
  if (!toggle || !menu) return;

  const mqDesktop = window.matchMedia('(min-width: 768px)');

  function closeMenu() {
    nav.classList.remove('app-nav--open');
    toggle.setAttribute('aria-expanded', 'false');
    toggle.setAttribute('aria-label', 'Abrir menú de navegación');
  }

  function openMenu() {
    nav.classList.add('app-nav--open');
    toggle.setAttribute('aria-expanded', 'true');
    toggle.setAttribute('aria-label', 'Cerrar menú de navegación');
  }

  toggle.addEventListener('click', () => {
    if (nav.classList.contains('app-nav--open')) closeMenu();
    else openMenu();
  });

  menu.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  mqDesktop.addEventListener('change', (e) => {
    if (e.matches) closeMenu();
  });
})();
