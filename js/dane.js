window.Dane = (function () {
  const KLUCZ = 'swim.dane';
  const KLUCZ_GIST = 'swim.sync.gist';
  const KLUCZ_TOKEN = 'swim.sync.token';
  const KLUCZ_STAN = 'swim.sync.stan';
  const SCHEMA_VERSION = 1;
  const API = 'https://api.github.com/gists/';
  const NAZWA_PLIKU = 'dane.json';
  const DEBOUNCE_MS = 1500;
  const BACKOFF = [2000, 5000, 15000, 60000];

  const KOMUNIKATY = {
    '401': 'Token nieprawidłowy, cofnięty lub wygasły. Zapis wyłączony — apka nadal czyta dane. Wklej nowy token.',
    '403-limit': 'GitHub chwilowo blokuje zapytania (limit). Spróbuję ponownie za chwilę.',
    '403-uprawnienia': 'Token nie ma uprawnienia „Gists: Read and write". Wygeneruj nowy z tym uprawnieniem.',
    '404': 'Nie ma Gista o tym ID. Sprawdź, czy skopiowałeś całe ID, a nie adres strony.',
    '422': 'GitHub odrzucił zapis (błąd formatu). Zgłoś to — dane są bezpieczne na urządzeniu.',
    '5xx': 'GitHub ma awarię. Zmiany czekają na urządzeniu, spróbuję ponownie za chwilę.',
    'brak-sieci': 'Brak połączenia. Zmiany są zapisane na tym urządzeniu i pójdą do Gista, gdy wróci internet.',
    'wersja': 'Dane zapisano nowszą wersją apki. Zaktualizuj SwimApp na tym urządzeniu — do tego czasu tylko odczyt.',
    'zdalne-uszkodzone': 'Plik w Giście nie wygląda na dane SwimApp. Nic nie nadpisuję.',
    'inny': 'Błąd GitHub.'
  };

  // ===== dokument: ksztalt, walidacja, dopelnianie (bez zmian od v0.9.9 + pole plan.definicja) =====

  function dokumentStartowy() {
    return {
      schemaVersion: SCHEMA_VERSION,
      ostatnia_modyfikacja: new Date().toISOString(),
      ustawienia: { ostatniBasen: 25 },
      plan: { aktywnyPlan: null, definicja: null, wykonane: {} },
      sesje: []
    };
  }

  // Dokumenty zapisane przed 0.5.0 nie maja pola `plan`. Dopelniamy je przy odczycie
  // zamiast podbijac schemaVersion — nie ma tu zadnej transformacji danych do zrobienia,
  // tylko nowe, opcjonalne pole.
  function dopelnij(dok) {
    if (!dok.plan || typeof dok.plan !== 'object') dok.plan = { aktywnyPlan: null, definicja: null, wykonane: {} };
    if (!dok.plan.wykonane || typeof dok.plan.wykonane !== 'object') dok.plan.wykonane = {};
    if (dok.plan.aktywnyPlan === undefined) dok.plan.aktywnyPlan = null;
    if (dok.plan.definicja === undefined) dok.plan.definicja = null;
    return dok;
  }

  function poprawny(dok) {
    return !!dok && typeof dok === 'object' &&
      typeof dok.schemaVersion === 'number' &&
      Array.isArray(dok.sesje) &&
      !!dok.ustawienia && typeof dok.ustawienia === 'object';
  }

  function klon(dok) {
    return JSON.parse(JSON.stringify(dok));
  }

  // Scalanie dwoch dokumentow: sesje po id z dedupe (istniejace nie sa nadpisywane),
  // odhaczenia planu addytywnie, aktywnyPlan tylko jesli w docelowym jest jeszcze pusty.
  // Uzywane i przez importJSON (plik z dysku), i przez rozwiazKonflikt('scal') (Gist).
  function scal(docelowy, zrodlo) {
    const istniejaceId = new Set(docelowy.sesje.map(function (s) { return s.id; }));
    const zrodloweSesje = Array.isArray(zrodlo.sesje) ? zrodlo.sesje : [];
    const noweSesje = zrodloweSesje.filter(function (s) { return !istniejaceId.has(s.id); });
    docelowy.sesje = docelowy.sesje.concat(noweSesje);

    let noweOdhaczenia = 0;
    const zrodloweWykonane = (zrodlo.plan && zrodlo.plan.wykonane && typeof zrodlo.plan.wykonane === 'object') ? zrodlo.plan.wykonane : {};
    Object.keys(zrodloweWykonane).forEach(function (idPlanu) {
      const z = zrodloweWykonane[idPlanu];
      if (!z || typeof z !== 'object') return;
      if (!docelowy.plan.wykonane[idPlanu]) docelowy.plan.wykonane[idPlanu] = {};
      const cel = docelowy.plan.wykonane[idPlanu];
      Object.keys(z).forEach(function (klucz) {
        if (cel[klucz] === undefined) {
          cel[klucz] = z[klucz];
          noweOdhaczenia++;
        }
      });
    });
    if (!docelowy.plan.aktywnyPlan && zrodlo.plan && zrodlo.plan.aktywnyPlan) {
      docelowy.plan.aktywnyPlan = zrodlo.plan.aktywnyPlan;
    }

    return {
      dodano: noweSesje.length,
      pominieto: zrodloweSesje.length - noweSesje.length,
      odhaczenia: noweOdhaczenia
    };
  }

  // ===== magazyn lokalny =====

  function czytajLokalnie() {
    let surowy;
    try {
      surowy = localStorage.getItem(KLUCZ);
    } catch (e) {
      return dokumentStartowy();
    }
    if (!surowy) return dokumentStartowy();
    let dok;
    try {
      dok = JSON.parse(surowy);
    } catch (e) {
      return dokumentStartowy();
    }
    return poprawny(dok) ? dopelnij(dok) : dokumentStartowy();
  }

  // Dokument w pamieci, hydratowany z localStorage przy wykonaniu tego IIFE — a wiec
  // przed DOMContentLoaded, przed pierwszym montuj() jakiegokolwiek widoku. wczytaj()
  // zawsze zwraca KLON tego obiektu (patrz uzasadnienie w planie etapu C) — mutacja
  // wyniku wczytaj() bez zapisz() nie moze miec zadnego efektu ubocznego, tak jak dzis.
  let dokPamiec = czytajLokalnie();

  function czytajStanLokalny() {
    try {
      const s = localStorage.getItem(KLUCZ_STAN);
      if (s) return JSON.parse(s);
    } catch (e) { /* ignoruj — wracamy do pustego stanu */ }
    return { znacznikZdalny: null, etag: null, ostatniOdczyt: null, ostatniZapis: null };
  }

  function zapiszStanLokalny() {
    try { localStorage.setItem(KLUCZ_STAN, JSON.stringify(stan)); } catch (e) { /* localStorage niedostepny */ }
  }

  let stan = czytajStanLokalny();

  function czytajKonfig() {
    let idGista = null;
    let token = null;
    try { idGista = localStorage.getItem(KLUCZ_GIST) || null; } catch (e) { /* niedostepny */ }
    try { token = localStorage.getItem(KLUCZ_TOKEN) || null; } catch (e) { /* niedostepny */ }
    return { idGista: idGista, token: token };
  }

  function zapiszKonfig(cfg) {
    try {
      if (cfg.idGista) localStorage.setItem(KLUCZ_GIST, cfg.idGista); else localStorage.removeItem(KLUCZ_GIST);
      if (cfg.token) localStorage.setItem(KLUCZ_TOKEN, cfg.token); else localStorage.removeItem(KLUCZ_TOKEN);
    } catch (e) { /* niedostepny */ }
  }

  function normalizujToken(t) {
    let v = String(t).trim();
    v = v.replace(/^Bearer\s+/i, '');
    v = v.replace(/^["']|["']$/g, '');
    return v;
  }

  function normalizujId(id) {
    const v = String(id).trim();
    const dopasowanie = v.match(/([0-9a-f]{20,})/i);
    return dopasowanie ? dopasowanie[1] : v;
  }

  function ogonTokenu(token) {
    return token.length > 4 ? token.slice(-4) : token;
  }

  // ===== zapis lokalny — wewnetrzny, z kontrola stemplowania =====

  // stempluj:false jest uzywane WYLACZNIE przy adopcji danych z Gista (patrz odswiez()) —
  // gdyby adopcja przestemplowywala ostatnia_modyfikacja, kazde pobranie rozjezdzaloby
  // znacznikZdalny od lokalnego i apka wpadalaby w wieczny falszywy konflikt po starcie.
  function zapiszLokalnie(dok, opcje) {
    opcje = opcje || {};
    if (!poprawny(dok)) {
      throw new Error('Niepoprawny dokument — zapis odrzucony.');
    }
    if (opcje.stempluj !== false) {
      dok.ostatnia_modyfikacja = new Date().toISOString();
    }
    dokPamiec = dok;
    try { localStorage.setItem(KLUCZ, JSON.stringify(dok)); } catch (e) { /* dane zostaja tylko w pamieci */ }
    if (opcje.wypchnij) zaplanujWypchniecie(DEBOUNCE_MS);
  }

  // ===== publiczne, synchroniczne API (nietkniete w sygnaturze wzgledem v0.9.9) =====

  function wczytaj() {
    return klon(dokPamiec);
  }

  function zapisz(dokument) {
    zapiszLokalnie(dokument, { stempluj: true, wypchnij: true });
  }

  function eksportJSON() {
    return JSON.stringify(wczytaj(), null, 2);
  }

  function importJSON(tekst) {
    let dok;
    try {
      dok = JSON.parse(tekst);
    } catch (e) {
      throw new Error('Plik nie jest poprawnym JSON-em.');
    }
    if (!poprawny(dok)) {
      throw new Error('Plik nie ma poprawnej struktury danych SwimApp.');
    }
    const aktualny = wczytaj();
    const wynik = scal(aktualny, dok);
    zapisz(aktualny);
    return wynik;
  }

  // ===== tryb i status =====

  function tryb() {
    const cfg = czytajKonfig();
    if (!cfg.idGista) return 'lokalny';
    return cfg.token ? 'wlasciciel' : 'gosc';
  }

  function niewyslane() {
    return tryb() === 'wlasciciel' && dokPamiec.ostatnia_modyfikacja !== stan.znacznikZdalny;
  }

  let wTrakcieSieci = false;
  let stanBledu = null;
  let konfliktAktywny = null;

  function stanSync() {
    const cfg = czytajKonfig();
    return {
      tryb: tryb(),
      idGista: cfg.idGista,
      tokenOgon: cfg.token ? ogonTokenu(cfg.token) : null,
      ostatniOdczyt: stan.ostatniOdczyt,
      ostatniZapis: stan.ostatniZapis,
      niewyslane: niewyslane(),
      wTrakcie: wTrakcieSieci,
      blad: stanBledu,
      konflikt: konfliktAktywny ? { zdalnyCzas: konfliktAktywny.zdalny.ostatnia_modyfikacja, lokalnyCzas: konfliktAktywny.lokalny.ostatnia_modyfikacja } : null
    };
  }

  // ===== nasluchiwanie =====

  let sluchacze = [];
  function nasluchuj(fn) { sluchacze.push(fn); }
  function przestanNasluchiwac(fn) { sluchacze = sluchacze.filter(function (f) { return f !== fn; }); }
  function emituj(powod) {
    sluchacze.forEach(function (fn) {
      try { fn({ powod: powod }); } catch (e) { /* subskrybent nie moze wywalic reszty */ }
    });
  }

  // ===== siec: GET / PATCH na Gists API =====
  // Jedyne miejsce w calym projekcie z fetch() — zgodnie z CLAUDE.md, reszta kodu
  // dostaje tylko synchroniczne wczytaj()/zapisz() i asynchroniczne funkcje ponizej.

  function komunikatDlaBledu(w) {
    let kod = w.status;
    if (kod === '403') kod = w.limitWyczerpany ? '403-limit' : '403-uprawnienia';
    return KOMUNIKATY[kod] || KOMUNIKATY.inny;
  }

  async function pobierzZdalnyZ(cfg, uzyjEtag, bezTokenu) {
    if (!cfg.idGista) return { status: 'brak-konfiguracji' };
    const headers = { Accept: 'application/vnd.github+json' };
    if (cfg.token && !bezTokenu) headers.Authorization = 'Bearer ' + cfg.token;
    if (uzyjEtag && stan.etag) headers['If-None-Match'] = stan.etag;

    let resp;
    try {
      resp = await fetch(API + cfg.idGista, { headers: headers, cache: 'no-store' });
    } catch (e) {
      return { status: 'brak-sieci' };
    }

    if (resp.status === 304) return { status: 'bez-zmian' };
    if (resp.status === 401) {
      // Zly/wygasly token psulby tez odczyt (sekretny Gist czyta sie bez auth) —
      // sprobuj raz bez tokenu, zeby gosc/wlasciciel ze zlym tokenem dalej mogl czytac.
      if (cfg.token && !bezTokenu) return pobierzZdalnyZ(cfg, uzyjEtag, true);
      return { status: '401' };
    }
    if (resp.status === 403) {
      return { status: '403', limitWyczerpany: resp.headers.get('x-ratelimit-remaining') === '0' };
    }
    if (resp.status === 404) return { status: '404' };
    if (!resp.ok) return { status: resp.status >= 500 ? '5xx' : 'inny', kodHttp: resp.status };

    let json;
    try { json = await resp.json(); } catch (e) { return { status: 'zdalne-uszkodzone' }; }
    const plik = json.files && json.files[NAZWA_PLIKU];
    if (!plik) return { status: 'puste' };

    let tresc = plik.content || '';
    if (plik.truncated && plik.raw_url) {
      try {
        const rawResp = await fetch(plik.raw_url, { cache: 'no-store' });
        tresc = await rawResp.text();
      } catch (e) {
        return { status: 'brak-sieci' };
      }
    }
    if (!tresc.trim()) return { status: 'puste' };

    let zdalny;
    try { zdalny = JSON.parse(tresc); } catch (e) { return { status: 'zdalne-uszkodzone' }; }
    if (!poprawny(zdalny)) return { status: 'zdalne-uszkodzone' };
    if (zdalny.schemaVersion > SCHEMA_VERSION) return { status: 'wersja' };
    dopelnij(zdalny);

    return { status: 'ok', zdalny: zdalny, etag: resp.headers.get('etag') };
  }

  function pobierzZdalny(uzyjEtag) {
    return pobierzZdalnyZ(czytajKonfig(), uzyjEtag, false);
  }

  async function wyslijZdalnyZ(cfg, dok) {
    if (!cfg.idGista || !cfg.token) return { status: 'brak-konfiguracji' };
    let resp;
    try {
      resp = await fetch(API + cfg.idGista, {
        method: 'PATCH',
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer ' + cfg.token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ files: { 'dane.json': { content: JSON.stringify(dok) } } })
      });
    } catch (e) {
      return { status: 'brak-sieci' };
    }
    if (resp.status === 401) return { status: '401' };
    if (resp.status === 403) return { status: '403', limitWyczerpany: resp.headers.get('x-ratelimit-remaining') === '0' };
    if (resp.status === 404) return { status: '404' };
    if (resp.status === 422) return { status: '422' };
    if (!resp.ok) return { status: resp.status >= 500 ? '5xx' : 'inny', kodHttp: resp.status };
    return { status: 'ok' };
  }

  function wyslijZdalny(dok) {
    return wyslijZdalnyZ(czytajKonfig(), dok);
  }

  // ===== obsluga bledow: komunikat + decyzja o ponowieniu =====

  let probaBackoff = 0;
  let timerBackoff = null;

  function zaplanujPonowienie() {
    clearTimeout(timerBackoff);
    if (probaBackoff >= BACKOFF.length) { probaBackoff = 0; return; }
    const opoznienie = BACKOFF[probaBackoff];
    probaBackoff++;
    timerBackoff = setTimeout(function () { wypchnij(); }, opoznienie);
  }

  function obsluzBlad(w, kontekst) {
    let kod = w.status;
    if (kod === '403') kod = w.limitWyczerpany ? '403-limit' : '403-uprawnienia';
    const backoff = kod === 'brak-sieci' || kod === '5xx' || kod === '403-limit';
    stanBledu = { kod: kod, komunikat: KOMUNIKATY[kod] || KOMUNIKATY.inny, kontekst: kontekst };
    if (kod === '401' || kod === '404') { clearTimeout(timerBackoff); probaBackoff = 0; }
    else if (backoff) zaplanujPonowienie();
    emituj('status-zmieniony');
    return { wynik: kod, komunikat: stanBledu.komunikat };
  }

  // ===== wypychanie (compare-and-swap) i pobieranie =====

  let wysylkaWToku = false;
  let ponowProsba = false;
  let timerDebounce = null;

  function zaplanujWypchniecie(opoznienie) {
    if (tryb() !== 'wlasciciel') return;
    clearTimeout(timerDebounce);
    timerDebounce = setTimeout(function () { wypchnij(); }, opoznienie === undefined ? DEBOUNCE_MS : opoznienie);
  }

  async function wypchnij() {
    if (wysylkaWToku) { ponowProsba = true; return { wynik: 'w-kolejce' }; }
    if (tryb() !== 'wlasciciel') return { wynik: 'brak-konfiguracji' };
    if (konfliktAktywny) return { wynik: 'konflikt' };
    if (!niewyslane()) return { wynik: 'bez-zmian' };

    wysylkaWToku = true;
    wTrakcieSieci = true;
    emituj('status-zmieniony');

    const dokDoWyslania = dokPamiec;
    const pobranie = await pobierzZdalny(false);
    let wynik;

    if (pobranie.status === 'puste') {
      const w = await wyslijZdalny(dokDoWyslania);
      wynik = przetworzWynikWyslania(w, dokDoWyslania);
    } else if (pobranie.status === 'ok') {
      if (pobranie.zdalny.ostatnia_modyfikacja === stan.znacznikZdalny) {
        const w = await wyslijZdalny(dokDoWyslania);
        wynik = przetworzWynikWyslania(w, dokDoWyslania);
      } else {
        konfliktAktywny = { zdalny: pobranie.zdalny, lokalny: klon(dokDoWyslania) };
        wynik = { wynik: 'konflikt' };
        emituj('status-zmieniony');
      }
    } else {
      wynik = obsluzBlad(pobranie, 'wypchniecie');
    }

    wysylkaWToku = false;
    wTrakcieSieci = false;
    emituj('status-zmieniony');
    if (ponowProsba) { ponowProsba = false; zaplanujWypchniecie(0); }
    return wynik;
  }

  function przetworzWynikWyslania(w, dokWyslany) {
    if (w.status === 'ok') {
      stan.znacznikZdalny = dokWyslany.ostatnia_modyfikacja;
      stan.ostatniZapis = new Date().toISOString();
      probaBackoff = 0;
      clearTimeout(timerBackoff);
      zapiszStanLokalny();
      stanBledu = null;
      return { wynik: 'zapisano' };
    }
    return obsluzBlad(w, 'wyslanie');
  }

  let odswiezanieWToku = null;

  function odswiez() {
    if (odswiezanieWToku) return odswiezanieWToku;
    const cfg = czytajKonfig();
    if (!cfg.idGista) return Promise.resolve({ wynik: 'brak-konfiguracji' });
    if (niewyslane()) return wypchnij();

    wTrakcieSieci = true;
    emituj('status-zmieniony');

    odswiezanieWToku = (async function () {
      const pobranie = await pobierzZdalny(true);
      let wynik;
      if (pobranie.status === 'bez-zmian' || pobranie.status === 'puste') {
        stan.ostatniOdczyt = new Date().toISOString();
        zapiszStanLokalny();
        wynik = { wynik: pobranie.status };
      } else if (pobranie.status === 'ok') {
        if (pobranie.zdalny.ostatnia_modyfikacja === stan.znacznikZdalny) {
          wynik = { wynik: 'bez-zmian' };
        } else {
          zapiszLokalnie(pobranie.zdalny, { stempluj: false });
          stan.znacznikZdalny = pobranie.zdalny.ostatnia_modyfikacja;
          stan.etag = pobranie.etag || null;
          wynik = { wynik: 'pobrano' };
          emituj('dane-zmienione');
        }
        stan.ostatniOdczyt = new Date().toISOString();
        zapiszStanLokalny();
      } else {
        wynik = obsluzBlad(pobranie, 'pobranie');
      }
      wTrakcieSieci = false;
      odswiezanieWToku = null;
      emituj('status-zmieniony');
      return wynik;
    })();

    return odswiezanieWToku;
  }

  function wyslij() {
    return wypchnij();
  }

  // ===== konfiguracja =====

  async function ustawKonfiguracje(cfg) {
    const idGista = normalizujId(cfg.idGista || '');
    const token = cfg.token ? normalizujToken(cfg.token) : '';
    if (!idGista) throw new Error('Podaj ID Gista.');

    const proba = { idGista: idGista, token: token };
    const testGet = await pobierzZdalnyZ(proba, false, false);
    if (testGet.status !== 'ok' && testGet.status !== 'puste') {
      throw new Error(komunikatDlaBledu(testGet));
    }

    if (token) {
      const dokDoTestu = testGet.status === 'ok' ? testGet.zdalny : dokPamiec;
      const testPatch = await wyslijZdalnyZ(proba, dokDoTestu);
      if (testPatch.status !== 'ok') {
        throw new Error(komunikatDlaBledu(testPatch));
      }
    }

    zapiszKonfig({ idGista: idGista, token: token || null });
    stanBledu = null;
    konfliktAktywny = null;
    probaBackoff = 0;
    clearTimeout(timerBackoff);

    if (testGet.status === 'ok') {
      zapiszLokalnie(testGet.zdalny, { stempluj: false });
      stan.znacznikZdalny = testGet.zdalny.ostatnia_modyfikacja;
      stan.etag = testGet.etag || null;
    } else if (token) {
      // Gist byl swiezy — PATCH powyzej wlasnie go utworzyl z biezacym dokumentem lokalnym.
      stan.znacznikZdalny = dokPamiec.ostatnia_modyfikacja;
    }
    stan.ostatniOdczyt = new Date().toISOString();
    if (token) stan.ostatniZapis = new Date().toISOString();
    zapiszStanLokalny();

    emituj('dane-zmienione');
    emituj('status-zmieniony');
    return stanSync();
  }

  function usunKonfiguracje() {
    try {
      localStorage.removeItem(KLUCZ_GIST);
      localStorage.removeItem(KLUCZ_TOKEN);
      localStorage.removeItem(KLUCZ_STAN);
    } catch (e) { /* niedostepny */ }
    stan = { znacznikZdalny: null, etag: null, ostatniOdczyt: null, ostatniZapis: null };
    konfliktAktywny = null;
    stanBledu = null;
    clearTimeout(timerDebounce);
    clearTimeout(timerBackoff);
    emituj('status-zmieniony');
  }

  // ===== rozstrzyganie konfliktu =====
  // Baner wywolujacy to API (app.js) musi PRZED wywolaniem pobrac plik z porzucana
  // wersja dla 'lokalne'/'zdalne' — dane.js oddaje tresc porzucanej wersji w wyniku,
  // zeby UI moglo zbudowac plik do pobrania (dane.js nie dotyka DOM/Blob).

  async function rozwiazKonflikt(jak) {
    if (!konfliktAktywny) return { wynik: 'brak-konfliktu' };
    const zdalny = konfliktAktywny.zdalny;
    const lokalny = konfliktAktywny.lokalny;

    if (jak === 'scal') {
      const scalony = klon(lokalny);
      scal(scalony, zdalny);
      zapiszLokalnie(scalony, { stempluj: true });
      stan.znacznikZdalny = zdalny.ostatnia_modyfikacja;
      konfliktAktywny = null;
      zapiszStanLokalny();
      zaplanujWypchniecie(0);
      emituj('dane-zmienione');
      emituj('status-zmieniony');
      return { wynik: 'scalono' };
    }

    if (jak === 'zdalne') {
      zapiszLokalnie(zdalny, { stempluj: false });
      stan.znacznikZdalny = zdalny.ostatnia_modyfikacja;
      konfliktAktywny = null;
      zapiszStanLokalny();
      emituj('dane-zmienione');
      emituj('status-zmieniony');
      return { wynik: 'przyjeto-zdalne', porzucone: lokalny };
    }

    if (jak === 'lokalne') {
      const w = await wyslijZdalny(lokalny);
      if (w.status !== 'ok') return obsluzBlad(w, 'rozwiazanie-konfliktu');
      stan.znacznikZdalny = lokalny.ostatnia_modyfikacja;
      konfliktAktywny = null;
      zapiszStanLokalny();
      emituj('status-zmieniony');
      return { wynik: 'nadpisano', porzucone: zdalny };
    }

    throw new Error('Nieznana decyzja: ' + jak);
  }

  // ===== wyzwalacze tla =====

  function podepnijWyzwalacze() {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', function () { zaplanujWypchniecie(0); });
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') zaplanujWypchniecie(0);
      });
    }
    window.addEventListener('storage', function (e) {
      if (e.key === KLUCZ) {
        dokPamiec = czytajLokalnie();
        emituj('dane-zmienione');
      }
    });
  }

  podepnijWyzwalacze();
  // Pobranie startowe leci asynchronicznie, zwykle za ekranem startowym (~3,5 s) —
  // uzytkownik nie widzi przeskoku tresci (patrz uwagi w planie etapu C).
  if (typeof setTimeout !== 'undefined') setTimeout(function () { odswiez(); }, 0);

  return {
    wczytaj: wczytaj,
    zapisz: zapisz,
    eksportJSON: eksportJSON,
    importJSON: importJSON,
    tryb: tryb,
    stanSync: stanSync,
    ustawKonfiguracje: ustawKonfiguracje,
    usunKonfiguracje: usunKonfiguracje,
    odswiez: odswiez,
    wyslij: wyslij,
    rozwiazKonflikt: rozwiazKonflikt,
    nasluchuj: nasluchuj,
    przestanNasluchiwac: przestanNasluchiwac
  };
})();
