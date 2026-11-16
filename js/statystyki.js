window.Statystyki = (function () {
  const TYGODNI = 52;
  // Cel tygodniowy to stała w kodzie (ZALOZENIA.md) — bez ustawień; zmiana = edycja tej linii.
  const CEL_TYGODNIOWY = 3000;
  const DYSTANSE_CZASU = [1000, 1500];
  // Próg „Sesje wg dystansu" (Ustawienia → Statystyki); 1 = wszystkie.
  const PROGI_SESJI = [1, 2, 5, 10];
  // Kolejność: najnowszy rok, poprzedni, ... — wyłącznie tokeny z palety (bez czerwieni i pomarańczu).
  const KOLORY_LAT = ['var(--accent-confirm)', 'var(--accent-info)', 'var(--text-dim)', 'var(--text-muted)'];
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const DOBA = 86400000;

  let kontenerGlobalny = null;
  // Stan widoku (nie danych): przełączniki i zaznaczenia żyją do przeładowania strony.
  let lataWylaczone = new Set();
  let zakresDystansow = 'wszystko';
  let dystansCzasu = 1500;
  const wybrany = { tydzien: null, dystans: null, punkt: null };
  let ostatniaSzerokosc = 0;
  let timerResize = null;

  // ===== obliczenia (bez DOM) =====

  function czyDataOk(iso) {
    return typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(iso);
  }

  function dzienUTC(iso) {
    return Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)));
  }

  // Tydzień roku 1..52: poniedziałek–niedziela, tydzień 1 = ten, w którym leży 1 stycznia,
  // wszystko po 52. tygodniu wpada do 52. Rok = rok daty (bez przenoszenia dni między latami).
  function tydzienRoku(iso) {
    const t0 = Date.UTC(Number(iso.slice(0, 4)), 0, 1);
    const dzienRoku = Math.round((dzienUTC(iso) - t0) / DOBA);
    const przesuniecie = (new Date(t0).getUTCDay() + 6) % 7;   // 0 = poniedziałek
    return Math.min(TYGODNI, Math.floor((dzienRoku + przesuniecie) / 7) + 1);
  }

  // Data lokalna (nie UTC) — po północy toISOString() cofałby się o dzień.
  function dzisIso() {
    const d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }

  // Czas zbiorczy z zegarka na danym dystansie albo null. Kolejność źródeł:
  // 1) zbiorcze[dystans].swimSec (bez flagi doWeryfikacji) — także w dłuższych sesjach,
  // 2) tylko dla sesji o dystansie równym progowi: recznyCzas (ręczna) albo koniec.sec.
  function czasNaDystansie(sesja, dystans) {
    const zb = sesja.zbiorcze && sesja.zbiorcze[String(dystans)];
    if (zb && typeof zb.swimSec === 'number' && zb.swimSec > 0 && zb.doWeryfikacji !== true) return zb.swimSec;
    if (Model.dystans(sesja) !== dystans) return null;
    if (sesja.recznyDystans != null) {
      return typeof sesja.recznyCzas === 'number' && sesja.recznyCzas > 0 ? sesja.recznyCzas : null;
    }
    const koniec = sesja.koniec && sesja.koniec.sec;
    return typeof koniec === 'number' && koniec > 0 ? koniec : null;
  }

  function minSesji(dok) {
    const v = dok && dok.ustawienia ? dok.ustawienia.statMinSesji : null;
    return PROGI_SESJI.indexOf(v) !== -1 ? v : 1;
  }

  // Rekord tygodnia liczony z prawdziwych tygodni pon–niedz, ciągłych przez granicę roku.
  // Celowo NIE z tydzienRoku(): tydzień 52 z wykresu skleja końcówkę grudnia w „tydzień"
  // nawet 10-dniowy — taki rekord byłby nie do pobicia i nie znaczyłby tego, co mówi etykieta.
  // Przy remisie zostaje najwcześniejszy tydzień.
  function najlepszyTydzienRealny(wazne) {
    const sumy = {};
    wazne.forEach(function (s) {
      const t = dzienUTC(s.data);
      const poniedzialek = t - ((new Date(t).getUTCDay() + 6) % 7) * DOBA;
      sumy[poniedzialek] = (sumy[poniedzialek] || 0) + Model.dystans(s);
    });
    let najlepszy = null;
    Object.keys(sumy).map(Number).sort(function (a, b) { return a - b; }).forEach(function (pon) {
      if (!najlepszy || sumy[pon] > najlepszy.metry) {
        najlepszy = { metry: sumy[pon], poniedzialek: new Date(pon).toISOString().slice(0, 10) };
      }
    });
    return najlepszy;
  }

  function policz(sesje, dzis) {
    const wazne = (sesje || []).filter(function (s) {
      return s && czyDataOk(s.data) && Model.dystans(s) > 0;
    }).sort(function (a, b) {
      return (a.data + '_' + (a.utworzono || '')).localeCompare(b.data + '_' + (b.utworzono || ''));
    });

    const tygodniowo = {};
    wazne.forEach(function (s) {
      const rok = s.data.slice(0, 4);
      if (!tygodniowo[rok]) tygodniowo[rok] = new Array(TYGODNI + 1).fill(0);
      tygodniowo[rok][tydzienRoku(s.data)] += Model.dystans(s);
    });
    const lata = Object.keys(tygodniowo).sort().reverse();

    const rokDzis = dzis.slice(0, 4);
    const tydzienDzis = tydzienRoku(dzis);
    const narastajaco = {};
    let maxNarastajaco = 0;
    lata.forEach(function (rok) {
      const tyg = tygodniowo[rok];
      let ostatniZDanymi = 0;
      for (let w = 1; w <= TYGODNI; w++) {
        if (tyg[w] > 0) ostatniZDanymi = w;
      }
      // Lata zamknięte idą do tygodnia 52; bieżący rok kończy się na bieżącym tygodniu
      // (bez płaskiego ogona do końca roku).
      let koniec = ostatniZDanymi;
      if (rok < rokDzis) koniec = TYGODNI;
      else if (rok === rokDzis) koniec = Math.max(tydzienDzis, ostatniZDanymi);
      const punkty = [0];
      for (let w = 1; w <= koniec; w++) punkty.push(punkty[w - 1] + tyg[w]);
      narastajaco[rok] = punkty;
      maxNarastajaco = Math.max(maxNarastajaco, punkty[punkty.length - 1]);
    });

    let najdluzsza = null;
    wazne.forEach(function (s) {
      const m = Model.dystans(s);
      if (!najdluzsza || m > najdluzsza.metry) najdluzsza = { metry: m, data: s.data };
    });

    const czasy = {};
    const rekordCzasu = {};
    DYSTANSE_CZASU.forEach(function (d) {
      czasy[d] = [];
      rekordCzasu[d] = null;
      wazne.forEach(function (s) {
        const sec = czasNaDystansie(s, d);
        if (sec == null) return;
        czasy[d].push({ data: s.data, sec: sec, metry: Model.dystans(s) });
        if (!rekordCzasu[d] || sec < rekordCzasu[d].sec) rekordCzasu[d] = { sec: sec, data: s.data };
      });
    });

    return {
      sesje: wazne, lata: lata, tygodniowo: tygodniowo, narastajaco: narastajaco,
      maxNarastajaco: maxNarastajaco, najdluzsza: najdluzsza, najlepszyTydzien: najlepszyTydzienRealny(wazne),
      czasy: czasy, rekordCzasu: rekordCzasu
    };
  }

  function histogram(sesje, zakres, min) {
    const licznik = {};
    sesje.forEach(function (s) {
      if (zakres !== 'wszystko' && s.data.slice(0, 4) !== zakres) return;
      const m = Model.dystans(s);
      licznik[m] = (licznik[m] || 0) + 1;
    });
    return Object.keys(licznik).map(Number).sort(function (a, b) { return a - b; })
      .map(function (m) { return { metry: m, ile: licznik[m] }; })
      .filter(function (p) { return p.ile >= min; });
  }

  // Oś od 0 do `max` z kreskami co `krok` (około `ileKresek` odstępów).
  function ladnaSkala(wartoscMax, ileKresek, calkowite) {
    if (!(wartoscMax > 0)) return { max: 1, krok: 1 };
    const surowy = wartoscMax / ileKresek;
    const potega = Math.pow(10, Math.floor(Math.log10(surowy)));
    const mnozniki = [1, 2, 2.5, 4, 5, 10];
    let krok = 10 * potega;
    for (let i = 0; i < mnozniki.length; i++) {
      const k = mnozniki[i] * potega;
      if (calkowite && !Number.isInteger(k)) continue;
      if (k >= surowy) { krok = k; break; }
    }
    if (calkowite && krok < 1) krok = 1;
    return { max: Math.ceil(wartoscMax / krok) * krok, krok: krok };
  }

  function skalaCzasu(minSec, maxSec) {
    const KROKI = [15, 30, 60, 120, 300, 600, 1200, 1800, 3600];
    let krok = KROKI[KROKI.length - 1];
    for (let i = 0; i < KROKI.length; i++) {
      if ((maxSec - minSec) / KROKI[i] <= 4) { krok = KROKI[i]; break; }
    }
    let min = Math.floor(minSec / krok) * krok;
    let max = Math.ceil(maxSec / krok) * krok;
    if (max === min) { min -= krok; max += krok; }
    return { min: min, max: max, krok: krok };
  }

  // Kreski osi czasu: pierwsze dni miesięcy, najwyżej ~5 etykiet „MM.RR".
  function kreskiMiesiecy(tMin, tMax) {
    const d0 = new Date(tMin), d1 = new Date(tMax);
    const start = d0.getUTCFullYear() * 12 + d0.getUTCMonth() + 1;
    const koniec = d1.getUTCFullYear() * 12 + d1.getUTCMonth();
    const ile = koniec - start + 1;
    if (ile <= 0) return [];
    const krok = Math.max(1, Math.ceil(ile / 4));
    const wynik = [];
    for (let m = start; m <= koniec; m += krok) {
      const rok = Math.floor(m / 12), mies = m % 12;
      wynik.push({ t: Date.UTC(rok, mies, 1), etykieta: String(mies + 1).padStart(2, '0') + '.' + String(rok).slice(2) });
    }
    return wynik;
  }

  function odmienSesje(n) {
    if (n === 1) return 'sesja';
    const j = n % 10, d = n % 100;
    return (j >= 2 && j <= 4 && (d < 12 || d > 14)) ? 'sesje' : 'sesji';
  }

  function kolorRoku(indeks) {
    return KOLORY_LAT[Math.min(indeks, KOLORY_LAT.length - 1)];
  }

  // ===== DOM / SVG =====

  function dodaj(rodzic, znacznik, klasa, tekst) {
    const e = document.createElement(znacznik);
    if (klasa) e.className = klasa;
    if (tekst != null) e.textContent = tekst;
    rodzic.appendChild(e);
    return e;
  }

  function svgEl(nazwa, atrybuty, tekst) {
    const e = document.createElementNS(SVG_NS, nazwa);
    Object.keys(atrybuty || {}).forEach(function (k) { e.setAttribute(k, atrybuty[k]); });
    if (tekst != null) e.textContent = tekst;
    return e;
  }

  // Wykres rysowany w realnych pikselach: viewBox = zmierzona szerokość hosta, więc
  // fonty 9 px są 9 px i na telefonie, i na komputerze. Host musi już być w dokumencie.
  function nowySvg(host, wys) {
    const szer = Math.max(240, Math.floor(host.clientWidth));
    const svg = svgEl('svg', { viewBox: '0 0 ' + szer + ' ' + wys, width: '100%', height: wys, class: 'st-svg' });
    host.appendChild(svg);
    return { svg: svg, szer: szer };
  }

  function pozycjaX(svg, szer, e) {
    const r = svg.getBoundingClientRect();
    return (e.clientX - r.left) * (szer / r.width);
  }

  function nowaKarta(scroll, tytul) {
    const karta = dodaj(scroll, 'div', 'card');
    dodaj(karta, 'div', 'section-label', tytul);
    return karta;
  }

  function montuj(kontener) {
    kontenerGlobalny = kontener;
    window.addEventListener('resize', przyZmianieRozmiaru);
    render();
  }

  function odmontuj() {
    window.removeEventListener('resize', przyZmianieRozmiaru);
    clearTimeout(timerResize);
    if (kontenerGlobalny) kontenerGlobalny.innerHTML = '';
    kontenerGlobalny = null;
  }

  // Na iOS `resize` leci też przy chowaniu paska adresu — przerysowujemy tylko,
  // gdy realnie zmieniła się szerokość.
  function przyZmianieRozmiaru() {
    clearTimeout(timerResize);
    timerResize = setTimeout(function () {
      if (!kontenerGlobalny) return;
      const scroll = kontenerGlobalny.querySelector('.view-scroll');
      if (scroll && scroll.clientWidth !== ostatniaSzerokosc) render();
    }, 150);
  }

  function render() {
    if (!kontenerGlobalny) return;
    App.przerysuj(kontenerGlobalny, rysuj);
  }

  function rysuj() {
    const kontener = kontenerGlobalny;
    const dok = Dane.wczytaj();
    const dane = policz(dok.sesje, dzisIso());

    kontener.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'view-scroll';
    // Najpierw do dokumentu, potem karty — wykresy mierzą szerokość swojego hosta.
    kontener.appendChild(scroll);
    ostatniaSzerokosc = scroll.clientWidth;

    if (!dane.sesje.length) {
      const pusta = nowaKarta(scroll, 'Statystyki');
      dodaj(pusta, 'p', 'hint', 'Brak zapisanych sesji — statystyki pojawią się po pierwszym treningu.');
      return;
    }

    kartaRekordy(scroll, dane);
    kartaNarastajaco(scroll, dane);
    kartaDystanse(scroll, dane, minSesji(dok));
    kartaCzasy(scroll, dane);
  }

  // ----- Rekordy -----

  function kartaRekordy(scroll, dane) {
    const karta = nowaKarta(scroll, 'Rekordy');
    const grid = dodaj(karta, 'div', 'sum-grid st-rekordy');
    function kafelek(etykieta, wartosc, dopisek) {
      const k = dodaj(grid, 'div', 'sum-cell');
      dodaj(k, 'div', 'sum-cell-label', etykieta);
      dodaj(k, 'div', 'sum-cell-val', wartosc);
      dodaj(k, 'div', 'st-rekord-dopisek', dopisek || ' ');
    }
    const n = dane.najdluzsza;
    const t = dane.najlepszyTydzien;
    kafelek('Najdłuższa sesja', n ? Model.fmtMetry(n.metry) : '—', n ? n.data : '');
    kafelek('Najlepszy tydzień', t ? Model.fmtMetry(t.metry) : '—', t ? 'tydz. od ' + t.poniedzialek : '');
    DYSTANSE_CZASU.forEach(function (d) {
      const r = dane.rekordCzasu[d];
      kafelek('Najlepszy czas ' + Model.fmtMetry(d), r ? Model.fmtCzas(r.sec) : '—', r ? r.data : '');
    });
  }

  // ----- Dystans narastająco -----

  function kartaNarastajaco(scroll, dane) {
    const karta = nowaKarta(scroll, 'Dystans narastająco');
    const lataBox = dodaj(karta, 'div', 'st-lata');
    dane.lata.forEach(function (rok, i) {
      const label = dodaj(lataBox, 'label', 'cb-label st-rok');
      const cb = dodaj(label, 'input');
      cb.type = 'checkbox';
      cb.checked = !lataWylaczone.has(rok);
      cb.addEventListener('change', function () {
        if (cb.checked) lataWylaczone.delete(rok); else lataWylaczone.add(rok);
        render();
      });
      dodaj(label, 'span', 'st-kolor').style.background = kolorRoku(i);
      label.appendChild(document.createTextNode(rok));
    });
    const cel = dodaj(lataBox, 'span', 'st-rok st-cel-legenda');
    dodaj(cel, 'span', 'st-kolor st-kolor-cel');
    cel.appendChild(document.createTextNode('cel ' + Model.fmtMetry(CEL_TYGODNIOWY) + '/tydz.'));

    const host = dodaj(karta, 'div', 'st-wykres');
    const odczyt = dodaj(karta, 'div', 'st-odczyt');
    rysujNarastajaco(host, odczyt, dane);
  }

  function rysujNarastajaco(host, odczyt, dane) {
    const WYS = 200, L = 52, P = 8, G = 8, D = 20;
    const p = nowySvg(host, WYS);
    const svg = p.svg;
    const x0 = L, x1 = p.szer - P, y0 = G, y1 = WYS - D;
    const celKoniec = CEL_TYGODNIOWY * TYGODNI;
    // Skala liczona ze WSZYSTKICH lat (nie tylko włączonych) — oś nie skacze przy przełączaniu.
    const skala = ladnaSkala(Math.max(celKoniec, dane.maxNarastajaco), 4, false);
    function x(w) { return x0 + (w / TYGODNI) * (x1 - x0); }
    function y(m) { return y1 - (m / skala.max) * (y1 - y0); }

    for (let i = 0; i * skala.krok <= skala.max + 1e-6; i++) {
      const v = i * skala.krok;
      svg.appendChild(svgEl('line', { x1: x0, x2: x1, y1: y(v), y2: y(v), class: 'st-siatka' }));
      svg.appendChild(svgEl('text', { x: x0 - 6, y: y(v) + 3, 'text-anchor': 'end' }, Model.fmtMetry(v)));
    }
    [1, 13, 26, 39, 52].forEach(function (w) {
      svg.appendChild(svgEl('text', { x: x(w), y: WYS - 6, 'text-anchor': w === 52 ? 'end' : 'middle' }, String(w)));
    });

    svg.appendChild(svgEl('line', { x1: x(0), y1: y(0), x2: x(TYGODNI), y2: y(celKoniec), class: 'st-cel' }));

    const widoczne = dane.lata.filter(function (rok) { return !lataWylaczone.has(rok); });
    // starsze lata pod spodem, najnowszy rok na wierzchu
    widoczne.slice().reverse().forEach(function (rok) {
      const punkty = dane.narastajaco[rok].map(function (m, w) {
        return x(w).toFixed(1) + ',' + y(m).toFixed(1);
      }).join(' ');
      const linia = svgEl('polyline', { points: punkty, class: 'st-linia' });
      linia.style.stroke = kolorRoku(dane.lata.indexOf(rok));
      svg.appendChild(linia);
    });

    const w = wybrany.tydzien;
    if (w != null) {
      svg.appendChild(svgEl('line', { x1: x(w), x2: x(w), y1: y0, y2: y1, class: 'st-prowadnica' }));
      const czesci = ['tydz. ' + w];
      widoczne.forEach(function (rok) {
        const punkty = dane.narastajaco[rok];
        if (w > punkty.length - 1) return;   // linia tego roku tam nie sięga
        const kropka = svgEl('circle', { cx: x(w), cy: y(punkty[w]), r: 3.5 });
        kropka.style.fill = kolorRoku(dane.lata.indexOf(rok));
        svg.appendChild(kropka);
        czesci.push(rok + ': ' + Model.fmtMetry(punkty[w]));
      });
      czesci.push('cel: ' + Model.fmtMetry(CEL_TYGODNIOWY * w));
      odczyt.textContent = czesci.join(' · ');
    } else {
      odczyt.textContent = 'Dotknij wykresu, żeby zobaczyć wartości z wybranego tygodnia.';
    }

    const hit = svgEl('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-hit' });
    hit.addEventListener('click', function (e) {
      const px = pozycjaX(svg, p.szer, e);
      wybrany.tydzien = Math.max(1, Math.min(TYGODNI, Math.round((px - x0) / (x1 - x0) * TYGODNI)));
      render();
    });
    svg.appendChild(hit);
  }

  // ----- Sesje wg dystansu -----

  function kartaDystanse(scroll, dane, min) {
    const karta = nowaKarta(scroll, 'Sesje wg dystansu');
    const lataRosnaco = dane.lata.slice().reverse();
    if (zakresDystansow !== 'wszystko' && lataRosnaco.indexOf(zakresDystansow) === -1) zakresDystansow = 'wszystko';
    if (lataRosnaco.length > 1) {
      const grupa = dodaj(karta, 'div', 'toggle-group st-przelacznik');
      lataRosnaco.concat(['wszystko']).forEach(function (z) {
        const btn = dodaj(grupa, 'button', 'toggle-btn' + (z === zakresDystansow ? ' active' : ''), z);
        btn.type = 'button';
        btn.addEventListener('click', function () {
          zakresDystansow = z;
          wybrany.dystans = null;
          render();
        });
      });
    }
    const slupki = histogram(dane.sesje, zakresDystansow, min);
    if (!slupki.length) {
      dodaj(karta, 'p', 'hint', 'Żaden dystans nie ma co najmniej ' + min + ' sesji w tym zakresie.');
    } else {
      const host = dodaj(karta, 'div', 'st-wykres');
      const odczyt = dodaj(karta, 'div', 'st-odczyt');
      rysujDystanse(host, odczyt, slupki);
    }
    if (min > 1) {
      dodaj(karta, 'p', 'hint', 'Ukryte dystanse z mniej niż ' + min + ' sesjami — próg zmienisz w Ustawieniach → Statystyki.');
    }
  }

  function rysujDystanse(host, odczyt, slupki) {
    const WYS = 180, L = 26, P = 6, G = 8, D = 20, SZER_ETYKIETY = 36;
    const p = nowySvg(host, WYS);
    const svg = p.svg;
    const x0 = L, x1 = p.szer - P, y0 = G, y1 = WYS - D;
    const skala = ladnaSkala(Math.max.apply(null, slupki.map(function (s) { return s.ile; })), 4, true);
    const slot = (x1 - x0) / slupki.length;
    const szerSlupka = Math.min(28, slot * 0.7);
    function y(v) { return y1 - (v / skala.max) * (y1 - y0); }

    for (let i = 0; i * skala.krok <= skala.max; i++) {
      const v = i * skala.krok;
      svg.appendChild(svgEl('line', { x1: x0, x2: x1, y1: y(v), y2: y(v), class: 'st-siatka' }));
      svg.appendChild(svgEl('text', { x: x0 - 6, y: y(v) + 3, 'text-anchor': 'end' }, String(v)));
    }

    const krokEtykiet = Math.max(1, Math.ceil(slupki.length * SZER_ETYKIETY / (x1 - x0)));
    let wybranySlupek = null;
    slupki.forEach(function (s, i) {
      const srodek = x0 + (i + 0.5) * slot;
      const czyWybrany = wybrany.dystans === s.metry;
      if (czyWybrany) wybranySlupek = s;
      svg.appendChild(svgEl('rect', {
        x: srodek - szerSlupka / 2, y: y(s.ile), width: szerSlupka, height: y1 - y(s.ile), rx: 2,
        class: 'st-slupek' + (czyWybrany ? ' wybrany' : '')
      }));
      if (i % krokEtykiet === 0) {
        const zaPrawa = srodek + SZER_ETYKIETY / 2 > p.szer;
        svg.appendChild(svgEl('text', {
          x: zaPrawa ? p.szer - 1 : srodek, y: WYS - 6, 'text-anchor': zaPrawa ? 'end' : 'middle'
        }, Model.fmtMetry(s.metry)));
      }
      // cały pas nad słupkiem jest celem dotyku — niski słupek dalej da się trafić
      const hit = svgEl('rect', { x: x0 + i * slot, y: y0, width: slot, height: y1 - y0, class: 'st-hit' });
      hit.addEventListener('click', function () {
        wybrany.dystans = s.metry;
        render();
      });
      svg.appendChild(hit);
    });

    odczyt.textContent = wybranySlupek
      ? Model.fmtMetry(wybranySlupek.metry) + ' — ' + wybranySlupek.ile + ' ' + odmienSesje(wybranySlupek.ile)
      : 'Dotknij słupka, żeby zobaczyć liczbę sesji.';
  }

  // ----- Czas na 1000 / 1500 m -----

  function kartaCzasy(scroll, dane) {
    const karta = nowaKarta(scroll, 'Czas na dystansie');
    const grupa = dodaj(karta, 'div', 'toggle-group st-przelacznik');
    DYSTANSE_CZASU.forEach(function (d) {
      const btn = dodaj(grupa, 'button', 'toggle-btn' + (d === dystansCzasu ? ' active' : ''), Model.fmtMetry(d));
      btn.type = 'button';
      btn.addEventListener('click', function () {
        dystansCzasu = d;
        wybrany.punkt = null;
        render();
      });
    });
    const punkty = dane.czasy[dystansCzasu];
    if (!punkty.length) {
      dodaj(karta, 'p', 'hint', 'Brak sesji z czasem na ' + Model.fmtMetry(dystansCzasu) + '.');
      return;
    }
    const host = dodaj(karta, 'div', 'st-wykres');
    const odczyt = dodaj(karta, 'div', 'st-odczyt');
    rysujCzasy(host, odczyt, punkty);
  }

  function rysujCzasy(host, odczyt, punkty) {
    const WYS = 200, L = 40, P = 8, G = 8, D = 20, ODSTEP = 6;
    const p = nowySvg(host, WYS);
    const svg = p.svg;
    const x0 = L, x1 = p.szer - P, y0 = G, y1 = WYS - D;
    const sekundy = punkty.map(function (q) { return q.sec; });
    const skala = skalaCzasu(Math.min.apply(null, sekundy), Math.max.apply(null, sekundy));
    let tMin = dzienUTC(punkty[0].data);
    let tMax = dzienUTC(punkty[punkty.length - 1].data);
    const jedenDzien = tMin === tMax;
    if (jedenDzien) { tMin -= 15 * DOBA; tMax += 15 * DOBA; }
    function x(t) { return x0 + ODSTEP + (t - tMin) / (tMax - tMin) * (x1 - x0 - 2 * ODSTEP); }
    function y(sec) { return y1 - (sec - skala.min) / (skala.max - skala.min) * (y1 - y0); }

    for (let v = skala.min; v <= skala.max; v += skala.krok) {
      svg.appendChild(svgEl('line', { x1: x0, x2: x1, y1: y(v), y2: y(v), class: 'st-siatka' }));
      svg.appendChild(svgEl('text', { x: x0 - 6, y: y(v) + 3, 'text-anchor': 'end' }, Model.fmtCzas(v)));
    }

    function etykietaX(t, tekst) {
      const px = x(t);
      const kotwica = px > x1 - 16 ? 'end' : (px < x0 + 16 ? 'start' : 'middle');
      svg.appendChild(svgEl('text', { x: px, y: WYS - 6, 'text-anchor': kotwica }, tekst));
    }
    const kreski = jedenDzien ? [] : kreskiMiesiecy(tMin, tMax);
    if (kreski.length) {
      kreski.forEach(function (k) { etykietaX(k.t, k.etykieta); });
    } else {
      // zakres krótszy niż miesiąc — podpisujemy skrajne daty
      const pierwsza = punkty[0].data, ostatnia = punkty[punkty.length - 1].data;
      etykietaX(dzienUTC(pierwsza), pierwsza.slice(8, 10) + '.' + pierwsza.slice(5, 7));
      if (ostatnia !== pierwsza) etykietaX(dzienUTC(ostatnia), ostatnia.slice(8, 10) + '.' + ostatnia.slice(5, 7));
    }

    if (punkty.length > 1) {
      svg.appendChild(svgEl('polyline', {
        points: punkty.map(function (q) { return x(dzienUTC(q.data)).toFixed(1) + ',' + y(q.sec).toFixed(1); }).join(' '),
        class: 'st-linia-czasu'
      }));
    }
    if (wybrany.punkt != null && wybrany.punkt >= punkty.length) wybrany.punkt = null;
    punkty.forEach(function (q, i) {
      if (i === wybrany.punkt) return;
      svg.appendChild(svgEl('circle', { cx: x(dzienUTC(q.data)), cy: y(q.sec), r: 2.5, class: 'st-punkt' }));
    });
    if (wybrany.punkt != null) {
      const q = punkty[wybrany.punkt];
      svg.appendChild(svgEl('circle', { cx: x(dzienUTC(q.data)), cy: y(q.sec), r: 4.5, class: 'st-punkt wybrany' }));
      odczyt.textContent = q.data + ' — ' + Model.fmtCzas(q.sec) +
        (q.metry !== dystansCzasu ? ' · sesja ' + Model.fmtMetry(q.metry) : '');
    } else {
      odczyt.textContent = 'Dotknij wykresu, żeby zobaczyć czas z wybranej sesji.';
    }

    const hit = svgEl('rect', { x: x0, y: y0, width: x1 - x0, height: y1 - y0, class: 'st-hit' });
    hit.addEventListener('click', function (e) {
      const px = pozycjaX(svg, p.szer, e);
      let najblizszy = 0, odleglosc = Infinity;
      punkty.forEach(function (q, i) {
        const d = Math.abs(x(dzienUTC(q.data)) - px);
        if (d < odleglosc) { odleglosc = d; najblizszy = i; }
      });
      wybrany.punkt = najblizszy;
      render();
    });
    svg.appendChild(hit);
  }

  App.zarejestrujWidok({
    id: 'statystyki',
    etykieta: 'Statystyki',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj,
    odswiez: render
  });

  // Eksport tylko tego, czego potrzebują Ustawienia (próg) i testy (czyste obliczenia).
  return {
    PROGI_SESJI: PROGI_SESJI,
    minSesji: minSesji,
    tydzienRoku: tydzienRoku,
    czasNaDystansie: czasNaDystansie,
    policz: policz,
    histogram: histogram
  };
})();
