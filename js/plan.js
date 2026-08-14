window.Plan = (function () {
  // ===== PLAN WBUDOWANY (fabryczny) =====
  // Uzywany, dopoki uzytkownik nie zaimportuje wlasnego planu (Ustawienia -> Plan
  // treningowy). Aktywny plan zyje w dok.plan.definicja (js/dane.js) - patrz aktywny().
  // Nowe id importowanego planu = nowy, pusty zestaw odhaczen; stary postep zostaje
  // zachowany w dane.json pod starym kluczem (nic nie ginie).
  // Widok nie zaklada 16 tygodni ani wariantow A/B - liczba faz, blokow,
  // tygodni w bloku i treningow w tygodniu jest dowolna.
  // Sumy dystansow sa LICZONE ze skladnikow (funkcja suma), nie przepisywane.

  const WBUDOWANY = {
    id: 'plan-16t-50m',
    nazwa: 'Plan 16-tygodniowy',
    podtytul: 'Basen 50 m · 2× w tygodniu · cel: 1000 m bez przerwy',

    zasady: [
      {
        tytul: 'Metoda 80/20',
        tresc: 'Przez 80% czasu płyniesz wolno — w strefie tlenowej, w tempie, w którym można swobodnie rozmawiać. Pozostałe 20% to praca z wyższą intensywnością.'
      },
      {
        tytul: 'Tempo musi być naprawdę wolne',
        tresc: 'Tempo bazowe 2:10–2:20/100 m. Jeśli po 400 m nie możesz swobodnie porozmawiać — płyniesz za szybko.'
      },
      {
        tytul: 'Przerwy są częścią treningu',
        tresc: 'Trzymaj się dokładnie podanego czasu przerwy. Krótkie serie mają zlewać się w jeden długi wysiłek tlenowy, a nie w serię odpoczynków.'
      },
      {
        tytul: 'Nie zmieniaj planu',
        tresc: 'Trzymaj się tej samej struktury przez cały blok. Adaptacje tlenowe wymagają minimum 6–8 tygodni stałego bodźcowania — zmiana co miesiąc kasuje postęp.'
      },
      {
        tytul: 'Rozkład tygodnia',
        tresc: 'Optymalnie 2–3 dni przerwy między treningami (np. wtorek i piątek). Jeśli trenujesz dwa dni z rzędu: pierwszego dnia Trening B, drugiego Trening A. Trzeci trening w tygodniu — zawsze jako powtórzenie Treningu B, nigdy A.'
      }
    ],

    fazy: [
      {
        nazwa: 'Faza 1 — budowanie bazy tlenowej',
        cel: 'Wydłużenie dystansu bez przerwy do 800–1000 m. Tempo komfortowe przez cały czas.',
        test: 'Przepłyń 600 m bez przerwy w komfortowym tempie. Dajesz radę bez zadyszki — przechodzisz do Fazy 2. Jeśli nie — powtórz tygodnie 7–8.',
        bloki: [
          {
            tygodnie: [1, 2],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 4, dystans: 200 }, tempo: '2:15/100m', przerwa: 45, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 8, dystans: 100 }, tempo: '2:05/100m', przerwa: 20, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [3, 4],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 5, dystans: 200 }, tempo: '2:15/100m', przerwa: 45, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 10, dystans: 100 }, tempo: '2:05/100m', przerwa: 20, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [5, 6],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 6, dystans: 200 }, tempo: '2:10/100m', przerwa: 40, schlodzenie: 100, uwaga: 'tempo lekko rośnie' },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 8, dystans: 150 }, tempo: '2:05/100m', przerwa: 25, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [7, 8],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 4, dystans: 300 }, tempo: '2:10/100m', przerwa: 40, schlodzenie: 100, uwaga: 'dłuższe odcinki' },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 6, dystans: 200 }, tempo: '2:05/100m', przerwa: 25, schlodzenie: 100, uwaga: null }
            ]
          }
        ]
      },
      {
        nazwa: 'Faza 2 — wydłużanie ciągłych odcinków',
        cel: 'Przepłynąć 1000 m bez przerwy w tempie ~2:05/100 m. Serie dłuższe, przerwy krótsze.',
        test: 'Przepłyń 1000 m bez przerwy w komfortowym tempie (~2:05/100 m). Dajesz radę — cel osiągnięty. Kolejny krok: 1500 m ciągiem.',
        bloki: [
          {
            tygodnie: [9, 10],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 3, dystans: 400 }, tempo: '2:10/100m', przerwa: 60, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 6, dystans: 150 }, tempo: '2:00/100m', przerwa: 20, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [11, 12],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 4, dystans: 400 }, tempo: '2:10/100m', przerwa: 55, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 8, dystans: 150 }, tempo: '2:00/100m', przerwa: 20, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [13, 14],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 2, dystans: 600 }, tempo: '2:10/100m', przerwa: 60, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 6, dystans: 200 }, tempo: '2:00/100m', przerwa: 25, schlodzenie: 100, uwaga: null }
            ]
          },
          {
            tygodnie: [15, 16],
            treningi: [
              { wariant: 'A', nazwa: 'Długie serie', rozgrzewka: 200, seria: { powtorzenia: 2, dystans: 800 }, tempo: '2:05/100m', przerwa: 75, schlodzenie: 100, uwaga: null },
              { wariant: 'B', nazwa: 'Krótkie interwały', rozgrzewka: 200, seria: { powtorzenia: 8, dystans: 200 }, tempo: '2:00/100m', przerwa: 20, schlodzenie: 100, uwaga: null }
            ]
          }
        ]
      }
    ]
  };

  // Aktywna definicja planu: zaimportowana (dok.plan.definicja) albo wbudowana.
  // Wolno tu wolac Dane.wczytaj() - to publiczne API warstwy danych (Dane.js laduje
  // sie przed plan.js w index.html), nie bezposrednie dotkniecie localStorage/fetch.
  function aktywny() {
    const dok = Dane.wczytaj();
    return dok.plan.definicja || WBUDOWANY;
  }

  function aktywnyId() {
    return aktywny().id;
  }

  // Rozwija bloki na pojedyncze tygodnie. Test fazy dopina sie do jej ostatniego tygodnia.
  function tygodnie(definicja) {
    const def = definicja || aktywny();
    const wynik = [];
    def.fazy.forEach(function (faza, indeksFazy) {
      faza.bloki.forEach(function (blok) {
        blok.tygodnie.forEach(function (numer) {
          wynik.push({
            numer: numer,
            indeksFazy: indeksFazy,
            nazwaFazy: faza.nazwa,
            treningi: blok.treningi,
            testPoTygodniu: null
          });
        });
      });
      if (faza.test && wynik.length) wynik[wynik.length - 1].testPoTygodniu = faza.test;
    });
    return wynik;
  }

  function suma(trening) {
    return trening.rozgrzewka + trening.seria.powtorzenia * trening.seria.dystans + trening.schlodzenie;
  }

  function kluczTreningu(numerTygodnia, wariant) {
    return 'w' + numerTygodnia + wariant;
  }

  // Waliduje ksztalt zaimportowanego planu. Nie jest to obrona przed zlosliwym plikiem,
  // tylko lapanie literowek/brakow w pliku generowanym recznie albo przez Claude z PDF-a.
  // Zwraca maksymalnie 5 pierwszych bledow, zeby nie zalac .err-msg dlugim komunikatem.
  function waliduj(obiekt) {
    const bledy = [];
    function dodaj(msg) { bledy.push(msg); }
    function jestString(v) { return typeof v === 'string' && v.length > 0; }
    function jestStringLubNull(v) { return v === null || typeof v === 'string'; }
    function jestLiczba(v) { return typeof v === 'number' && !isNaN(v); }

    if (!obiekt || typeof obiekt !== 'object') {
      return { ok: false, bledy: ['Plik nie zawiera obiektu planu.'] };
    }
    if (!jestString(obiekt.id)) dodaj('Brak pola "id" (albo jest puste).');
    if (!jestString(obiekt.nazwa)) dodaj('Brak pola "nazwa".');
    if (!jestString(obiekt.podtytul)) dodaj('Brak pola "podtytul".');
    if (!Array.isArray(obiekt.zasady)) {
      dodaj('Pole "zasady" musi byc tablica.');
    } else {
      obiekt.zasady.forEach(function (z, i) {
        if (!z || !jestString(z.tytul) || !jestString(z.tresc)) {
          dodaj('Zasada ' + (i + 1) + ': wymaga pol "tytul" i "tresc".');
        }
      });
    }

    const numeryTygodni = new Set();
    if (!Array.isArray(obiekt.fazy) || obiekt.fazy.length === 0) {
      dodaj('Pole "fazy" musi byc niepusta tablica.');
    } else {
      obiekt.fazy.forEach(function (faza, iFaza) {
        const etykFaza = 'Faza ' + (iFaza + 1);
        if (!faza || !jestString(faza.nazwa)) dodaj(etykFaza + ': brak pola "nazwa".');
        if (!faza || !jestString(faza.cel)) dodaj(etykFaza + ': brak pola "cel".');
        if (!faza || !jestStringLubNull(faza.test)) dodaj(etykFaza + ': pole "test" musi byc tekstem albo null.');
        if (!faza || !Array.isArray(faza.bloki) || faza.bloki.length === 0) {
          dodaj(etykFaza + ': pole "bloki" musi byc niepusta tablica.');
          return;
        }
        faza.bloki.forEach(function (blok, iBlok) {
          const etykBlok = etykFaza + ', blok ' + (iBlok + 1);
          if (!blok || !Array.isArray(blok.tygodnie) || blok.tygodnie.length === 0) {
            dodaj(etykBlok + ': pole "tygodnie" musi byc niepusta tablica liczb.');
          } else {
            blok.tygodnie.forEach(function (numer) {
              if (!jestLiczba(numer)) {
                dodaj(etykBlok + ': "' + numer + '" nie jest liczba tygodnia.');
              } else if (numeryTygodni.has(numer)) {
                dodaj(etykBlok + ': tydzien ' + numer + ' powtarza sie w innym bloku.');
              } else {
                numeryTygodni.add(numer);
              }
            });
          }
          if (!blok || !Array.isArray(blok.treningi) || blok.treningi.length === 0) {
            dodaj(etykBlok + ': pole "treningi" musi byc niepusta tablica.');
            return;
          }
          blok.treningi.forEach(function (t, iTr) {
            const etykTr = etykBlok + ', trening ' + (t && t.wariant ? t.wariant : iTr + 1);
            if (!t || !jestString(t.wariant)) dodaj(etykTr + ': brak pola "wariant".');
            if (!t || !jestString(t.nazwa)) dodaj(etykTr + ': brak pola "nazwa".');
            if (!t || !jestString(t.tempo)) dodaj(etykTr + ': brak pola "tempo".');
            if (!t || !jestLiczba(t.rozgrzewka)) dodaj(etykTr + ': pole "rozgrzewka" musi byc liczba.');
            if (!t || !jestLiczba(t.schlodzenie)) dodaj(etykTr + ': pole "schlodzenie" musi byc liczba.');
            if (!t || !jestLiczba(t.przerwa)) dodaj(etykTr + ': pole "przerwa" musi byc liczba.');
            if (!t || !jestStringLubNull(t.uwaga)) dodaj(etykTr + ': pole "uwaga" musi byc tekstem albo null.');
            if (!t || !t.seria || !jestLiczba(t.seria.powtorzenia) || !jestLiczba(t.seria.dystans)) {
              dodaj(etykTr + ': pole "seria" wymaga liczbowych "powtorzenia" i "dystans".');
            }
          });
        });
      });
    }

    if (bledy.length > 5) {
      const reszta = bledy.length - 5;
      return { ok: false, bledy: bledy.slice(0, 5).concat(['…i ' + reszta + ' dalszych bledow.']) };
    }
    return { ok: bledy.length === 0, bledy: bledy };
  }

  return {
    WBUDOWANY: WBUDOWANY,
    aktywny: aktywny,
    aktywnyId: aktywnyId,
    tygodnie: tygodnie,
    suma: suma,
    kluczTreningu: kluczTreningu,
    waliduj: waliduj
  };
})();
