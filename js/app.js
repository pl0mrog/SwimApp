window.App = (function () {
  const widoki = [];
  let aktywnyId = null;

  function zarejestrujWidok(widok) {
    widoki.push(widok);
  }

  function znajdzWidok(id) {
    return widoki.find(function (w) { return w.id === id; });
  }

  function renderNawigacji() {
    const nav = document.getElementById('nawigacja');
    nav.innerHTML = '';
    widoki.filter(function (w) { return w.id !== 'ustawienia'; }).forEach(function (w) {
      const btn = document.createElement('button');
      btn.className = 'nav-pill';
      if (!w.aktywny) {
        btn.classList.add('disabled');
        btn.disabled = true;
        btn.textContent = w.etykieta + ' (wkrótce)';
      } else {
        btn.classList.add(w.id === aktywnyId ? 'active' : 'inactive');
        btn.textContent = w.etykieta;
        btn.addEventListener('click', function () { przelacz(w.id); });
      }
      nav.appendChild(btn);
    });

    const gearBtn = document.getElementById('ustawieniaBtn');
    if (gearBtn) gearBtn.classList.toggle('active', aktywnyId === 'ustawienia');
  }

  function przelacz(id) {
    const biezacy = znajdzWidok(aktywnyId);
    if (biezacy && biezacy.odmontuj) biezacy.odmontuj();
    aktywnyId = id;
    const kontener = document.getElementById('widok');
    kontener.innerHTML = '';
    const nowy = znajdzWidok(id);
    if (nowy && nowy.montuj) nowy.montuj(kontener);
    renderNawigacji();
  }

  function wstrzyknijWersje() {
    document.getElementById('wersja').textContent = 'v' + window.APP_VERSION;
    document.title = 'SwimApp – v' + window.APP_VERSION;
  }

  // Pasek ładowania na ekranie startowym: co sekundę zapala się kolejna z czterech
  // pierwszych pastylek (kolory jak w logo — trzy kobaltowe, czwarta błękitna),
  // sekundę po ostatniej ekran gaśnie. Element usuwamy dopiero po animacji,
  // żeby nie przechwytywał kliknięć w przezroczystym stanie.
  const KROK_PASKA_MS = 1000;
  const PASTYLKI_PASKA = 4;

  function schowajSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    const pastylki = splash.querySelectorAll('.splash-bar i');

    for (let i = 0; i < PASTYLKI_PASKA; i++) {
      setTimeout(function (idx) {
        return function () {
          const p = pastylki[idx];
          if (p) p.classList.add(idx === PASTYLKI_PASKA - 1 ? 'on-info' : 'on');
        };
      }(i), (i + 1) * KROK_PASKA_MS);
    }

    setTimeout(function () {
      splash.classList.add('ukryty');
      setTimeout(function () { splash.remove(); }, 400);
    }, (PASTYLKI_PASKA + 1) * KROK_PASKA_MS);
  }

  function init() {
    // Statystyki nie mają jeszcze własnego pliku (dopiero faza 2) —
    // zakładka wyszarzona rejestrowana jest tu wprost.
    zarejestrujWidok({ id: 'statystyki', etykieta: 'Statystyki', aktywny: false });

    wstrzyknijWersje();

    const gearBtn = document.getElementById('ustawieniaBtn');
    if (gearBtn) gearBtn.addEventListener('click', function () { przelacz('ustawienia'); });

    const pierwszy = widoki.find(function (w) { return w.aktywny; });
    if (pierwszy) przelacz(pierwszy.id);
    else renderNawigacji();

    schowajSplash();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { zarejestrujWidok };
})();
