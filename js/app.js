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
        // bez dopisku „(wkrótce)" — pasek nawigacji nie przewija się i musi się zmieścić
        btn.textContent = w.etykieta;
        btn.title = 'Wkrótce';
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

  // Realna szerokość suwaka — CSS jej nie zna, a musi się zgadzać co do piksela
  // z rynną rezerwowaną przez `scrollbar-gutter:stable` (patrz --sb w style.css).
  // Sonda dostaje klasę `.view-scroll`, a nie własne style: szerokość suwaka zależy
  // i od `scrollbar-width:thin`, i od `scrollbar-color` (własny kolor wyłącza w Chromium
  // suwaki nakładkowe). Kopiowanie tych wartości do JS rozjechałoby się przy zmianie CSS.
  // Na dotyku suwaki są nakładkowe i pomiar wychodzi 0 — reguły z --sb i tak tam nie działają.
  function zmierzSuwak() {
    const sonda = document.createElement('div');
    sonda.className = 'view-scroll';
    sonda.style.cssText = 'position:absolute;top:-9999px;width:100px;height:100px;overflow-y:scroll;';
    document.body.appendChild(sonda);
    const szerokosc = sonda.offsetWidth - sonda.clientWidth;
    document.body.removeChild(sonda);
    document.documentElement.style.setProperty('--sb', szerokosc + 'px');
  }

  function wstrzyknijWersje() {
    document.getElementById('wersja').textContent = 'v' + window.APP_VERSION;
    document.title = 'SwimApp – v' + window.APP_VERSION;
  }

  // Animacja ekranu startowego (zalewanie pastylek + napis) siedzi w CSS i startuje
  // razem z pierwszym rysowaniem strony — tutaj zostaje samo chowanie ekranu.
  // ANIMACJA_MS to moment, w którym animacja się kończy — czyli koniec wchodzenia napisu
  // (2120 ms opóźnienia + 420 ms samego napisu; musi się zgadzać z .splash-wordmark
  // i opóźnieniami w .splash-bar). PAUZA_MS — jak długo trzymamy gotowy ekran. Element
  // usuwamy dopiero po wygaszeniu, żeby nie przechwytywał kliknięć w przezroczystym stanie.
  const ANIMACJA_MS = 2540;
  const PAUZA_MS = 1000;

  function schowajSplash() {
    const splash = document.getElementById('splash');
    if (!splash) return;
    // Animacja CSS rusza z pierwszym rysowaniem, a ten kod dopiero na DOMContentLoaded
    // (kilkaset ms później przy wolnym CSS fontów) — odliczamy od jej realnego czasu,
    // żeby pauza po ostatniej pastylce nie rosła.
    const zalewanie = splash.querySelector('.splash-fill');
    const animacja = zalewanie && zalewanie.getAnimations ? zalewanie.getAnimations()[0] : null;
    const uplynelo = animacja && animacja.currentTime ? animacja.currentTime : 0;
    setTimeout(function () {
      splash.classList.add('ukryty');
      // tło <body> maluje też obszar poza viewportem (pod paskiem gestów iPhone'a) —
      // przez czas ekranu startowego musi być granatowe, inaczej na dole widać ciemniejszy pas
      document.body.classList.remove('splash-on');
      setTimeout(function () { splash.remove(); }, 400);
    }, Math.max(0, ANIMACJA_MS + PAUZA_MS - uplynelo));
  }

  function init() {
    // Statystyki nie mają jeszcze własnego pliku (dopiero faza 2) —
    // zakładka wyszarzona rejestrowana jest tu wprost.
    zarejestrujWidok({ id: 'statystyki', etykieta: 'Statystyki', aktywny: false });

    zmierzSuwak();
    wstrzyknijWersje();

    const gearBtn = document.getElementById('ustawieniaBtn');
    if (gearBtn) gearBtn.addEventListener('click', function () { przelacz('ustawienia'); });

    const pierwszy = widoki.find(function (w) { return w.aktywny; });
    if (pierwszy) przelacz(pierwszy.id);
    else renderNawigacji();

    schowajSplash();
  }

  // Kopiowanie treści pola eksportu bez wchodzenia w nie fokusem — stare
  // `select() + execCommand('copy')` podnosiło na iOS klawiaturę systemową.
  // Clipboard API działa tylko po https (GitHub Pages) i na localhost; przy pliku
  // z dysku zostaje stara ścieżka, dlatego jest tu jeszcze fallback.
  function kopiujDoSchowka(pole, poSukcesie) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(pole.value).then(poSukcesie, function () {
        kopiujStaraDroga(pole, poSukcesie);
      });
      return;
    }
    kopiujStaraDroga(pole, poSukcesie);
  }

  function kopiujStaraDroga(pole, poSukcesie) {
    pole.select();
    document.execCommand('copy');
    pole.blur();
    poSukcesie();
  }

  document.addEventListener('DOMContentLoaded', init);

  return { zarejestrujWidok, kopiujDoSchowka };
})();
