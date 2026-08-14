window.Historia = (function () {
  const NAZWY_MIESIECY = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

  let kontenerGlobalny = null;
  let rozwinietaId = null;
  let rozwinieteLata = null;
  let rozwinieteMiesiace = null;

  function montuj(kontener) {
    kontenerGlobalny = kontener;
    render();
  }

  function odmontuj() {
    if (kontenerGlobalny) kontenerGlobalny.innerHTML = '';
    kontenerGlobalny = null;
  }

  function posortowane(sesje) {
    return sesje.slice().sort(function (a, b) {
      const kluczA = a.data + '_' + (a.utworzono || '');
      const kluczB = b.data + '_' + (b.utworzono || '');
      return kluczB.localeCompare(kluczA);
    });
  }

  function upewnijDomyslneRozwiniecie(sesje) {
    if (rozwinieteLata !== null) return;
    rozwinieteLata = new Set();
    rozwinieteMiesiace = new Set();
    if (sesje.length) {
      rozwinieteLata.add(sesje[0].data.slice(0, 4));
      rozwinieteMiesiace.add(sesje[0].data.slice(0, 7));
    }
  }

  function grupujPoRokuIMiesiacu(sesje) {
    const lata = new Map();
    sesje.forEach(function (s) {
      const rok = s.data.slice(0, 4);
      const miesiac = s.data.slice(0, 7);
      if (!lata.has(rok)) lata.set(rok, new Map());
      const miesiace = lata.get(rok);
      if (!miesiace.has(miesiac)) miesiace.set(miesiac, []);
      miesiace.get(miesiac).push(s);
    });
    return lata;
  }

  function nazwaMiesiaca(kluczMiesiac) {
    return NAZWY_MIESIECY[Number(kluczMiesiac.slice(5, 7)) - 1];
  }

  function fmtMetry(m) {
    return m.toLocaleString('pl-PL') + 'm';
  }

  function renderNaglowekGrupy(klucz, liczbaSesji, metry, tekstEtykiety, klasaDodatkowa, zbior) {
    const rozwinieta = zbior.has(klucz);
    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz ' + klasaDodatkowa;
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = rozwinieta ? '▾' : '▸';
    const tekst = document.createElement('span');
    tekst.textContent = tekstEtykiety + '  (' + liczbaSesji + ', ' + fmtMetry(metry) + ')';
    wiersz.appendChild(strzalka);
    wiersz.appendChild(tekst);
    wiersz.addEventListener('click', function () {
      if (rozwinieta) zbior.delete(klucz); else zbior.add(klucz);
      render();
    });
    return wiersz;
  }

  function render() {
    const kontener = kontenerGlobalny;
    const dok = Dane.wczytaj();
    const sesje = posortowane(dok.sesje);
    upewnijDomyslneRozwiniecie(sesje);

    kontener.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'view-scroll';
    kontener.appendChild(scroll);

    if (!sesje.length) {
      const brak = document.createElement('div');
      brak.className = 'card';
      brak.innerHTML = '<p class="hint">Brak zapisanych sesji.</p>';
      scroll.appendChild(brak);
    } else {
      const karta = document.createElement('div');
      karta.className = 'card';
      const etykieta = document.createElement('div');
      etykieta.className = 'section-label';
      etykieta.textContent = 'Historia sesji';
      karta.appendChild(etykieta);

      const lata = grupujPoRokuIMiesiacu(sesje);
      lata.forEach(function (miesiace, rok) {
        let liczbaSesjiRoku = 0;
        let metryRoku = 0;
        miesiace.forEach(function (arr) {
          liczbaSesjiRoku += arr.length;
          arr.forEach(function (s) { metryRoku += Model.dystans(s); });
        });
        karta.appendChild(renderNaglowekGrupy(rok, liczbaSesjiRoku, metryRoku, rok, 'historia-grupa-rok', rozwinieteLata));

        if (rozwinieteLata.has(rok)) {
          miesiace.forEach(function (sesjeMiesiaca, kluczMiesiac) {
            let metryMiesiaca = 0;
            sesjeMiesiaca.forEach(function (s) { metryMiesiaca += Model.dystans(s); });
            karta.appendChild(renderNaglowekGrupy(
              kluczMiesiac, sesjeMiesiaca.length, metryMiesiaca, nazwaMiesiaca(kluczMiesiac),
              'historia-grupa-miesiac', rozwinieteMiesiace
            ));

            if (rozwinieteMiesiace.has(kluczMiesiac)) {
              sesjeMiesiaca.forEach(function (s) { karta.appendChild(renderPozycja(s)); });
            }
          });
        }
      });
      scroll.appendChild(karta);
    }
  }

  function renderPozycja(sesjaPoczatkowa) {
    let s = sesjaPoczatkowa;
    const rozwinieta = rozwinietaId === s.id;
    const wrapper = document.createElement('div');

    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz historia-wiersz-sesja';
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = rozwinieta ? '▾' : '▸';
    const tekst = document.createElement('span');
    wiersz.appendChild(strzalka);
    wiersz.appendChild(tekst);

    function nazwaTagu(tag) {
      return tag && tag !== 'brak' ? tag : '';
    }

    function aktualizujWiersz() {
      const reczny = s.recznyDystans != null;
      const tag = nazwaTagu(s.tag);
      tekst.textContent = s.data + '  —  ' + (s.basen ? s.basen + 'm basen' : 'basen: brak danych') + '  —  ' +
        Model.dystans(s) + 'm' +
        (reczny
          ? '  (wpis ręczny' + (s.recznyCzas != null ? ', ' + Model.fmtCzas(s.recznyCzas) : '') + ')'
          : '  —  ' + Model.fmtCzas(Model.czasRazem(s))) +
        (tag ? '  —  ' + tag : '');
    }
    aktualizujWiersz();
    wiersz.addEventListener('click', function () {
      rozwinietaId = rozwinieta ? null : s.id;
      render();
    });
    wrapper.appendChild(wiersz);

    if (rozwinieta) {
      const szczegoly = document.createElement('div');
      szczegoly.style.margin = '10px 0 16px';

      const tabelaDiv = document.createElement('div');
      szczegoly.appendChild(tabelaDiv);
      SesjaTabela.render(tabelaDiv, s, { edytowalna: false });

      const btnRow = document.createElement('div');
      btnRow.className = 'btn-row';

      const czyReczna = s.recznyDystans != null;
      const btnKopiuj = document.createElement('button');
      btnKopiuj.className = 'primary small';
      btnKopiuj.textContent = 'Kopiuj do Excela';
      if (!czyReczna) btnRow.appendChild(btnKopiuj);
      szczegoly.appendChild(btnRow);

      const eksportDiv = document.createElement('div');
      eksportDiv.style.marginTop = '1rem';
      szczegoly.appendChild(eksportDiv);

      btnKopiuj.addEventListener('click', function () {
        eksportDiv.innerHTML =
          '<div class="export-area">' +
            '<div class="lbl">Kliknij w Excelu w pustą komórkę A1 nowego bloku i wklej (Ctrl+V):</div>' +
            '<textarea id="csvTextHist" spellcheck="false" readonly inputmode="none">' + Model.buildExportExcel(s) + '</textarea>' +
            '<div class="copy-btn-row">' +
              '<button class="small" id="copySchowekHist">Kopiuj do schowka</button>' +
              '<span class="copied" id="copiedMsgHist"></span>' +
            '</div>' +
          '</div>';
        const ta = eksportDiv.querySelector('#csvTextHist');
        eksportDiv.querySelector('#copySchowekHist').addEventListener('click', function () {
          const msg = eksportDiv.querySelector('#copiedMsgHist');
          App.kopiujDoSchowka(ta, function () {
            msg.textContent = 'Skopiowano!';
            setTimeout(function () { msg.textContent = ''; }, 2000);
          });
        });
      });

      wrapper.appendChild(szczegoly);
    }

    return wrapper;
  }

  App.zarejestrujWidok({
    id: 'historia',
    etykieta: 'Historia',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj
  });

  return {};
})();
