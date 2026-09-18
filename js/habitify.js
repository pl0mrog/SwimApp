window.Habitify = (function () {
  const API = 'https://api.habitify.me/v2';
  const NAZWA_NAWYKU = 'Pływanie';
  const JEDNOSTKA = 'm';
  const LIMIT_MS = 15000;
  const KLUCZ = 'swim.habitify.klucz';
  const KLUCZ_NAWYK = 'swim.habitify.nawyk';
  const KLUCZ_OSTATNIA = 'swim.habitify.ostatnia';

  function ogonKlucza(k) {
    return k.length > 4 ? k.slice(-4) : k;
  }

  function normalizujKlucz(k) {
    let v = String(k || '').trim();
    v = v.replace(/^["']|["']$/g, '');
    return v;
  }

  function fmtDataPl(iso) {
    return iso.slice(8, 10) + '.' + iso.slice(5, 7) + '.' + iso.slice(0, 4);
  }

  function dekapitalizuj(s) {
    return s.length ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  }

  // ===== magazyn lokalny =====

  function czytaj(klucz) {
    try { return localStorage.getItem(klucz); } catch (e) { return null; }
  }
  function zapisz(klucz, wartosc) {
    try { localStorage.setItem(klucz, wartosc); } catch (e) { /* niedostepny */ }
  }
  function usunWpis(klucz) {
    try { localStorage.removeItem(klucz); } catch (e) { /* niedostepny */ }
  }

  function czytajNawyk() {
    const surowy = czytaj(KLUCZ_NAWYK);
    if (!surowy) return null;
    try { return JSON.parse(surowy); } catch (e) { return null; }
  }

  function czytajOstatnia() {
    const surowa = czytaj(KLUCZ_OSTATNIA);
    if (!surowa) return null;
    try { return JSON.parse(surowa); } catch (e) { return null; }
  }

  function zapiszOstatnia(wpis) {
    zapisz(KLUCZ_OSTATNIA, JSON.stringify(wpis));
  }

  let wysylkaWToku = false;

  function stan() {
    const klucz = czytaj(KLUCZ);
    const nawyk = czytajNawyk();
    return {
      skonfigurowane: !!klucz && !!(nawyk && nawyk.id),
      nazwaNawyku: nawyk ? nawyk.nazwa : null,
      kluczOgon: klucz ? ogonKlucza(klucz) : null,
      ostatnia: czytajOstatnia(),
      wToku: wysylkaWToku
    };
  }

  // ===== siec: jedyne miejsce w projekcie poza dane.js z fetch() =====
  // Limit 15 s na CALA operacje (odczyt + ewentualny zapis lacznie w wyslijDystans),
  // nie na kazde zapytanie osobno — obietnica dla uzytkownika: "najpozniej po 15 s
  // wiesz, co sie stalo". Sygnal obejmuje tez czytanie tresci odpowiedzi.

  function nowyLimit() {
    const kontroler = new AbortController();
    const timer = setTimeout(function () { kontroler.abort(); }, LIMIT_MS);
    return { signal: kontroler.signal, zwolnij: function () { clearTimeout(timer); } };
  }

  async function zapytanie(klucz, sciezka, opcje, signal) {
    opcje = opcje || {};
    let resp;
    try {
      resp = await fetch(API + sciezka, {
        method: opcje.method || 'GET',
        headers: { 'X-API-Key': klucz, 'Content-Type': 'application/json' },
        body: opcje.body ? JSON.stringify(opcje.body) : undefined,
        signal: signal
      });
    } catch (e) {
      return { status: e.name === 'AbortError' ? 'timeout' : 'brak-sieci' };
    }
    // status jest juz znany — nawet jesli tresc sie zatnie albo nie jest JSON-em,
    // oddajemy go (dla POST liczy sie sam kod 2xx)
    let json = null;
    try { json = await resp.json(); } catch (e) { /* cialo puste, nie-JSON albo przerwane limitem */ }
    return { status: String(resp.status), http: resp.status, body: json };
  }

  // kontekst 'klucz' = weryfikacja w Ustawieniach, 'wysylka' = baner w Trackerze —
  // te same kody HTTP tlumacza sie na inny, trafniejszy komunikat w kazdym miejscu.
  function komunikatBledu(w, kontekst) {
    if (w.status === 'timeout') return 'Habitify nie odpowiedział w 15 s.';
    if (w.status === 'brak-sieci') return 'Brak połączenia z internetem.';
    if (w.status === '401') {
      return kontekst === 'klucz' ? 'Habitify odrzucił klucz.' : 'Klucz Habitify nieaktualny — wklej nowy w Ustawieniach.';
    }
    if (w.status === '404' && kontekst === 'wysylka') return 'Nie ma już nawyku „Pływanie” — zapisz klucz ponownie w Ustawieniach.';
    if (w.status === '400' || w.status === '422') return 'Habitify odrzucił dane (kod ' + w.http + ').';
    if (w.status === '429') return 'Habitify chwilowo blokuje zapytania.';
    if (w.http && w.http >= 500) return 'Błąd po stronie Habitify (kod ' + w.http + ').';
    return 'Błąd Habitify (kod ' + (w.http || w.status) + ').';
  }

  // ===== procedura A: zapis klucza (Ustawienia) =====

  async function ustawKlucz(surowyKlucz) {
    const klucz = normalizujKlucz(surowyKlucz);
    if (!klucz) throw new Error('Wklej klucz API.');

    const limit = nowyLimit();
    let w;
    try { w = await zapytanie(klucz, '/habits', null, limit.signal); } finally { limit.zwolnij(); }
    if (w.status !== '200') throw new Error(komunikatBledu(w, 'klucz'));

    const lista = (w.body && Array.isArray(w.body.data)) ? w.body.data : null;
    if (!lista) throw new Error('Nieoczekiwana odpowiedź Habitify.');

    const naz = NAZWA_NAWYKU.trim().toLowerCase();
    const nawyk = lista.find(function (h) {
      return h && typeof h.name === 'string' && h.name.trim().toLowerCase() === naz;
    });
    if (!nawyk) throw new Error('W Habitify nie ma nawyku „' + NAZWA_NAWYKU + '”.');

    zapisz(KLUCZ, klucz);
    zapisz(KLUCZ_NAWYK, JSON.stringify({ id: nawyk.id, nazwa: nawyk.name.trim() }));
  }

  function usunKlucz() {
    usunWpis(KLUCZ);
    usunWpis(KLUCZ_NAWYK);
    usunWpis(KLUCZ_OSTATNIA);
  }

  // ===== procedura B: wysyłka dystansu (baner w Trackerze) =====

  async function wyslijDystans(data, metry) {
    if (wysylkaWToku) return { wynik: 'blad', komunikat: '⚠ Poprzednia wysyłka jeszcze trwa.' };
    const klucz = czytaj(KLUCZ);
    const nawyk = czytajNawyk();
    if (!klucz || !nawyk || !nawyk.id) {
      return { wynik: 'blad', komunikat: '⚠ Nie wysłano — Habitify nie jest skonfigurowane.' };
    }

    wysylkaWToku = true;
    zapiszOstatnia({ czas: new Date().toISOString(), faza: 'w-toku' });
    const limit = nowyLimit();
    let wynik;
    // try/finally: cokolwiek sie stanie, funkcja ZAWSZE oddaje wynik i zwalnia blokade —
    // inaczej baner w Trackerze zawislby na "Wysylam…".
    try {
      wynik = await odczytajIZapisz(klucz, nawyk.id, data, metry, limit.signal);
    } catch (e) {
      wynik = { wynik: 'blad', komunikat: '⚠ Nieoczekiwany błąd — sprawdź w apce Habitify, czy wpis doszedł.' };
    } finally {
      limit.zwolnij();
      wysylkaWToku = false;
    }
    zapiszOstatnia({ czas: new Date().toISOString(), faza: 'wynik', wynik: wynik.wynik, komunikat: wynik.komunikat });
    return wynik;
  }

  async function odczytajIZapisz(klucz, idNawyku, data, metry, signal) {
    const odczyt = await zapytanie(klucz, '/habits/' + idNawyku + '/statistics?startDate=' + data + '&endDate=' + data, null, signal);
    if (odczyt.status !== '200') {
      const tekst = odczyt.status === 'timeout'
        ? '⚠ Nie wysłano — Habitify nie odpowiedział w 15 s. Dodaj ręcznie w apce Habitify.'
        : '⚠ Nie wysłano — ' + dekapitalizuj(komunikatBledu(odczyt, 'wysylka')) + ' Dodaj ręcznie w apce Habitify.';
      return { wynik: 'blad', komunikat: tekst };
    }

    const postep = odczyt.body && odczyt.body.data && Array.isArray(odczyt.body.data.dailyProgress)
      ? odczyt.body.data.dailyProgress
      : null;
    if (!postep) {
      return { wynik: 'blad', komunikat: '⚠ Nie wysłano — nieoczekiwana odpowiedź Habitify. Dodaj ręcznie w apce Habitify.' };
    }

    // Pytamy o jeden dzien (startDate = endDate), wiec sumujemy wszystko, co przyszlo,
    // bez porownywania dat — format/strefa pola `date` w odpowiedzi nie maja znaczenia.
    const suma = postep.reduce(function (s, d) { return s + (Number(d && d.totalLog) || 0); }, 0);
    if (suma > 0) {
      return {
        wynik: 'juz-jest',
        komunikat: '✓ W Habitify jest już ' + Model.fmtMetry(suma) + ' z ' + fmtDataPl(data) + ' — nie wysyłam drugi raz.'
      };
    }

    const zapisWynik = await zapytanie(klucz, '/habits/' + idNawyku + '/logs', {
      method: 'POST',
      body: { unitSymbol: JEDNOSTKA, value: metry, targetDate: data }
    }, signal);

    if (zapisWynik.http && zapisWynik.http >= 200 && zapisWynik.http < 300) {
      return {
        wynik: 'dodano',
        komunikat: '✓ Dodano ' + Model.fmtMetry(metry) + ' do „' + NAZWA_NAWYKU + '” (' + fmtDataPl(data) + ').'
      };
    }
    if (zapisWynik.status === 'timeout' || zapisWynik.status === 'brak-sieci') {
      return {
        wynik: 'niepewny',
        komunikat: '⚠ Nie wiadomo, czy wpis doszedł — Habitify nie odpowiedział w 15 s. Sprawdź w apce Habitify.'
      };
    }
    return {
      wynik: 'blad',
      komunikat: '⚠ Nie wysłano — ' + dekapitalizuj(komunikatBledu(zapisWynik, 'wysylka')) + ' Dodaj ręcznie w apce Habitify.'
    };
  }

  return { stan: stan, ustawKlucz: ustawKlucz, usunKlucz: usunKlucz, wyslijDystans: wyslijDystans };
})();
