window.App = (function () {
  const widoki = [];
  let aktywnyId = null;

  function zarejestrujWidok(widok) {
    widoki.push(widok);
  }

  function znajdzWidok(id) {
    return widoki.find(function (w) { return w.id === id; });
  }

  // Od v1.0.1 zaden widok nie jest chowany przed gosciem — Tracker tez ma byc widoczny,
  // zeby dalo sie pokazac znajomym jak dziala. Zapis blokuja same widoki (patrz
  // `czyGosc()` w js/tracker.js), nie nawigacja. „Nieaktywny" znaczy juz tylko „wkrotce".
  function dostepny(w) {
    return w.aktywny;
  }

  function renderNawigacji() {
    const nav = document.getElementById('nawigacja');
    nav.innerHTML = '';
    widoki.filter(function (w) { return w.id !== 'ustawienia'; }).forEach(function (w) {
      const btn = document.createElement('button');
      btn.className = 'nav-pill';
      if (!dostepny(w)) {
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
    renderSyncBanner();
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

  // Przerysowanie widoku gubi pozycje przewijania, bo `.view-scroll` jest tworzony od nowa.
  // Zapamietujemy ja przed i przywracamy po — inaczej np. odhaczenie checkboxa w Planie
  // przerzuca ekran na gore. Przywrocenie musi nastapic PO appendChild — element odlaczony
  // od dokumentu ma scrollHeight 0 i przypisanie scrollTop przepadnie.
  function przerysuj(kontener, rysuj) {
    const stary = kontener.querySelector('.view-scroll');
    const pozycja = stary ? stary.scrollTop : 0;
    rysuj();
    const nowy = kontener.querySelector('.view-scroll');
    if (nowy && pozycja) nowy.scrollTop = pozycja;
  }

  // Baner nad tresc widoku (nad <main id="widok">, patrz index.html) — jedyne miejsce,
  // gdzie apka pokazuje konflikt synchronizacji. Apka nie ma modali (patrz CLAUDE.md),
  // wiec to zwykla karta .banner z przyciskami w .banner-btn-row, tak jak milestone
  // i koniec treningu w Trackerze.
  function renderSyncBanner() {
    const el = document.getElementById('syncBanner');
    if (!el) return;
    const stanS = Dane.stanSync();

    if (stanS.konflikt) {
      el.innerHTML =
        '<div class="banner">' +
          '<div class="banner-title">Konflikt zapisu</div>' +
          '<div class="banner-desc">W Giście są zmiany z drugiego urządzenia (' + fmtCzasBanera(stanS.konflikt.zdalnyCzas) + '). ' +
          'Twoje zmiany z ' + fmtCzasBanera(stanS.konflikt.lokalnyCzas) + ' czekają na wysłanie. ' +
          'Porzucana wersja zostanie najpierw pobrana jako plik.</div>' +
          '<div class="banner-btn-row">' +
            '<button class="small" id="konfliktScal">Scal obie</button>' +
            '<button class="small" id="konfliktZdalne">Weź wersję z Gista</button>' +
            '<button class="small" id="konfliktLokalne">Nadpisz moją</button>' +
          '</div>' +
        '</div>';
      el.querySelector('#konfliktScal').addEventListener('click', function () { rozstrzygnijKonflikt('scal'); });
      el.querySelector('#konfliktZdalne').addEventListener('click', function () { rozstrzygnijKonflikt('zdalne'); });
      el.querySelector('#konfliktLokalne').addEventListener('click', function () { rozstrzygnijKonflikt('lokalne'); });
      return;
    }

    if (stanS.tryb === 'gosc' && aktywnyId !== 'ustawienia') {
      el.innerHTML =
        '<div class="banner">' +
          '<div class="banner-title">Tryb tylko do odczytu</div>' +
          '<div class="banner-desc">Podgląd danych. Zapisywanie wymaga tokenu — Ustawienia → Synchronizacja.</div>' +
        '</div>';
      return;
    }

    el.innerHTML = '';
  }

  function fmtCzasBanera(iso) {
    if (!iso) return '?';
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }

  // 'zdalne'/'lokalne' porzucaja bezpowrotnie czyjas prace — apka najpierw pobiera plik
  // z porzucana wersja (ta sama sciezka Blob + <a download> co eksport w Ustawieniach),
  // zeby konfliktu nie dalo sie rozwiazac tak, zeby cos przepadlo na zawsze.
  function pobierzPlikJSON(obiekt, nazwaPliku) {
    const tekst = JSON.stringify(obiekt, null, 2);
    const blob = new Blob([tekst], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nazwaPliku;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function rozstrzygnijKonflikt(jak) {
    Dane.rozwiazKonflikt(jak).then(function (wynik) {
      if (wynik.porzucone) {
        const znacznik = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
        pobierzPlikJSON(wynik.porzucone, 'swimapp-konflikt-' + jak + '-' + znacznik + '.json');
      }
    });
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

  // Link dla znajomych: index.html?gist=<ID>. Jesli na tym urzadzeniu juz lezy token —
  // wlasciciel — parametr jest ignorowany: podrzucony link nie moze przestawic jego
  // konfiguracji na cudzy Gist. ID nigdy nie zostaje w pasku adresu ani historii.
  function obsluzLinkGoscia() {
    if (typeof location === 'undefined' || !window.URLSearchParams) return;
    const params = new URLSearchParams(location.search);
    const gist = params.get('gist');
    if (!gist) return;
    history.replaceState({}, '', location.pathname);
    if (Dane.stanSync().tokenOgon) return;
    Dane.ustawKonfiguracje({ idGista: gist }).catch(function () { /* zly link — konfiguracja zostaje pusta */ });
  }

  function init() {
    // Statystyki nie mają jeszcze własnego pliku (dopiero faza 2) —
    // zakładka wyszarzona rejestrowana jest tu wprost.
    zarejestrujWidok({ id: 'statystyki', etykieta: 'Statystyki', aktywny: false });

    obsluzLinkGoscia();
    zmierzSuwak();
    wstrzyknijWersje();

    const gearBtn = document.getElementById('ustawieniaBtn');
    if (gearBtn) gearBtn.addEventListener('click', function () { przelacz('ustawienia'); });

    const pierwszy = widoki.find(function (w) { return dostepny(w); });
    if (pierwszy) przelacz(pierwszy.id);
    else renderNawigacji();

    // Dane przychodzace z Gista (start apki, "Odswiez", wyslanie z drugiego urzadzenia,
    // rozstrzygniecie linku gościa powyzej) trafiaja tu z opoznieniem. Widok sam decyduje,
    // czy i kiedy sie przerysowac (patrz odswiez() w rejestracji kazdego widoku) — nigdy
    // nie robimy tu pelnego remountu, bo zabiloby to np. trening w toku w Trackerze.
    // Wyjatek: jesli tryb zmienil sie tak, ze biezacy widok przestal byc dostepny
    // (np. link gościa doszedl, gdy uzytkownik juz stal na Trackerze), przelaczamy go.
    Dane.nasluchuj(function (e) {
      const biezacy = znajdzWidok(aktywnyId);
      if (biezacy && !dostepny(biezacy)) {
        const zamiennik = widoki.find(function (w) { return dostepny(w); });
        if (zamiennik) { przelacz(zamiennik.id); return; }
      }
      if (biezacy && biezacy.odswiez) biezacy.odswiez();
      renderNawigacji();
      renderSyncBanner();
    });

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

  return { zarejestrujWidok, kopiujDoSchowka, przerysuj };
})();
