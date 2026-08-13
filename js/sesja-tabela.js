window.SesjaTabela = (function () {
  const stanPerKontener = new WeakMap();

  function pobierzStan(kontener) {
    let stan = stanPerKontener.get(kontener);
    if (!stan) {
      stan = { trybEdycji: false };
      stanPerKontener.set(kontener, stan);
    }
    return stan;
  }

  function render(kontener, sesja, opts) {
    opts = opts || {};
    const stan = pobierzStan(kontener);
    stan.sesja = sesja;
    stan.edytowalna = !!opts.edytowalna;
    stan.onZmiana = opts.onZmiana || function () {};
    // Tracker pokazuje kafelki z zerami i zachętę zamiast "Brak splitów"
    stan.pustyTekst = opts.pustyTekst || null;
    if (!stan.edytowalna) stan.trybEdycji = false;
    rysuj(kontener, stan);
  }

  function rysuj(kontener, stan) {
    const sesja = stan.sesja;
    const splity = sesja.splity || [];
    kontener.innerHTML = '';

    const karta = document.createElement('div');
    karta.className = 'card';

    const naglowek = document.createElement('div');
    naglowek.className = 'tabela-naglowek';
    const etykieta = document.createElement('div');
    etykieta.className = 'section-label';
    etykieta.textContent = 'Podsumowanie';
    naglowek.appendChild(etykieta);
    if (stan.edytowalna && splity.length) {
      const btnEdytuj = document.createElement('button');
      btnEdytuj.className = 'small';
      btnEdytuj.textContent = stan.trybEdycji ? 'Gotowe' : 'Edytuj';
      btnEdytuj.addEventListener('click', function () {
        stan.trybEdycji = !stan.trybEdycji;
        rysuj(kontener, stan);
      });
      naglowek.appendChild(btnEdytuj);
    }
    karta.appendChild(naglowek);

    if (!splity.length && (sesja.recznyDystans != null || !stan.pustyTekst)) {
      const brak = document.createElement('p');
      brak.className = 'hint';
      brak.textContent = sesja.recznyDystans != null
        ? 'Trening ręczny — dystans ' + sesja.recznyDystans + 'm (bez splitów).'
        : 'Brak splitów.';
      karta.appendChild(brak);
      kontener.appendChild(karta);
      return;
    }

    const grid = document.createElement('div');
    grid.className = 'sum-grid';
    grid.innerHTML =
      kafelekSum('sum-cell-swim', [
        ['Dystans', Model.dystans(sesja) + 'm'],
        ['Suma', Model.fmtCzas(Model.czasRazem(sesja))]
      ]) +
      kafelekSum('', [
        ['Pływanie', Model.fmtCzas(Model.czasPlywania(sesja))],
        ['Przerwy', Model.fmtCzas(Model.czasPrzerw(sesja))]
      ]);
    karta.appendChild(grid);

    // Sesja rozpoczęta, ale bez splitów — kafelki z zerami + zachęta zamiast tabeli
    if (!splity.length) {
      const pusty = document.createElement('p');
      pusty.className = 'hint tabela-pusta';
      pusty.textContent = stan.pustyTekst;
      karta.appendChild(pusty);
      kontener.appendChild(karta);
      return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'tbl-wrap';
    const tabela = document.createElement('table');

    if (stan.trybEdycji) {
      // szósta kolumna (usuwanie) potrzebuje własnych szerokości — patrz .tbl-edycja w CSS
      tabela.className = 'tbl-edycja';
      tabela.innerHTML =
        '<thead><tr><th>Dystans</th><th>Czas 100m</th><th>Przerwa</th><th>Czas zbiorczy</th><th>Zbiorczy +&nbsp;przerwa</th><th></th></tr></thead>';
      const tbody = document.createElement('tbody');

      tbody.appendChild(wierszWstaw(0, kontener, stan));
      splity.forEach(function (sp, i) {
        tbody.appendChild(wierszSplitu(i, kontener, stan));
        tbody.appendChild(wierszWstaw(i + 1, kontener, stan));
      });

      tabela.appendChild(tbody);
    } else {
      tabela.innerHTML =
        '<thead><tr><th>Dystans</th><th>Czas 100m</th><th>Przerwa</th><th>Czas zbiorczy</th><th>Zbiorczy +&nbsp;przerwa</th></tr></thead>';
      const tbody = document.createElement('tbody');
      for (let i = splity.length - 1; i >= 0; i--) {
        tbody.appendChild(wierszSplituOdczyt(sesja, i));
      }
      tabela.appendChild(tbody);
    }

    wrap.appendChild(tabela);
    karta.appendChild(wrap);

    if (stan.trybEdycji) {
      const dock = document.createElement('div');
      dock.className = 'keypad-dock';
      dock.id = 'tabelaKeypadDock';
      karta.appendChild(dock);
    }

    const blad = document.createElement('div');
    blad.className = 'err-msg';
    blad.id = 'sesjaTabelaBlad';
    karta.appendChild(blad);

    kontener.appendChild(karta);
  }

  // Jeden kafelek mieści dwie wartości obok siebie — dwa kafelki zamiast czterech
  // oszczędzają wysokość, której na telefonie brakuje przy pełnej sesji.
  function kafelekSum(klasaDodatkowa, pary) {
    return '<div class="sum-cell sum-cell-para ' + (klasaDodatkowa || '') + '">' +
      pary.map(function (para) {
        return '<div class="sum-item"><div class="sum-cell-label">' + para[0] +
          '</div><div class="sum-cell-val">' + para[1] + '</div></div>';
      }).join('') +
    '</div>';
  }

  // Wartości pochodne jednego splitu — współdzielone przez wiersz edycji i wiersz podglądu.
  function obliczSplit(sesja, i) {
    const sp = sesja.splity[i];
    const dystans = Model.dystansSplitu(i);
    const czyOstatni = i === sesja.splity.length - 1;
    const maKoniec = czyOstatni && sesja.koniec && sesja.koniec.sec != null;
    const zb = (sesja.zbiorcze || {})[String(dystans)];
    const pokazZbiorczy = maKoniec || dystans % 500 === 0;
    const zbSek = maKoniec ? sesja.koniec.sec : (zb ? zb.swimSec : null);
    const zbRest = maKoniec ? null : (zb ? zb.restSec : null);
    return { sp: sp, dystans: dystans, maKoniec: maKoniec, zb: zb, pokazZbiorczy: pokazZbiorczy, zbSek: zbSek, zbRest: zbRest };
  }

  // Wiersz podglądu (bez edycji), lista odwrotnie chronologiczna — 5 kolumn jak w trybie edycji.
  function wierszSplituOdczyt(sesja, i) {
    const s = obliczSplit(sesja, i);
    const tr = document.createElement('tr');
    if (s.maKoniec) tr.className = 'row-last';
    else if (s.zb) tr.className = 'row-ms';

    tr.appendChild(komorkaTekst(s.dystans + 'm'));
    tr.appendChild(komorkaTekst(Model.fmtCzas(s.sp.sec)));
    tr.appendChild(komorkaTekst(s.sp.przerwa != null ? Model.fmtCzas(s.sp.przerwa) : '', 'td-przerwa'));

    if (s.pokazZbiorczy) {
      const doWeryfikacji = !s.maKoniec && s.zb && s.zb.doWeryfikacji;
      tr.appendChild(komorkaTekst(
        s.zbSek != null ? Model.fmtCzas(s.zbSek) + (doWeryfikacji ? ' ⚠' : '') : '',
        'td-ms'
      ));
      tr.appendChild(komorkaTekst(!s.maKoniec && s.zbRest != null ? Model.fmtCzas(s.zbRest) : '', 'td-ms-rest'));
    } else {
      tr.appendChild(komorkaTekst(''));
      tr.appendChild(komorkaTekst(''));
    }

    return tr;
  }

  function pokazBlad(kontener, msg) {
    const el = kontener.querySelector('#sesjaTabelaBlad');
    if (el) el.textContent = msg;
  }

  function zmien(kontener, stan, nowaSesja) {
    stan.sesja = nowaSesja;
    stan.onZmiana(nowaSesja);
    rysuj(kontener, stan);
  }

  function komorkaTekst(tekst, klasa) {
    const td = document.createElement('td');
    td.textContent = tekst;
    if (klasa) td.className = klasa;
    return td;
  }

  function ustawZbiorcze(sesja, dystans, pole, wartosc, czyscWeryfikacje) {
    const nowa = JSON.parse(JSON.stringify(sesja));
    const klucz = String(dystans);
    if (!nowa.zbiorcze) nowa.zbiorcze = {};
    if (!nowa.zbiorcze[klucz]) nowa.zbiorcze[klucz] = { swimSec: null, restSec: null, doWeryfikacji: false };
    nowa.zbiorcze[klucz][pole] = wartosc;
    if (czyscWeryfikacje) nowa.zbiorcze[klucz].doWeryfikacji = false;
    return nowa;
  }

  function wierszWstaw(i, kontener, stan) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 6;
    td.style.textAlign = 'center';
    td.style.padding = '2px';
    const btn = document.createElement('button');
    btn.className = 'small';
    btn.textContent = '+';
    btn.title = 'Wstaw split';
    btn.addEventListener('click', function () {
      const nowa = Model.wstawSplit(stan.sesja, i);
      zmien(kontener, stan, nowa);
      const wiersz = kontener.querySelector('tr[data-idx="' + i + '"]');
      const komorka = wiersz && wiersz.querySelector('td.td-sec');
      if (komorka) komorka.click();
    });
    td.appendChild(btn);
    tr.appendChild(td);
    return tr;
  }

  function wierszSplitu(i, kontener, stan) {
    const sesja = stan.sesja;
    const s = obliczSplit(sesja, i);
    const dystans = s.dystans;
    const maKoniec = s.maKoniec;
    const zb = s.zb;

    const tr = document.createElement('tr');
    tr.dataset.idx = String(i);
    if (maKoniec) tr.className = 'row-last';
    else if (zb) tr.className = 'row-ms';

    tr.appendChild(komorkaTekst(dystans + 'm'));

    const tdSec = utworzKomorkeCzasu(kontener, stan, {
      tekst: Model.fmtCzas(s.sp.sec),
      sekundy: s.sp.sec,
      ustaw: function (nowySek) { return Model.ustawPole(sesja, 'splity.' + i + '.sec', nowySek); }
    });
    tdSec.classList.add('td-sec');
    tr.appendChild(tdSec);

    tr.appendChild(utworzKomorkeCzasu(kontener, stan, {
      tekst: s.sp.przerwa != null ? Model.fmtCzas(s.sp.przerwa) : '',
      sekundy: s.sp.przerwa,
      klasa: 'td-przerwa',
      ustaw: function (nowySek) { return Model.ustawPole(sesja, 'splity.' + i + '.przerwa', nowySek); }
    }));

    if (s.pokazZbiorczy) {
      tr.appendChild(utworzKomorkeCzasu(kontener, stan, {
        tekst: s.zbSek != null ? Model.fmtCzas(s.zbSek) : '',
        sekundy: s.zbSek,
        klasa: 'td-ms',
        doWeryfikacji: !maKoniec && zb && zb.doWeryfikacji,
        ustaw: function (nowySek) {
          return maKoniec
            ? Model.ustawPole(sesja, 'koniec.sec', nowySek)
            : ustawZbiorcze(sesja, dystans, 'swimSec', nowySek, true);
        }
      }));

      if (maKoniec) {
        tr.appendChild(komorkaTekst(''));
      } else {
        tr.appendChild(utworzKomorkeCzasu(kontener, stan, {
          tekst: s.zbRest != null ? Model.fmtCzas(s.zbRest) : '',
          sekundy: s.zbRest,
          klasa: 'td-ms-rest',
          minWiekszeNiz: s.zbSek,
          ustaw: function (nowySek) { return ustawZbiorcze(sesja, dystans, 'restSec', nowySek, false); }
        }));
      }
    } else {
      tr.appendChild(komorkaTekst(''));
      tr.appendChild(komorkaTekst(''));
    }

    if (stan.trybEdycji) {
      const tdUsun = document.createElement('td');
      const btnUsun = document.createElement('button');
      btnUsun.className = 'small danger';
      btnUsun.textContent = '×';
      btnUsun.addEventListener('click', function () {
        if (!confirm('Usunąć split ' + dystans + 'm?')) return;
        zmien(kontener, stan, Model.usunSplit(sesja, i));
      });
      tdUsun.appendChild(btnUsun);
      tr.appendChild(tdUsun);
    }

    return tr;
  }

  function utworzKomorkeCzasu(kontener, stan, opcje) {
    const td = document.createElement('td');
    if (opcje.klasa) td.className = opcje.klasa;

    if (!stan.trybEdycji) {
      td.textContent = opcje.tekst + (opcje.doWeryfikacji ? ' ⚠' : '');
      if (opcje.doWeryfikacji) td.title = 'Sprawdź — zmieniła się liczba splitów';
      return td;
    }

    function pokazWidok() {
      td.innerHTML = '';
      const span = document.createElement('span');
      span.textContent = (opcje.tekst || '—') + (opcje.doWeryfikacji ? ' ⚠' : '');
      td.appendChild(span);
      td.onclick = pokazEdycje;
    }

    function pokazEdycje() {
      td.onclick = null;
      td.innerHTML = '';
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 4;
      input.value = opcje.sekundy != null ? Model.secNaCyfry(opcje.sekundy) : '';
      td.appendChild(input);
      const dock = kontener.querySelector('#tabelaKeypadDock');
      if (dock) Keypad.mountOnFocus(input, dock);
      input.focus();
      input.select();

      let juz = false;

      function zatwierdz() {
        if (juz) return;
        const surowy = input.value.trim();
        if (surowy === '') {
          juz = true;
          pokazBlad(kontener, '');
          zmien(kontener, stan, opcje.ustaw(null));
          return;
        }
        const sek = Model.parsujCzas(surowy);
        if (sek === null) {
          input.classList.add('err');
          pokazBlad(kontener, 'Nieprawidłowy czas — sekundy nie mogą być ≥ 60.');
          return;
        }
        if (sek === 0) {
          input.classList.add('err');
          pokazBlad(kontener, 'Czas nie może być zerowy — wyczyść pole, jeśli chcesz usunąć wartość.');
          return;
        }
        if (opcje.minWiekszeNiz != null && sek <= opcje.minWiekszeNiz) {
          input.classList.add('err');
          pokazBlad(kontener, 'Czas z przerwą musi być większy niż czas zbiorczy pływania.');
          return;
        }
        juz = true;
        pokazBlad(kontener, '');
        zmien(kontener, stan, opcje.ustaw(sek));
      }

      function anuluj() {
        if (juz) return;
        juz = true;
        pokazWidok();
      }

      input.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); zatwierdz(); }
        else if (e.key === 'Escape') { e.preventDefault(); anuluj(); }
      });
      input.addEventListener('blur', function () { setTimeout(zatwierdz, 0); });
    }

    pokazWidok();
    return td;
  }

  return { render: render };
})();
