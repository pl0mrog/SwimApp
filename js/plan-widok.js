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

  // Odhaczenie w liscie "Caly plan" moze zmienic wysokosc karty "Nastepny trening"
  // (inny trening staje sie nastepny), co przesuwa cala reszte tresci ponizej - mimo
  // ze App.przerysuj() przywraca ten sam scrollTop w pikselach, wiersz pod palcem
  // "skacze", bo zmienila sie tresc NAD nim. Kotwiczymy wiec na samym klikanym
  // checkboksie: mierzymy jego pozycje w oknie przed przebudowa i po niej, i
  // doksztalcamy scrollTop o roznice, zeby zostal dokladnie w tym samym miejscu.
  function odhaczZKotwica(klucz, cb) {
    const przed = cb.getBoundingClientRect().top;
    ustawWykonanie(klucz, cb.checked);
    const scroll = kontenerGlobalny && kontenerGlobalny.querySelector('.view-scroll');
    const nowyCb = scroll && scroll.querySelector('[data-klucz="' + klucz + '"]');
    if (scroll && nowyCb) {
      scroll.scrollTop += nowyCb.getBoundingClientRect().top - przed;
    }
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

  // Ujednolicony zapis dla obu typow czesci liczonych - zawsze "N × Dm", nawet dla
  // "ciagly" (powtorzenia tam zawsze 1, patrz Plan.czesci()). Wczesniej ciagly mial
  // osobne "D m ciągiem" - niespojne z zapisem serii obok.
  function opisCzesci(czesc) {
    return czesc.powtorzenia + ' × ' + czesc.dystans + ' m';
  }

  // Jak opisCzesci, ale bez mnoznika "1 ×" - do linijki informacyjnej, gdzie
  // rozgrzewka/schlodzenie to zwykle pojedynczy odcinek, ale technika bywa seria
  // (np. 4 x 50 m); pomijanie mnoznika zanizalo widoczny opis wzgledem Sumy.
  function opisCzescInfo(czesc) {
    return (czesc.powtorzenia > 1 ? czesc.powtorzenia + ' × ' + czesc.dystans : czesc.dystans) + ' m';
  }

  // Jedna para etykieta+wartosc w kafelku, owinieta w sum-item - dokladnie ta sama
  // konstrukcja co kafelekSum() w js/sesja-tabela.js (Tracker). sum-item ma flex:1 1 0,
  // wiec pary w kafelku dziela jego szerokosc po rowno; bez niego wszystko dociagalo
  // sie do lewej krawedzi.
  function sumItem(etykieta, wartosc) {
    return '<div class="sum-item"><div class="sum-cell-label">' + etykieta +
      '</div><div class="sum-cell-val">' + wartosc + '</div></div>';
  }

  // Para kafelkow obok siebie na kazda czesc liczona, wzorowana na parze "Dystans/Suma" +
  // "Pływanie/Przerwy" z Trackera: lewy kobaltowy (sum-cell-swim, wartosc niebieska),
  // prawy szary (goly sum-cell, wartosc biala). Oba sa sum-cell-para, nawet gdy mieszcza
  // jedna wartosc - tylko wtedy sum-item rozklada je tak samo jak w Trackerze. Przerwa ma
  // sens tylko dla "seria" - "ciagly" to jeden odcinek bez przerw, a "technika" w planie nie
  // ma tego pola (odpoczynek miedzy powtorzeniami techniki nie jest tu opisany). Prawy kafelek
  // ma wtedy sam kafelek Tempo. Wiele czesci = wiele par pod soba, bez naglowkow miedzy nimi.
  //
  // Etykieta lewego kafelka to zawsze "Seria" - pole "opis" z pliku planu bywa cale zdanie
  // ("pierwsze 200 m świadomie za wolno; po odcinku 30 s przerwy") i rozjezdzalo naglowek.
  function wierszCzesciHtml(czesc, def, basen) {
    // tempoZakres to jedyne pole z tempem, gdy trening jest zapisany jako przedzial
    // (np. plan pisany pod dwa rozne baseny) - bez fallbacku kafelek pokazywal pusty "-",
    // bo tempoZakres byl uzywany tylko jako niewidoczny na dotyku atrybut title.
    const tempo = Plan.tempoNaBasen(czesc.tempo, def, basen) || Plan.tempoNaBasen(czesc.tempoZakres, def, basen);
    const tempoHtml = sumItem('Tempo', tempo || '—') +
      (czesc.typ === 'seria' ? sumItem('Przerwa', (czesc.przerwa || 0) + ' s') : '');
    return '<div class="sum-grid plan-para">' +
      '<div class="sum-cell sum-cell-para sum-cell-swim">' + sumItem('Seria', opisCzesci(czesc)) + '</div>' +
      '<div class="sum-cell sum-cell-para">' + tempoHtml + '</div>' +
    '</div>';
  }

  // Suma to zwykly kafelek na pelna szerokosc (sum-cell-pelny, ta sama klasa co przy
  // nieparzystej liczbie kafelkow) - etykieta mala jak wszedzie, sama liczba powiekszona.
  function sumaWierszHtml(sumaTekst) {
    return '<div class="sum-grid plan-para">' +
      '<div class="sum-cell sum-cell-para sum-cell-pelny plan-suma">' +
      sumItem('Suma', sumaTekst) + '</div></div>';
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
      const tempo = Plan.tempoNaBasen(c.tempo, def, basen) || Plan.tempoNaBasen(c.tempoZakres, def, basen) || '?';
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
    // Kafelki dostaje wszystko poza rozgrzewka/schlodzeniem (tez technika - w tym
    // planie to zawsze seria powtorzen, np. 4 x 50 m, nie pojedynczy odcinek).
    const liczone = Plan.czesci(t).filter(function (c) {
      return c.typ === 'ciagly' || c.typ === 'seria' || c.typ === 'technika';
    });
    const maKorekte = !!(def.korektaTempa && def.basenDocelowy);

    let blokiHtml = '';
    liczone.forEach(function (czesc) {
      blokiHtml += wierszCzesciHtml(czesc, def, basen);
    });
    blokiHtml += sumaWierszHtml(Plan.suma(t) + ' m');

    // Linijka informacyjna pod ostatnim blokiem (§2.4): uwaga najpierw, potem
    // rozgrzewka/schlodzenie - bez kolorowego tla, zwykly tekst jak dzis.
    const infoBits = t.uwaga ? [t.uwaga] : [];
    Plan.czesci(t).forEach(function (c) {
      if (c.typ === 'rozgrzewka') infoBits.push('rozgrzewka ' + opisCzescInfo(c));
      else if (c.typ === 'schlodzenie') infoBits.push('schłodzenie ' + opisCzescInfo(c));
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
      cb.dataset.klucz = klucz;
      if (Dane.tryb() === 'gosc') {
        cb.disabled = true;
      } else {
        cb.addEventListener('change', function () { odhaczZKotwica(klucz, cb); });
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
