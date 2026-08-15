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
            // etykieta tygodnia w bloku (np. "Odciazenie + sprawdzian"), format v2
            komentarz: blok.komentarz || null,
            testPoTygodniu: null
          });
        });
      });
      if (faza.test && wynik.length) wynik[wynik.length - 1].testPoTygodniu = faza.test;
    });
    return wynik;
  }

  const TYPY_CZESCI = ['rozgrzewka', 'ciagly', 'seria', 'technika', 'schlodzenie'];

  // Normalizuje trening do listy czesci (format v2). Jesli trening ma niepusta
  // tablice `czesci` - mapuje ja (nieznany typ traktowany jak "seria", zeby nowy typ
  // w przyszlosci nie wywalal aplikacji). W przeciwnym razie buduje trzy czesci ze
  // starych pol (v1): rozgrzewka / seria / schlodzenie, pomijajac te o dystans <= 0.
  // To jest jedyne miejsce, ktore zna kompatybilnosc wsteczna - reszta kodu (widok,
  // walidacja ostrzezen) widzi juz tylko liste czesci.
  function czesci(trening) {
    if (Array.isArray(trening.czesci) && trening.czesci.length) {
      return trening.czesci.map(function (c) {
        return {
          typ: TYPY_CZESCI.indexOf(c.typ) !== -1 ? c.typ : 'seria',
          dystans: c.dystans,
          powtorzenia: c.powtorzenia != null ? c.powtorzenia : 1,
          tempo: c.tempo != null ? c.tempo : null,
          tempoZakres: c.tempoZakres != null ? c.tempoZakres : null,
          przerwa: c.przerwa != null ? c.przerwa : 0,
          opis: c.opis != null ? c.opis : null
        };
      });
    }
    const wynik = [];
    if (trening.rozgrzewka > 0) {
      wynik.push({ typ: 'rozgrzewka', dystans: trening.rozgrzewka, powtorzenia: 1, tempo: null, tempoZakres: null, przerwa: 0, opis: null });
    }
    if (trening.seria) {
      wynik.push({
        typ: 'seria',
        dystans: trening.seria.dystans,
        powtorzenia: trening.seria.powtorzenia,
        tempo: trening.tempo != null ? trening.tempo : null,
        tempoZakres: null,
        przerwa: trening.przerwa != null ? trening.przerwa : 0,
        opis: null
      });
    }
    if (trening.schlodzenie > 0) {
      wynik.push({ typ: 'schlodzenie', dystans: trening.schlodzenie, powtorzenia: 1, tempo: null, tempoZakres: null, przerwa: 0, opis: null });
    }
    return wynik;
  }

  // Czesci, ktore dostaja wlasny blok kafelkow w widoku (§2.1 specyfikacji) -
  // rozgrzewka/schlodzenie/technika trafiaja tylko do linijki tekstowej.
  function czesciLiczone(trening) {
    return czesci(trening).filter(function (c) { return c.typ === 'ciagly' || c.typ === 'seria'; });
  }

  // Suma liczona ze skladnikow (wszystkie czesci), nie przepisywana z pliku -
  // dla planow v1 daje ten sam wynik co dawny wzor rozgrzewka + seria + schlodzenie.
  function suma(trening) {
    const wyliczona = czesci(trening).reduce(function (acc, c) { return acc + c.dystans * c.powtorzenia; }, 0);
    if (trening.dystansRazem != null && trening.dystansRazem !== wyliczona) {
      console.warn('Plan.suma(): dystansRazem (' + trening.dystansRazem + ') != wyliczona suma (' +
        wyliczona + ') dla treningu ' + (trening.wariant || trening.nazwa || '?') + '.');
    }
    return wyliczona;
  }

  function formatujCzasKrotki(sek) {
    sek = Math.round(sek);
    const m = Math.floor(sek / 60);
    const s = sek % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  // Przelicza tempo (albo zakres tempa) na inny basen wg korektaTempa.basen25m z pliku
  // planu - dziala i na "2:16/100m" (podmienia tylko liczbe, zostawia "/100m"), i na
  // zakres "2:14–2:20" (podmienia oba konce). Dziala tylko przy przejsciu na 25 m,
  // gdy plan jest napisany pod inny basen i ma zdefiniowana korekte.
  function tempoNaBasen(str, definicja, basen) {
    if (!str || basen !== 25 || !definicja || definicja.basenDocelowy === 25) return str;
    const korekta = definicja.korektaTempa && definicja.korektaTempa.basen25m;
    if (typeof korekta !== 'number') return str;
    return str.replace(/(\d+):([0-5]\d)/g, function (calosc, mm, ss) {
      return formatujCzasKrotki(Number(mm) * 60 + Number(ss) + korekta);
    });
  }

  // Miekkie ostrzezenia przy imporcie (§1.6) - nie blokuja importu, tylko logowane
  // i pokazane w komunikacie. Limit 5, zeby nie zalac komunikatu dlugim tekstem.
  function ostrzezenia(obiekt) {
    const ost = [];
    function dodaj(msg) { if (ost.length < 5) ost.push(msg); }
    if (!obiekt || !Array.isArray(obiekt.fazy)) return ost;

    const numeryTygodni = [];
    obiekt.fazy.forEach(function (faza) {
      if (!faza || !Array.isArray(faza.bloki)) return;
      faza.bloki.forEach(function (blok) {
        if (blok && Array.isArray(blok.tygodnie)) numeryTygodni.push.apply(numeryTygodni, blok.tygodnie);
        if (!blok || !Array.isArray(blok.treningi)) return;
        blok.treningi.forEach(function (t) {
          if (!t) return;
          const cz = czesci(t);
          const wyliczona = cz.reduce(function (acc, c) { return acc + c.dystans * c.powtorzenia; }, 0);
          if (t.dystansRazem != null && t.dystansRazem !== wyliczona) {
            dodaj('Trening ' + (t.wariant || '?') + ': dystansRazem (' + t.dystansRazem +
              ') nie zgadza sie z wyliczona suma (' + wyliczona + ').');
          }
          cz.forEach(function (c) {
            if (c.tempo != null && !/^\d+:[0-5]\d\/100m$/.test(c.tempo)) {
              dodaj('Trening ' + (t.wariant || '?') + ': tempo "' + c.tempo + '" nie pasuje do formatu "M:SS/100m".');
            }
          });
        });
      });
    });

    const posortowane = numeryTygodni.slice().sort(function (a, b) { return a - b; });
    for (let i = 1; i < posortowane.length; i++) {
      if (posortowane[i] !== posortowane[i - 1] && posortowane[i] !== posortowane[i - 1] + 1) {
        dodaj('Numeracja tygodni ma przerwe miedzy ' + posortowane[i - 1] + ' a ' + posortowane[i] + '.');
      }
    }
    return ost;
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
    // Pola opcjonalne formatu v2 - sprawdzane tylko jesli obecne w pliku.
    if (obiekt.basenDocelowy !== undefined && !jestLiczba(obiekt.basenDocelowy)) {
      dodaj('Pole "basenDocelowy" musi byc liczba.');
    }
    if (obiekt.korektaTempa !== undefined) {
      if (!obiekt.korektaTempa || !jestLiczba(obiekt.korektaTempa.basen25m)) {
        dodaj('Pole "korektaTempa.basen25m" musi byc liczba.');
      }
    }
    if (obiekt.sekcje !== undefined) {
      if (!Array.isArray(obiekt.sekcje)) {
        dodaj('Pole "sekcje" musi byc tablica.');
      } else {
        obiekt.sekcje.forEach(function (s, i) {
          if (!s || !jestString(s.tytul) || !jestString(s.tresc)) {
            dodaj('Sekcja ' + (i + 1) + ': wymaga pol "tytul" i "tresc".');
          }
        });
      }
    }
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
            if (!t || !jestStringLubNull(t.uwaga)) dodaj(etykTr + ': pole "uwaga" musi byc tekstem albo null.');
            if (t && Array.isArray(t.czesci) && t.czesci.length) {
              // format v2: liste czesci sprawdzamy zamiast starych pol
              t.czesci.forEach(function (c, iCz) {
                const etykCz = etykTr + ', czesc ' + (iCz + 1);
                if (!c || !jestString(c.typ)) dodaj(etykCz + ': brak pola "typ".');
                if (!c || !jestLiczba(c.dystans) || c.dystans <= 0) dodaj(etykCz + ': pole "dystans" musi byc liczba > 0.');
                if (c && c.powtorzenia != null && (!jestLiczba(c.powtorzenia) || c.powtorzenia <= 0)) {
                  dodaj(etykCz + ': pole "powtorzenia" musi byc liczba > 0.');
                }
                if (c && c.przerwa != null && (!jestLiczba(c.przerwa) || c.przerwa < 0)) {
                  dodaj(etykCz + ': pole "przerwa" musi byc liczba >= 0.');
                }
                if (c && c.tempo != null && !jestString(c.tempo)) dodaj(etykCz + ': pole "tempo" musi byc tekstem.');
              });
            } else {
              if (!t || !jestString(t.tempo)) dodaj(etykTr + ': brak pola "tempo".');
              if (!t || !jestLiczba(t.rozgrzewka)) dodaj(etykTr + ': pole "rozgrzewka" musi byc liczba.');
              if (!t || !jestLiczba(t.schlodzenie)) dodaj(etykTr + ': pole "schlodzenie" musi byc liczba.');
              if (!t || !jestLiczba(t.przerwa)) dodaj(etykTr + ': pole "przerwa" musi byc liczba.');
              if (!t || !t.seria || !jestLiczba(t.seria.powtorzenia) || !jestLiczba(t.seria.dystans)) {
                dodaj(etykTr + ': pole "seria" wymaga liczbowych "powtorzenia" i "dystans".');
              }
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
    czesci: czesci,
    czesciLiczone: czesciLiczone,
    suma: suma,
    tempoNaBasen: tempoNaBasen,
    kluczTreningu: kluczTreningu,
    waliduj: waliduj,
    ostrzezenia: ostrzezenia
  };
})();
