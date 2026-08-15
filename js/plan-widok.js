window.PlanWidok = (function () {
  let kontenerGlobalny = null;
  let rozwinieteFazy = null;
  let zasadyRozwiniete = false;
  let sekcjeRozwiniete = false;
  // Stan przelacznika basenu w Planie (format v2, korektaTempa) - wlasny, NIEZALEZNY
  // od ustawienia.ostatniBasen z Trackera: to dwie rozne intencje ("na jakim basenie
  // licze tempa planu" vs "na jakim basenie plywalem te sesje"). null = jeszcze nie
  // dotkniety w tej sesji, czytamy fallback z dok.ustawienia.basenPlanu / basenDocelowy.
  let basenPlanu = null;

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
    return dok.plan.wykonane[Plan.aktywnyId()] || {};
  }

  function ustawWykonanie(klucz, zrobione) {
    const dok = Dane.wczytaj();
    const id = Plan.aktywnyId();
    dok.plan.aktywnyPlan = id;
    if (!dok.plan.wykonane[id]) dok.plan.wykonane[id] = {};
    if (zrobione) {
      dok.plan.wykonane[id][klucz] = {
        data: new Date().toISOString().slice(0, 10),
        sesjaId: null
      };
    } else {
      delete dok.plan.wykonane[id][klucz];
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

  function basenPlanuAktywny(def) {
    if (basenPlanu != null) return basenPlanu;
    const dok = Dane.wczytaj();
    if (dok.ustawienia.basenPlanu != null) return dok.ustawienia.basenPlanu;
    return def.basenDocelowy || 50;
  }

  function ustawBasenPlanu(basen) {
    basenPlanu = basen;
    // gosc nie zapisuje nic do dokumentu - stan przelacznika zyje tylko w zmiennej
    // modulu na czas tej sesji, tak jak inne akcje goscia
    if (Dane.tryb() !== 'gosc') {
      const dok = Dane.wczytaj();
      dok.ustawienia.basenPlanu = basen;
      Dane.zapisz(dok);
    }
    render();
  }

  // "Odcinek ciągły" / "Seria" / "Seria N" (numerowana tylko gdy w treningu jest
  // wiecej niz jedna czesc typu "seria" - numer liczony wylacznie wsrod nich).
  function etykietaCzesci(czesc, indeks, liczone) {
    if (czesc.typ === 'ciagly') return 'Odcinek ciągły';
    const wszystkieSerie = liczone.filter(function (c) { return c.typ === 'seria'; }).length;
    if (wszystkieSerie <= 1) return 'Seria';
    const numer = liczone.slice(0, indeks + 1).filter(function (c) { return c.typ === 'seria'; }).length;
    return 'Seria ' + numer;
  }

  function opisCzesci(czesc) {
    return czesc.typ === 'ciagly'
      ? czesc.dystans + ' m ciągiem'
      : czesc.powtorzenia + ' × ' + czesc.dystans + ' m';
  }

  // Jeden blok kafelkow 2x2 dla jednej czesci liczonej (§2.3). "ciagly" nie ma
  // kafelka Przerwa - Tempo i Seria glowna zostaja obok siebie (2 kafelki, siatka
  // 2-kolumnowa jak dzis). Kafelek, ktory zostaje sam w ostatnim wierszu bloku
  // (nieparzysta liczba kafelkow), dostaje pelna szerokosc zamiast pustego miejsca.
  function blokKafelkowHtml(czesc, sumaTekst, def, basen) {
    const tempo = Plan.tempoNaBasen(czesc.tempo, def, basen);
    const zakresTitle = czesc.tempoZakres ? 'zakres ' + Plan.tempoNaBasen(czesc.tempoZakres, def, basen) : null;

    const wpisy = [{ etykieta: 'Tempo', wartosc: tempo || '—', klasa: 'sum-cell-swim', title: zakresTitle }];
    if (czesc.typ !== 'ciagly') wpisy.push({ etykieta: 'Przerwa', wartosc: (czesc.przerwa || 0) + ' s', klasa: 'sum-cell-swim' });
    wpisy.push({ etykieta: 'Seria główna', wartosc: opisCzesci(czesc), klasa: '' });
    if (sumaTekst != null) wpisy.push({ etykieta: 'Suma', wartosc: sumaTekst, klasa: '' });

    if (wpisy.length % 2 === 1) {
      const ostatni = wpisy[wpisy.length - 1];
      ostatni.klasa = (ostatni.klasa + ' sum-cell-pelny').trim();
    }

    return '<div class="sum-grid">' + wpisy.map(function (w) {
      return kafel(w.etykieta, w.wartosc, w.klasa, w.title);
    }).join('') + '</div>';
  }

  function basenPrzelacznikHtml(basen, def) {
    const opisKorekty = (basen !== def.basenDocelowy && def.korektaTempa && def.korektaTempa.opis)
      ? '<p class="hint">' + def.korektaTempa.opis + '</p>' : '';
    return '<div class="param-row toggle-group" id="planBasenGroup">' +
        '<button type="button" class="toggle-btn' + (basen === 25 ? ' active' : '') + '" data-basen="25">25 m</button>' +
        '<button type="button" class="toggle-btn' + (basen === 50 ? ' active' : '') + '" data-basen="50">50 m</button>' +
      '</div>' + opisKorekty;
  }

  // Opis widoczny na liscie tygodni: czesci liczone zlaczone " + ", np.
  // "700 m ciągiem + 2 × 300 m". Tempo/przerwa (po korekcie basenu) ida do title.
  function opisTreningZlozony(trening) {
    return Plan.czesciLiczone(trening).map(opisCzesci).join(' + ');
  }

  function tytulTreningu(trening, def, basen) {
    return Plan.czesciLiczone(trening).map(function (c) {
      const tempo = Plan.tempoNaBasen(c.tempo, def, basen) || '?';
      return (c.typ === 'ciagly' ? 'ciągły' : 'seria') + ' ' + tempo +
        (c.typ === 'seria' ? ', przerwa ' + (c.przerwa || 0) + ' s' : '');
    }).join('; ');
  }

  // ===== render =====

  function render() {
    const kontener = kontenerGlobalny;
    App.przerysuj(kontener, function () { renderTresc(kontener); });
  }

  function renderTresc(kontener) {
    const def = Plan.aktywny();
    const lista = Plan.tygodnie(def);
    const zrobione = wykonane();
    const nastepny = nastepnyTrening(lista, zrobione);

    if (rozwinieteFazy === null) {
      rozwinieteFazy = new Set();
      rozwinieteFazy.add(nastepny ? nastepny.tydzien.indeksFazy : 0);
    }

    const basen = basenPlanuAktywny(def);

    kontener.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'view-scroll';
    scroll.appendChild(renderNastepny(lista, nastepny, def, basen));
    scroll.appendChild(renderCalyPlan(lista, zrobione, nastepny, def, basen));
    scroll.appendChild(renderZasady(def));
    const sekcje = renderSekcje(def);
    if (sekcje) scroll.appendChild(sekcje);
    kontener.appendChild(scroll);
  }

  function renderNastepny(lista, nastepny, def, basen) {
    const karta = document.createElement('div');
    karta.className = 'card';

    if (!nastepny) {
      karta.innerHTML =
        '<div class="section-label">Plan ukończony</div>' +
        '<p class="hint">Wszystkie treningi z planu „' + def.nazwa + '” są odhaczone. ' +
        'Wczytaj nowy plan w Ustawieniach → Plan treningowy.</p>';
      return karta;
    }

    const t = nastepny.trening;
    const tydzien = nastepny.tydzien;
    const gosc = Dane.tryb() === 'gosc';
    const liczone = Plan.czesciLiczone(t);
    const pokazEtykiety = liczone.length > 1;
    const maKorekte = !!(def.korektaTempa && def.basenDocelowy);

    let blokiHtml = '';
    liczone.forEach(function (czesc, i) {
      const ostatni = i === liczone.length - 1;
      if (pokazEtykiety) blokiHtml += '<div class="section-label">' + etykietaCzesci(czesc, i, liczone) + '</div>';
      blokiHtml += blokKafelkowHtml(czesc, ostatni ? Plan.suma(t) + ' m' : null, def, basen);
    });

    // Linijka informacyjna pod ostatnim blokiem (§2.4): uwaga najpierw, potem
    // rozgrzewka/technika/schlodzenie - bez kolorowego tla, zwykly tekst jak dzis.
    const infoBits = t.uwaga ? [t.uwaga] : [];
    Plan.czesci(t).forEach(function (c) {
      if (c.typ === 'rozgrzewka') infoBits.push('rozgrzewka ' + c.dystans + ' m');
      else if (c.typ === 'technika') infoBits.push('technika ' + c.dystans + ' m');
      else if (c.typ === 'schlodzenie') infoBits.push('schłodzenie ' + c.dystans + ' m');
    });

    karta.innerHTML =
      '<div class="section-label">Następny trening</div>' +
      '<div class="plan-dzis-tytul">Tydzień ' + tydzien.numer + '/' + lista.length + '</div>' +
      '<div class="plan-dzis-nazwa">Trening ' + t.wariant + ' — ' + t.nazwa + '</div>' +
      '<div class="plan-dzis-faza">' + tydzien.nazwaFazy + '</div>' +
      (maKorekte ? basenPrzelacznikHtml(basen, def) : '') +
      blokiHtml +
      (infoBits.length ? '<div class="plan-dzis-tempo">' + infoBits.join('  ·  ') + '</div>' : '') +
      (gosc ? '' : '<div class="btn-row"><button class="primary" id="planZrobioneBtn">Zrobione</button></div>');

    const btnZrobione = karta.querySelector('#planZrobioneBtn');
    if (btnZrobione) {
      btnZrobione.addEventListener('click', function () {
        ustawWykonanie(Plan.kluczTreningu(tydzien.numer, t.wariant), true);
      });
    }

    const basenGroup = karta.querySelector('#planBasenGroup');
    if (basenGroup) {
      basenGroup.querySelectorAll('.toggle-btn').forEach(function (btn) {
        btn.addEventListener('click', function () { ustawBasenPlanu(Number(btn.dataset.basen)); });
      });
    }

    return karta;
  }

  // klasaDodatkowa: 'sum-cell-swim' = kobaltowy wariant kafelka (jak Dystans/Suma w Trackerze).
  // title: opcjonalny (np. tempoZakres na kafelku Tempo) - specyfikacja nie przewiduje
  // dla niego wlasnego miejsca w ukladzie kafelkow.
  function kafel(etykieta, wartosc, klasaDodatkowa, title) {
    return '<div class="sum-cell' + (klasaDodatkowa ? ' ' + klasaDodatkowa : '') + '"' +
      (title ? ' title="' + title + '"' : '') + '>' +
      '<div class="sum-cell-label">' + etykieta + '</div>' +
      '<div class="sum-cell-val">' + wartosc + '</div>' +
    '</div>';
  }

  function renderCalyPlan(lista, zrobione, nastepny, def, basen) {
    const karta = document.createElement('div');
    karta.className = 'card';
    const etykieta = document.createElement('div');
    etykieta.className = 'section-label';
    etykieta.textContent = 'Cały plan';
    karta.appendChild(etykieta);

    const numerBiezacego = nastepny ? nastepny.tydzien.numer : null;

    def.fazy.forEach(function (faza, indeksFazy) {
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
        karta.appendChild(renderTydzien(tydzien, zrobione, tydzien.numer === numerBiezacego, def, basen));
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

  function renderTydzien(tydzien, zrobione, biezacy, def, basen) {
    const wiersz = document.createElement('div');
    wiersz.className = 'plan-tydzien' + (biezacy ? ' plan-biezacy' : '');

    const nr = document.createElement('span');
    nr.className = 'plan-tydzien-nr';
    nr.textContent = 'Tydzień ' + tydzien.numer + (tydzien.komentarz ? ' — ' + tydzien.komentarz : '');
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
      if (Dane.tryb() === 'gosc') {
        cb.disabled = true;
      } else {
        cb.addEventListener('change', function () { ustawWykonanie(klucz, cb.checked); });
      }
      const span = document.createElement('span');
      span.textContent = trening.wariant + ' · ' + opisTreningZlozony(trening);
      span.title = tytulTreningu(trening, def, basen);
      label.appendChild(cb);
      label.appendChild(span);
      treningiRow.appendChild(label);
    });

    wiersz.appendChild(treningiRow);

    return wiersz;
  }

  function renderZasady(def) {
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
      def.zasady.forEach(function (z) {
        const el = document.createElement('div');
        el.className = 'plan-zasada';
        el.innerHTML = '<span class="lbl">' + z.tytul + '</span>' + z.tresc;
        karta.appendChild(el);
      });
      const stopka = document.createElement('p');
      stopka.className = 'hint';
      stopka.textContent = def.nazwa + ' · ' + def.podtytul;
      karta.appendChild(stopka);
    }

    return karta;
  }

  // Karta "Materiały" (format v2, plan.sekcje) - ta sama konstrukcja co "Zasady"
  // (▸/▾ + section-label), pod nia. Renderowana tylko gdy plik planu ma niepuste sekcje.
  function renderSekcje(def) {
    if (!Array.isArray(def.sekcje) || !def.sekcje.length) return null;

    const karta = document.createElement('div');
    karta.className = 'card';

    const naglowek = document.createElement('div');
    naglowek.className = 'historia-wiersz plan-grupa-faza';
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = sekcjeRozwiniete ? '▾' : '▸';
    const tekst = document.createElement('div');
    tekst.className = 'section-label';
    tekst.textContent = 'Materiały';
    naglowek.appendChild(strzalka);
    naglowek.appendChild(tekst);
    naglowek.addEventListener('click', function () {
      sekcjeRozwiniete = !sekcjeRozwiniete;
      render();
    });
    karta.appendChild(naglowek);

    if (sekcjeRozwiniete) {
      def.sekcje.forEach(function (s) {
        const el = document.createElement('div');
        el.className = 'plan-zasada';
        const lbl = document.createElement('span');
        lbl.className = 'lbl';
        lbl.textContent = s.tytul;
        el.appendChild(lbl);
        renderTrescSekcji(s.tresc).forEach(function (blok) { el.appendChild(blok); });
        karta.appendChild(el);
      });
    }

    return karta;
  }

  // tresc moze zawierac \n\n (akapity) i wiersze zaczynajace sie od "• " (lista).
  // Budujemy DOM przez textContent per akapit/wiersz, nie innerHTML z calego tekstu -
  // tresc pochodzi z importowanego pliku, nie z recznie wpisanego kodu jak przy Zasadach.
  function renderTrescSekcji(tresc) {
    return tresc.split(/\n\n+/).map(function (akapit) {
      const linie = akapit.split('\n').filter(function (l) { return l.trim(); });
      if (linie.length && linie.every(function (l) { return l.trim().indexOf('•') === 0; })) {
        const ul = document.createElement('ul');
        linie.forEach(function (l) {
          const li = document.createElement('li');
          li.textContent = l.trim().replace(/^•\s*/, '');
          ul.appendChild(li);
        });
        return ul;
      }
      const p = document.createElement('p');
      p.textContent = akapit.trim();
      return p;
    });
  }

  App.zarejestrujWidok({
    id: 'plan',
    etykieta: 'Plan',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj,
    odswiez: render
  });

  return {};
})();
