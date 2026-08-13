window.PlanWidok = (function () {
  let kontenerGlobalny = null;
  let rozwinieteFazy = null;
  let zasadyRozwiniete = false;

  function montuj(kontener) {
    kontenerGlobalny = kontener;
    render();
  }

  function odmontuj() {
    if (kontenerGlobalny) kontenerGlobalny.innerHTML = '';
    kontenerGlobalny = null;
  }

  // ===== dane =====

  function wykonane() {
    const dok = Dane.wczytaj();
    return dok.plan.wykonane[Plan.id] || {};
  }

  function ustawWykonanie(klucz, zrobione) {
    const dok = Dane.wczytaj();
    dok.plan.aktywnyPlan = Plan.id;
    if (!dok.plan.wykonane[Plan.id]) dok.plan.wykonane[Plan.id] = {};
    if (zrobione) {
      dok.plan.wykonane[Plan.id][klucz] = {
        data: new Date().toISOString().slice(0, 10),
        sesjaId: null
      };
    } else {
      delete dok.plan.wykonane[Plan.id][klucz];
    }
    Dane.zapisz(dok);
    render();
  }

  // Pierwszy nieodhaczony trening w kolejnosci tydzien -> wariant.
  function nastepnyTrening(lista, zrobione) {
    for (let i = 0; i < lista.length; i++) {
      const tydzien = lista[i];
      for (let j = 0; j < tydzien.treningi.length; j++) {
        const trening = tydzien.treningi[j];
        if (!zrobione[Plan.kluczTreningu(tydzien.numer, trening.wariant)]) {
          return { tydzien: tydzien, trening: trening };
        }
      }
    }
    return null;
  }

  function opisSerii(trening) {
    return trening.seria.powtorzenia + ' × ' + trening.seria.dystans + ' m';
  }

  // ===== render =====

  function render() {
    const kontener = kontenerGlobalny;
    const lista = Plan.tygodnie();
    const zrobione = wykonane();
    const nastepny = nastepnyTrening(lista, zrobione);

    if (rozwinieteFazy === null) {
      rozwinieteFazy = new Set();
      rozwinieteFazy.add(nastepny ? nastepny.tydzien.indeksFazy : 0);
    }

    kontener.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'view-scroll';
    scroll.appendChild(renderNastepny(lista, nastepny));
    scroll.appendChild(renderCalyPlan(lista, zrobione, nastepny));
    scroll.appendChild(renderZasady());
    kontener.appendChild(scroll);
  }

  function renderNastepny(lista, nastepny) {
    const karta = document.createElement('div');
    karta.className = 'card';

    if (!nastepny) {
      karta.innerHTML =
        '<div class="section-label">Plan ukończony</div>' +
        '<p class="hint">Wszystkie treningi z planu „' + Plan.DANE.nazwa + '” są odhaczone. ' +
        'Czas na nowy plan — patrz komentarz na górze <code>js/plan.js</code>.</p>';
      return karta;
    }

    const t = nastepny.trening;
    const tydzien = nastepny.tydzien;

    karta.innerHTML =
      '<div class="section-label">Następny trening</div>' +
      '<div class="plan-dzis-tytul">Tydzień ' + tydzien.numer + '/' + lista.length + '</div>' +
      '<div class="plan-dzis-nazwa">Trening ' + t.wariant + ' — ' + t.nazwa + '</div>' +
      '<div class="plan-dzis-faza">' + tydzien.nazwaFazy + '</div>' +
      '<div class="sum-grid">' +
        kafel('Tempo', t.tempo, 'sum-cell-swim') +
        kafel('Przerwa', t.przerwa + ' s', 'sum-cell-swim') +
        kafel('Seria główna', opisSerii(t)) +
        kafel('Suma', Plan.suma(t) + ' m') +
      '</div>' +
      '<div class="plan-dzis-tempo">rozgrzewka ' + t.rozgrzewka + ' m  ·  schłodzenie ' + t.schlodzenie + ' m</div>' +
      (t.uwaga ? '<p class="hint">' + t.uwaga + '</p>' : '') +
      '<div class="btn-row"><button class="primary" id="planZrobioneBtn">Zrobione</button></div>';

    karta.querySelector('#planZrobioneBtn').addEventListener('click', function () {
      ustawWykonanie(Plan.kluczTreningu(tydzien.numer, t.wariant), true);
    });

    return karta;
  }

  // klasaDodatkowa: 'sum-cell-swim' = kobaltowy wariant kafelka (jak Dystans/Suma w Trackerze)
  function kafel(etykieta, wartosc, klasaDodatkowa) {
    return '<div class="sum-cell' + (klasaDodatkowa ? ' ' + klasaDodatkowa : '') + '">' +
      '<div class="sum-cell-label">' + etykieta + '</div>' +
      '<div class="sum-cell-val">' + wartosc + '</div>' +
    '</div>';
  }

  function renderCalyPlan(lista, zrobione, nastepny) {
    const karta = document.createElement('div');
    karta.className = 'card';
    const etykieta = document.createElement('div');
    etykieta.className = 'section-label';
    etykieta.textContent = 'Cały plan';
    karta.appendChild(etykieta);

    const numerBiezacego = nastepny ? nastepny.tydzien.numer : null;

    Plan.DANE.fazy.forEach(function (faza, indeksFazy) {
      const tygodnieFazy = lista.filter(function (t) { return t.indeksFazy === indeksFazy; });
      let wszystkich = 0;
      let odhaczonych = 0;
      tygodnieFazy.forEach(function (tydzien) {
        tydzien.treningi.forEach(function (trening) {
          wszystkich++;
          if (zrobione[Plan.kluczTreningu(tydzien.numer, trening.wariant)]) odhaczonych++;
        });
      });

      karta.appendChild(renderNaglowekFazy(indeksFazy, faza, odhaczonych, wszystkich));
      if (!rozwinieteFazy.has(indeksFazy)) return;

      const cel = document.createElement('p');
      cel.className = 'hint plan-cel';
      cel.textContent = faza.cel;
      karta.appendChild(cel);

      tygodnieFazy.forEach(function (tydzien) {
        karta.appendChild(renderTydzien(tydzien, zrobione, tydzien.numer === numerBiezacego));
        if (tydzien.testPoTygodniu) {
          const test = document.createElement('div');
          test.className = 'plan-test';
          test.innerHTML = '<span class="lbl">Test na koniec fazy</span>' + tydzien.testPoTygodniu;
          karta.appendChild(test);
        }
      });
    });

    return karta;
  }

  function renderNaglowekFazy(indeksFazy, faza, odhaczonych, wszystkich) {
    const rozwinieta = rozwinieteFazy.has(indeksFazy);
    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz plan-grupa-faza';
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = rozwinieta ? '▾' : '▸';
    const tekst = document.createElement('span');
    tekst.textContent = faza.nazwa + '  (' + odhaczonych + '/' + wszystkich + ')';
    wiersz.appendChild(strzalka);
    wiersz.appendChild(tekst);
    wiersz.addEventListener('click', function () {
      if (rozwinieta) rozwinieteFazy.delete(indeksFazy); else rozwinieteFazy.add(indeksFazy);
      render();
    });
    return wiersz;
  }

  function renderTydzien(tydzien, zrobione, biezacy) {
    const wiersz = document.createElement('div');
    wiersz.className = 'plan-tydzien' + (biezacy ? ' plan-biezacy' : '');

    const nr = document.createElement('span');
    nr.className = 'plan-tydzien-nr';
    nr.textContent = 'Tydzień ' + tydzien.numer;
    wiersz.appendChild(nr);

    const treningiRow = document.createElement('div');
    treningiRow.className = 'plan-treningi-row';

    tydzien.treningi.forEach(function (trening) {
      const klucz = Plan.kluczTreningu(tydzien.numer, trening.wariant);
      const label = document.createElement('label');
      label.className = 'plan-trening';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!zrobione[klucz];
      cb.addEventListener('change', function () { ustawWykonanie(klucz, cb.checked); });
      const span = document.createElement('span');
      span.textContent = trening.wariant + ' · ' + opisSerii(trening);
      span.title = 'tempo ' + trening.tempo + ', przerwa ' + trening.przerwa + ' s';
      label.appendChild(cb);
      label.appendChild(span);
      treningiRow.appendChild(label);
    });

    wiersz.appendChild(treningiRow);

    return wiersz;
  }

  function renderZasady() {
    const karta = document.createElement('div');
    karta.className = 'card';

    const naglowek = document.createElement('div');
    naglowek.className = 'historia-wiersz plan-grupa-faza';
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = zasadyRozwiniete ? '▾' : '▸';
    // section-label, nie zwykły span — to tytuł karty, tak jak w każdej innej karcie apki
    const tekst = document.createElement('div');
    tekst.className = 'section-label';
    tekst.textContent = 'Zasady';
    naglowek.appendChild(strzalka);
    naglowek.appendChild(tekst);
    naglowek.addEventListener('click', function () {
      zasadyRozwiniete = !zasadyRozwiniete;
      render();
    });
    karta.appendChild(naglowek);

    if (zasadyRozwiniete) {
      Plan.DANE.zasady.forEach(function (z) {
        const el = document.createElement('div');
        el.className = 'plan-zasada';
        el.innerHTML = '<span class="lbl">' + z.tytul + '</span>' + z.tresc;
        karta.appendChild(el);
      });
      const stopka = document.createElement('p');
      stopka.className = 'hint';
      stopka.textContent = Plan.DANE.nazwa + ' · ' + Plan.DANE.podtytul;
      karta.appendChild(stopka);
    }

    return karta;
  }

  App.zarejestrujWidok({
    id: 'plan',
    etykieta: 'Plan',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj
  });

  return {};
})();
