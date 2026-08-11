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
    widoki.forEach(function (w) {
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

  function init() {
    // Statystyki nie mają jeszcze własnego pliku (dopiero faza 2) —
    // zakładka wyszarzona rejestrowana jest tu wprost.
    zarejestrujWidok({ id: 'statystyki', etykieta: 'Statystyki', aktywny: false });

    wstrzyknijWersje();

    const pierwszy = widoki.find(function (w) { return w.aktywny; });
    if (pierwszy) przelacz(pierwszy.id);
    else renderNawigacji();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { zarejestrujWidok };
})();
