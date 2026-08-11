window.Plan = (function () {
  // ===== PODMIANA PLANU =====
  // Zmieniasz plan? Podmien DANE ponizej i nadaj nowe `id`.
  // Nowe `id` = nowy, pusty zestaw odhaczen; stary postep zostaje zachowany
  // w dane.json pod starym kluczem (nic nie ginie).
  // Widok nie zaklada 16 tygodni ani wariantow A/B - liczba faz, blokow,
  // tygodni w bloku i treningow w tygodniu jest dowolna.
  // Sumy dystansow sa LICZONE ze skladnikow (funkcja suma), nie przepisywane.

  const DANE = {
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

  // Rozwija bloki na pojedyncze tygodnie. Test fazy dopina sie do jej ostatniego tygodnia.
  function tygodnie() {
    const wynik = [];
    DANE.fazy.forEach(function (faza, indeksFazy) {
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

  return {
    DANE: DANE,
    id: DANE.id,
    tygodnie: tygodnie,
    suma: suma,
    kluczTreningu: kluczTreningu
  };
})();
