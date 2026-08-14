window.Ustawienia = (function () {
  const PRESETY_TAGOW = ['Trening A - długie odcinki', 'Trening B - krótkie interwały'];
  const NAZWY_MIESIECY = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
    'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

  let kontenerGlobalny = null;
  let rozwinieteLata = new Set();
  let rozwinieteMiesiace = new Set();
  let zaznaczoneIdUsun = new Set();
  let trybUsuwania = false;
  let idSesjiEdycji = null;
  // domyślnie zwinięta — pola ID Gista i tokenu nie mają leżeć na wierzchu
  let syncRozwinieta = false;
  // domyślnie zwinięta — jak karta „Synchronizacja", nie leży na wierzchu Ustawień
  let planRozwinieta = false;
  // Odswiez() z tla (status-zmieniony przy push/pull) nie moze przerysowac karty,
  // dopoki uzytkownik cos wpisuje w pola ID/token — skasowaloby niezapisany tekst.
  let syncPoleFocus = false;

  function montuj(kontener) {
    kontenerGlobalny = kontener;
    render();
  }

  function odmontuj() {
    if (kontenerGlobalny) kontenerGlobalny.innerHTML = '';
    kontenerGlobalny = null;
  }

  function render() {
    const kontener = kontenerGlobalny;
    kontener.innerHTML = '';
    const scroll = document.createElement('div');
    scroll.className = 'view-scroll';
    scroll.appendChild(renderKopiaIEksport());
    scroll.appendChild(renderPlanTreningowy());
    scroll.appendChild(renderSynchronizacja());
    if (Dane.tryb() !== 'gosc') scroll.appendChild(renderEdycja());
    const wersja = document.createElement('p');
    wersja.className = 'stopka-wersja';
    wersja.textContent = 'SwimApp v' + window.APP_VERSION;
    scroll.appendChild(wersja);
    kontener.appendChild(scroll);
  }

  function renderKopiaIEksport() {
    const dok = Dane.wczytaj();
    const gosc = Dane.tryb() === 'gosc';
    const lata = Array.from(new Set(dok.sesje.map(function (s) { return s.data.slice(0, 4); })))
      .sort().reverse();

    const karta = document.createElement('div');
    karta.className = 'card';
    karta.innerHTML =
      '<div class="section-label">Kopia zapasowa / eksport (JSON)</div>' +
      '<div class="input-row">' +
        '<label class="cb-label"><input type="radio" name="expZakres" value="wszystko" checked> Wszystko</label>' +
        '<label class="cb-label"><input type="radio" name="expZakres" value="rok"> Rok</label>' +
        '<select id="expRok" style="display:none;">' +
          lata.map(function (r) { return '<option value="' + r + '">' + r + '</option>'; }).join('') +
        '</select>' +
        '<label class="cb-label"><input type="radio" name="expZakres" value="ostatnie5"> Ostatnie 5 treningów</label>' +
      '</div>' +
      '<div class="btn-row" style="margin-top:0;">' +
        '<button class="primary" id="pobierzBtn">Pobierz JSON</button>' +
        (gosc ? '' : '<button class="small" id="wczytajBtn">Wczytaj JSON</button>') +
      '</div>' +
      (gosc ? '' : '<input type="file" id="wczytajInput" accept="application/json" style="display:none;">') +
      '<div class="err-msg" id="expMsg"></div>';

    const rokSel = karta.querySelector('#expRok');
    karta.querySelectorAll('input[name="expZakres"]').forEach(function (r) {
      r.addEventListener('change', function () {
        rokSel.style.display = karta.querySelector('input[name="expZakres"]:checked').value === 'rok' ? '' : 'none';
      });
    });

    karta.querySelector('#pobierzBtn').addEventListener('click', function () { pobierzWybraneJSON(karta); });

    if (gosc) return karta;

    const input = karta.querySelector('#wczytajInput');
    karta.querySelector('#wczytajBtn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      const plik = input.files[0];
      if (!plik) return;
      const reader = new FileReader();
      reader.onload = function () {
        try {
          const wynik = Dane.importJSON(reader.result);
          input.value = '';
          render();
          const msgEl = kontenerGlobalny.querySelector('#expMsg');
          if (msgEl) {
            msgEl.textContent = 'Dodano ' + wynik.dodano + ' nowych sesji' +
              (wynik.pominieto ? ' (pominięto ' + wynik.pominieto + ' już istniejących).' : '.') +
              (wynik.odhaczenia ? ' Odtworzono ' + wynik.odhaczenia + ' odhaczeń planu.' : '');
          }
        } catch (e) {
          karta.querySelector('#expMsg').textContent = e.message;
        }
      };
      reader.readAsText(plik);
    });

    return karta;
  }

  function renderPlanTreningowy() {
    const dok = Dane.wczytaj();
    const def = Plan.aktywny();
    const zrobione = dok.plan.wykonane[def.id] || {};
    let wszystkich = 0;
    let odhaczonych = 0;
    Plan.tygodnie(def).forEach(function (tydzien) {
      tydzien.treningi.forEach(function (trening) {
        wszystkich++;
        if (zrobione[Plan.kluczTreningu(tydzien.numer, trening.wariant)]) odhaczonych++;
      });
    });
    const jestWbudowany = !dok.plan.definicja;
    const gosc = Dane.tryb() === 'gosc';

    const karta = document.createElement('div');
    karta.className = 'card';

    // zwijanie jak w karcie „Synchronizacja": tytuł z lewej, obracana strzałka z prawej
    const naglowek = document.createElement('div');
    naglowek.className = 'karta-head';
    const tytul = document.createElement('div');
    tytul.className = 'section-label';
    tytul.textContent = 'Plan treningowy';
    const strzalka = document.createElement('span');
    strzalka.className = 'chevron' + (planRozwinieta ? ' open' : '');
    strzalka.textContent = '▾';
    naglowek.appendChild(tytul);
    naglowek.appendChild(strzalka);
    naglowek.addEventListener('click', function () {
      planRozwinieta = !planRozwinieta;
      render();
    });
    karta.appendChild(naglowek);

    if (!planRozwinieta) return karta;

    const tresc = document.createElement('div');
    tresc.style.marginTop = '14px';
    tresc.innerHTML =
      '<div class="plan-dzis-nazwa">' + def.nazwa + '</div>' +
      '<p class="hint" style="margin-top:2px;">' + def.podtytul + '</p>' +
      '<p class="hint">Odhaczone: ' + odhaczonych + ' z ' + wszystkich + ' treningów</p>' +
      '<div class="btn-row">' +
        '<button class="primary" id="planPobierzBtn">Pobierz plan</button>' +
        (gosc ? '' : '<button class="small" id="planWczytajBtn">Wczytaj plan</button>') +
        (gosc || jestWbudowany ? '' : '<button class="small" id="planWbudowanyBtn">Przywróć wbudowany</button>') +
      '</div>' +
      (gosc ? '' : '<input type="file" id="planWczytajInput" accept="application/json" style="display:none;">') +
      '<div class="err-msg" id="planMsg"></div>';
    karta.appendChild(tresc);

    tresc.querySelector('#planPobierzBtn').addEventListener('click', function () {
      pobierzJSON(
        { typ: 'swimapp-plan', wersjaFormatu: 1, plan: def, wykonane: zrobione },
        'swimapp-plan-' + def.id + '-' + new Date().toISOString().slice(0, 10) + '.json'
      );
    });

    if (gosc) return karta;

    const input = karta.querySelector('#planWczytajInput');
    karta.querySelector('#planWczytajBtn').addEventListener('click', function () { input.click(); });
    input.addEventListener('change', function () {
      const plik = input.files[0];
      if (!plik) return;
      const reader = new FileReader();
      reader.onload = function () {
        input.value = '';
        try {
          wczytajPlanZPliku(reader.result);
          render();
        } catch (e) {
          const msgEl = kontenerGlobalny.querySelector('#planMsg');
          if (msgEl) msgEl.textContent = e.message;
        }
      };
      reader.readAsText(plik);
    });

    const wbudowanyBtn = karta.querySelector('#planWbudowanyBtn');
    if (wbudowanyBtn) {
      wbudowanyBtn.addEventListener('click', function () {
        const d = Dane.wczytaj();
        d.plan.definicja = null;
        d.plan.aktywnyPlan = Plan.WBUDOWANY.id;
        Dane.zapisz(d);
        render();
      });
    }

    return karta;
  }

  function wczytajPlanZPliku(tekst) {
    let plik;
    try {
      plik = JSON.parse(tekst);
    } catch (e) {
      throw new Error('Plik nie jest poprawnym JSON-em.');
    }
    if (!plik || plik.typ !== 'swimapp-plan') {
      throw new Error('To nie jest plik planu SwimApp — użyj „Wczytaj JSON" powyżej dla pełnych danych.');
    }
    const wynik = Plan.waliduj(plik.plan);
    if (!wynik.ok) {
      throw new Error(wynik.bledy.join(' '));
    }
    const dok = Dane.wczytaj();
    dok.plan.definicja = plik.plan;
    dok.plan.aktywnyPlan = plik.plan.id;
    if (!dok.plan.wykonane[plik.plan.id] && plik.wykonane && typeof plik.wykonane === 'object') {
      dok.plan.wykonane[plik.plan.id] = plik.wykonane;
    }
    Dane.zapisz(dok);
  }

  function opisStatusuSync(s) {
    if (s.blad && s.blad.kod !== '401') return '⚠ ' + s.blad.komunikat;
    if (s.tryb === 'lokalny') return '⚠ Nieskonfigurowane — wklej ID Gista i token';
    if (s.blad && s.blad.kod === '401') return '⚠ ' + s.blad.komunikat;
    if (s.tryb === 'gosc') return '⚠ Tylko odczyt — wklej token, żeby zapisywać';
    if (s.niewyslane || s.wTrakcie) return '⏳ Niewysłane zmiany — czekają na połączenie';
    return '✓ Połączono — zapis włączony';
  }

  function renderSynchronizacja() {
    const karta = document.createElement('div');
    karta.className = 'card';
    const s = Dane.stanSync();

    // zwijanie jak w karcie „Sesja" w Trackerze: tytuł z lewej, obracana strzałka z prawej
    const naglowek = document.createElement('div');
    naglowek.className = 'karta-head';
    const tytul = document.createElement('div');
    tytul.className = 'section-label';
    tytul.textContent = 'Synchronizacja';
    const strzalka = document.createElement('span');
    strzalka.className = 'chevron' + (syncRozwinieta ? ' open' : '');
    strzalka.textContent = '▾';
    naglowek.appendChild(tytul);
    naglowek.appendChild(strzalka);
    naglowek.addEventListener('click', function () {
      syncRozwinieta = !syncRozwinieta;
      render();
    });
    karta.appendChild(naglowek);

    if (!syncRozwinieta) return karta;

    const tresc = document.createElement('div');
    tresc.style.marginTop = '14px';
    tresc.innerHTML =
      '<p class="hint" style="margin-top:0;">' + opisStatusuSync(s) +
        (s.ostatniOdczyt ? '<br>Ostatni odczyt: ' + fmtChwila(s.ostatniOdczyt) : '') + '</p>' +
      '<div class="input-row">' +
        '<input type="text" id="syncGistId" placeholder="ID Gista" style="flex:1;min-width:0;text-align:left;" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off" value="' + (s.idGista || '') + '">' +
      '</div>' +
      '<div class="input-row">' +
        '<input type="password" id="syncToken" placeholder="' + (s.tokenOgon ? 'github_pat_… ' + s.tokenOgon : 'Token GitHub') + '" ' +
          'autocapitalize="off" autocorrect="off" spellcheck="false" autocomplete="off">' +
      '</div>' +
      '<div class="btn-row" style="margin-top:8px;">' +
        '<button class="primary" id="syncSprawdz">Sprawdź i zapisz</button>' +
        '<button class="small" id="syncOdswiez">Odśwież z Gista</button>' +
        '<button class="small" id="syncUsun">Usuń z urządzenia</button>' +
      '</div>' +
      '<div class="err-msg" id="syncMsg"></div>';
    karta.appendChild(tresc);

    const poleId = tresc.querySelector('#syncGistId');
    const poleToken = tresc.querySelector('#syncToken');
    [poleId, poleToken].forEach(function (pole) {
      pole.addEventListener('focus', function () { syncPoleFocus = true; });
      pole.addEventListener('blur', function () { syncPoleFocus = false; });
    });

    const btnSprawdz = tresc.querySelector('#syncSprawdz');
    const msgEl = tresc.querySelector('#syncMsg');

    btnSprawdz.addEventListener('click', function () {
      const idGista = tresc.querySelector('#syncGistId').value;
      const token = tresc.querySelector('#syncToken').value;
      btnSprawdz.disabled = true;
      btnSprawdz.textContent = 'Sprawdzam…';
      msgEl.textContent = '';
      Dane.ustawKonfiguracje({ idGista: idGista, token: token }).then(function () {
        render();
      }).catch(function (e) {
        btnSprawdz.disabled = false;
        btnSprawdz.textContent = 'Sprawdź i zapisz';
        msgEl.textContent = e.message;
      });
    });

    tresc.querySelector('#syncOdswiez').addEventListener('click', function () {
      Dane.odswiez().then(function () { render(); });
    });

    tresc.querySelector('#syncUsun').addEventListener('click', function () {
      Dane.usunKonfiguracje();
      render();
    });

    return karta;
  }

  function fmtChwila(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('pl-PL') + ' ' + d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
  }

  function pobierzWybraneJSON(karta) {
    const dok = Dane.wczytaj();
    const wybrany = karta.querySelector('input[name="expZakres"]:checked').value;

    function klucz(s) { return s.data + '_' + (s.utworzono || ''); }
    const rosnaco = dok.sesje.slice().sort(function (a, b) { return klucz(a).localeCompare(klucz(b)); });

    let wybraneSesje;
    let etykietaZakresu;
    if (wybrany === 'rok') {
      const rok = karta.querySelector('#expRok').value;
      wybraneSesje = rosnaco.filter(function (s) { return s.data.slice(0, 4) === rok; });
      etykietaZakresu = rok;
    } else if (wybrany === 'ostatnie5') {
      wybraneSesje = rosnaco.slice(-5);
      etykietaZakresu = 'ostatnie5';
    } else {
      wybraneSesje = rosnaco;
      etykietaZakresu = 'wszystko';
    }

    const msg = karta.querySelector('#expMsg');
    if (!wybraneSesje.length) {
      msg.textContent = 'Brak sesji do eksportu w wybranym zakresie.';
      return;
    }
    msg.textContent = '';

    const eksportDok = {
      schemaVersion: dok.schemaVersion,
      ostatnia_modyfikacja: new Date().toISOString(),
      ustawienia: dok.ustawienia,
      plan: dok.plan,
      sesje: wybraneSesje
    };
    pobierzJSON(eksportDok, 'swim-eksport-' + etykietaZakresu + '-' + new Date().toISOString().slice(0, 10) + '.json');
  }

  // Wspolna sciezka pobierania pliku JSON (eksport sesji, eksport planu, migawka konfliktu).
  function pobierzJSON(obiekt, nazwaPliku) {
    const tekst = JSON.stringify(obiekt, null, 2);
    const blob = new Blob([tekst], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = nazwaPliku;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function opisSesji(s) {
    const reczny = s.recznyDystans != null;
    const tag = s.tag && s.tag !== 'brak' ? s.tag : '';
    return s.data + '  —  ' + Model.fmtMetry(Model.dystans(s)) +
      (reczny
        ? '  (wpis ręczny' + (s.recznyCzas != null ? ', ' + Model.fmtCzas(s.recznyCzas) : '') + ')'
        : '  —  ' + Model.fmtCzas(Model.czasRazem(s))) +
      (tag ? '  —  ' + tag : '');
  }

  function posortowane(sesje) {
    return sesje.slice().sort(function (a, b) {
      const kluczA = a.data + '_' + (a.utworzono || '');
      const kluczB = b.data + '_' + (b.utworzono || '');
      return kluczB.localeCompare(kluczA);
    });
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

  function toggleZaznaczenie(id) {
    if (zaznaczoneIdUsun.has(id)) zaznaczoneIdUsun.delete(id); else zaznaczoneIdUsun.add(id);
  }

  function toggleZaznaczenieGrupy(sesjeGrupy) {
    const wszystkieZaznaczone = sesjeGrupy.every(function (s) { return zaznaczoneIdUsun.has(s.id); });
    sesjeGrupy.forEach(function (s) {
      if (wszystkieZaznaczone) zaznaczoneIdUsun.delete(s.id); else zaznaczoneIdUsun.add(s.id);
    });
  }

  // Nagłówek grupy roku/miesiąca — w trybie usuwania dokłada checkbox zbiorczy.
  function renderNaglowekGrupy(klucz, sesjeGrupy, tekstEtykiety, klasaDodatkowa, zbiorRozwiniecia) {
    const rozwinieta = zbiorRozwiniecia.has(klucz);
    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz ' + klasaDodatkowa;

    let liczbaZaznaczonych = 0;
    if (trybUsuwania) {
      liczbaZaznaczonych = sesjeGrupy.filter(function (s) { return zaznaczoneIdUsun.has(s.id); }).length;
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = liczbaZaznaczonych === sesjeGrupy.length;
      cb.indeterminate = liczbaZaznaczonych > 0 && liczbaZaznaczonych < sesjeGrupy.length;
      cb.addEventListener('click', function (e) {
        e.stopPropagation();
        toggleZaznaczenieGrupy(sesjeGrupy);
        render();
      });
      wiersz.appendChild(cb);
    }

    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = rozwinieta ? '▾' : '▸';

    const tekst = document.createElement('span');
    tekst.textContent = tekstEtykiety + '  (' + sesjeGrupy.length + ')' +
      (trybUsuwania && liczbaZaznaczonych ? ', zaznaczono ' + liczbaZaznaczonych : '');

    wiersz.appendChild(strzalka);
    wiersz.appendChild(tekst);
    wiersz.addEventListener('click', function () {
      if (rozwinieta) zbiorRozwiniecia.delete(klucz); else zbiorRozwiniecia.add(klucz);
      render();
    });
    return wiersz;
  }

  function renderPozycjaUsun(s) {
    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz historia-wiersz-sesja';

    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = zaznaczoneIdUsun.has(s.id);
    cb.addEventListener('click', function (e) {
      e.stopPropagation();
      toggleZaznaczenie(s.id);
      render();
    });

    const tekst = document.createElement('span');
    tekst.textContent = opisSesji(s);

    wiersz.appendChild(cb);
    wiersz.appendChild(tekst);
    wiersz.addEventListener('click', function () {
      toggleZaznaczenie(s.id);
      render();
    });
    return wiersz;
  }

  function renderPozycjaEdycji(s, oznaczZmiane) {
    const rozwinieta = idSesjiEdycji === s.id;
    const wrapper = document.createElement('div');

    const wiersz = document.createElement('div');
    wiersz.className = 'historia-wiersz historia-wiersz-sesja';
    const strzalka = document.createElement('span');
    strzalka.className = 'historia-strzalka';
    strzalka.textContent = rozwinieta ? '▾' : '▸';
    const tekst = document.createElement('span');
    tekst.textContent = opisSesji(s);
    wiersz.appendChild(strzalka);
    wiersz.appendChild(tekst);
    wiersz.addEventListener('click', function () {
      idSesjiEdycji = rozwinieta ? null : s.id;
      render();
    });
    wrapper.appendChild(wiersz);

    let formularz = null;
    if (rozwinieta) {
      formularz = renderFormularzEdycji(s, oznaczZmiane);
      wrapper.appendChild(formularz.card);
    }
    return { wrapper: wrapper, formularz: formularz };
  }

  function ustawAktywny(grupa, wartosc) {
    grupa.querySelectorAll('.toggle-btn').forEach(function (btn) {
      const klucz = btn.dataset.basen !== undefined ? btn.dataset.basen : btn.dataset.tag;
      btn.classList.toggle('active', klucz === wartosc);
    });
  }

  function renderFormularzEdycji(s, oznaczZmiane) {
    const czyReczna = s.recznyDystans != null;
    const czyPresetTag = PRESETY_TAGOW.indexOf(s.tag) !== -1;
    const card = document.createElement('div');
    card.className = 'card';
    card.style.margin = '6px 0 12px';
    card.innerHTML =
      '<div class="err-msg" id="edBlad"></div>' +
      '<div class="param-row"><input type="date" id="edData" class="chip" title="Data"></div>' +
      '<div class="param-row toggle-group" id="edBasenGroup">' +
        '<button type="button" class="toggle-btn" data-basen="">brak danych</button>' +
        '<button type="button" class="toggle-btn" data-basen="25">25 m</button>' +
        '<button type="button" class="toggle-btn" data-basen="50">50 m</button>' +
      '</div>' +
      '<div class="param-row toggle-group" id="edTagGroup">' +
        PRESETY_TAGOW.map(function (t) {
          return '<button type="button" class="toggle-btn" data-tag="' + t + '">' + t + '</button>';
        }).join('') +
        '<button type="button" class="toggle-btn" data-tag="__inny__">własny…</button>' +
      '</div>' +
      '<div class="param-row" id="edTagInnyRow" style="display:' + (czyPresetTag ? 'none' : '') + ';">' +
        '<input type="text" id="edTagInny" placeholder="własny tag (może być pusty)" style="width:180px;">' +
      '</div>' +
      (czyReczna
        ? '<div class="param-row">' +
            '<label class="cb-label">Dystans (m) <input type="text" id="edDystans" style="width:70px;"></label>' +
            '<label class="cb-label">Czas <input type="text" id="edCzas" style="width:70px;" placeholder="mm:ss"></label>' +
          '</div>'
        : '') +
      '<div id="edSplity" style="margin-top:10px;"></div>';

    const dataInp = card.querySelector('#edData');
    const basenGroup = card.querySelector('#edBasenGroup');
    const tagGroup = card.querySelector('#edTagGroup');
    const tagInnyRow = card.querySelector('#edTagInnyRow');
    const tagInny = card.querySelector('#edTagInny');

    dataInp.value = s.data;

    ustawAktywny(basenGroup, s.basen ? String(s.basen) : '');
    basenGroup.querySelectorAll('.toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () { ustawAktywny(basenGroup, btn.dataset.basen); sprawdzZmiane(); });
    });

    tagInny.value = czyPresetTag ? '' : (s.tag && s.tag !== 'brak' ? s.tag : '');
    ustawAktywny(tagGroup, czyPresetTag ? s.tag : '__inny__');
    tagGroup.querySelectorAll('.toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ustawAktywny(tagGroup, btn.dataset.tag);
        if (btn.dataset.tag === '__inny__') {
          tagInnyRow.style.display = '';
          tagInny.focus();
        } else {
          tagInnyRow.style.display = 'none';
        }
        sprawdzZmiane();
      });
    });
    tagInny.addEventListener('input', sprawdzZmiane);
    dataInp.addEventListener('change', sprawdzZmiane);

    let dystansInp, czasInp;
    if (czyReczna) {
      dystansInp = card.querySelector('#edDystans');
      dystansInp.value = String(s.recznyDystans);
      czasInp = card.querySelector('#edCzas');
      czasInp.value = s.recznyCzas != null ? Model.secNaCyfry(s.recznyCzas) : '';
      dystansInp.addEventListener('input', sprawdzZmiane);
      czasInp.addEventListener('input', sprawdzZmiane);
    }

    function pobierzAktualne() {
      const basenBtn = basenGroup.querySelector('.toggle-btn.active');
      const tagBtn = tagGroup.querySelector('.toggle-btn.active');
      return {
        data: dataInp.value,
        basen: basenBtn ? basenBtn.dataset.basen : '',
        tag: tagBtn && tagBtn.dataset.tag === '__inny__' ? tagInny.value : (tagBtn ? tagBtn.dataset.tag : ''),
        dystans: czyReczna ? dystansInp.value : null,
        czas: czyReczna ? czasInp.value : null
      };
    }
    const poczatkowyStan = JSON.stringify(pobierzAktualne());
    function sprawdzZmiane() {
      if (JSON.stringify(pobierzAktualne()) !== poczatkowyStan) oznaczZmiane();
    }

    const blad = card.querySelector('#edBlad');

    const splityDiv = card.querySelector('#edSplity');
    SesjaTabela.render(splityDiv, s, {
      edytowalna: true,
      onZmiana: function (nowaSesja) {
        nowaSesja.zmodyfikowano = new Date().toISOString();
        const dok = Dane.wczytaj();
        const idx = dok.sesje.findIndex(function (x) { return x.id === s.id; });
        if (idx !== -1) { dok.sesje[idx] = nowaSesja; Dane.zapisz(dok); }
        s = nowaSesja;
      }
    });

    function anuluj() {
      idSesjiEdycji = null;
      render();
    }

    function zapisz() {
      if (!dataInp.value) { blad.textContent = 'Podaj datę.'; return; }

      const basenBtn = basenGroup.querySelector('.toggle-btn.active');
      const tagBtn = tagGroup.querySelector('.toggle-btn.active');
      const zmiana = {
        data: dataInp.value,
        basen: basenBtn && basenBtn.dataset.basen ? Number(basenBtn.dataset.basen) : null,
        tag: tagBtn && tagBtn.dataset.tag === '__inny__' ? tagInny.value : (tagBtn ? tagBtn.dataset.tag : s.tag)
      };

      if (czyReczna) {
        const dystansVal = parseInt(dystansInp.value, 10);
        if (!dystansVal || dystansVal <= 0) {
          dystansInp.classList.add('err');
          blad.textContent = 'Podaj dystans w metrach (liczba > 0).';
          return;
        }
        dystansInp.classList.remove('err');
        zmiana.recznyDystans = dystansVal;
        if (czasInp.value.trim()) {
          const sek = Model.parsujCzas(czasInp.value);
          if (sek === null) {
            czasInp.classList.add('err');
            blad.textContent = 'Nieprawidłowy czas — sekundy nie mogą być ≥ 60.';
            return;
          }
          czasInp.classList.remove('err');
          zmiana.recznyCzas = sek;
        } else {
          zmiana.recznyCzas = null;
        }
      }

      const nowa = Object.assign({}, s, zmiana);
      nowa.zmodyfikowano = new Date().toISOString();
      const dok = Dane.wczytaj();
      const idx = dok.sesje.findIndex(function (x) { return x.id === s.id; });
      if (idx !== -1) { dok.sesje[idx] = nowa; Dane.zapisz(dok); }
      idSesjiEdycji = null;
      render();
    }

    return { card: card, zapisz: zapisz, anuluj: anuluj };
  }

  function renderEdycja() {
    const dok = Dane.wczytaj();
    const sesje = posortowane(dok.sesje);

    const karta = document.createElement('div');
    karta.className = 'card';

    // Lista najpierw — żeby wiedzieć, czy jakaś sesja jest właśnie edytowana
    // (jej Zapisz/Anuluj trafiają do nagłówka karty, patrz niżej). Przyciski
    // Zapisz/Anuluj są tworzone od razu, ale ukryte — formularz je odkrywa
    // dopiero wtedy, gdy faktycznie coś w nim zmieniono (sprawdzZmiane()).
    let aktywnyFormularz = null;

    const btnZapisz = document.createElement('button');
    btnZapisz.className = 'primary small';
    btnZapisz.textContent = 'Zapisz';
    btnZapisz.style.display = 'none';
    btnZapisz.addEventListener('click', function () { if (aktywnyFormularz) aktywnyFormularz.zapisz(); });

    const btnAnuluj = document.createElement('button');
    btnAnuluj.className = 'small';
    btnAnuluj.textContent = 'Anuluj';
    btnAnuluj.style.display = 'none';
    btnAnuluj.addEventListener('click', function () { if (aktywnyFormularz) aktywnyFormularz.anuluj(); });

    function oznaczZmiane() {
      btnZapisz.style.display = '';
      btnAnuluj.style.display = '';
    }

    const listaDiv = document.createElement('div');

    if (sesje.length) {
      const lata = grupujPoRokuIMiesiacu(sesje);
      lata.forEach(function (miesiace, rok) {
        const sesjeRoku = [];
        miesiace.forEach(function (arr) { sesjeRoku.push.apply(sesjeRoku, arr); });
        listaDiv.appendChild(renderNaglowekGrupy(rok, sesjeRoku, rok, 'historia-grupa-rok', rozwinieteLata));

        if (rozwinieteLata.has(rok)) {
          miesiace.forEach(function (sesjeMiesiaca, kluczMiesiac) {
            listaDiv.appendChild(renderNaglowekGrupy(
              kluczMiesiac, sesjeMiesiaca, nazwaMiesiaca(kluczMiesiac),
              'historia-grupa-miesiac', rozwinieteMiesiace
            ));
            if (rozwinieteMiesiace.has(kluczMiesiac)) {
              sesjeMiesiaca.forEach(function (s) {
                if (trybUsuwania) {
                  listaDiv.appendChild(renderPozycjaUsun(s));
                } else {
                  const pozycja = renderPozycjaEdycji(s, oznaczZmiane);
                  listaDiv.appendChild(pozycja.wrapper);
                  if (pozycja.formularz) aktywnyFormularz = pozycja.formularz;
                }
              });
            }
          });
        }
      });
    }

    const naglowek = document.createElement('div');
    naglowek.className = 'tabela-naglowek';
    const etykieta = document.createElement('div');
    etykieta.className = 'section-label';
    etykieta.textContent = 'Edycja';
    naglowek.appendChild(etykieta);

    const akcjeNaglowka = document.createElement('div');
    akcjeNaglowka.className = 'btn-row';
    akcjeNaglowka.style.margin = '0';

    if (aktywnyFormularz) {
      akcjeNaglowka.appendChild(btnZapisz);
      akcjeNaglowka.appendChild(btnAnuluj);
    } else if (trybUsuwania) {
      const btnUsun = document.createElement('button');
      btnUsun.className = 'small danger';
      btnUsun.textContent = zaznaczoneIdUsun.size ? 'Usuń zaznaczone (' + zaznaczoneIdUsun.size + ')' : 'Usuń zaznaczone';
      btnUsun.disabled = zaznaczoneIdUsun.size === 0;
      btnUsun.addEventListener('click', function () { usunZaznaczone(); });
      akcjeNaglowka.appendChild(btnUsun);

      const btnAnulujUsuwanie = document.createElement('button');
      btnAnulujUsuwanie.className = 'small';
      btnAnulujUsuwanie.textContent = 'Anuluj usuwanie';
      btnAnulujUsuwanie.addEventListener('click', function () {
        trybUsuwania = false;
        zaznaczoneIdUsun = new Set();
        render();
      });
      akcjeNaglowka.appendChild(btnAnulujUsuwanie);
    } else {
      const btnUsuwanie = document.createElement('button');
      btnUsuwanie.className = 'small';
      btnUsuwanie.textContent = 'Usuwanie';
      btnUsuwanie.addEventListener('click', function () {
        trybUsuwania = true;
        idSesjiEdycji = null;
        zaznaczoneIdUsun = new Set();
        render();
      });
      akcjeNaglowka.appendChild(btnUsuwanie);
    }

    naglowek.appendChild(akcjeNaglowka);
    karta.appendChild(naglowek);

    if (!sesje.length) {
      const brak = document.createElement('p');
      brak.className = 'hint';
      brak.textContent = 'Brak zapisanych sesji.';
      karta.appendChild(brak);
      return karta;
    }

    karta.appendChild(listaDiv);
    return karta;
  }

  function usunZaznaczone() {
    if (!zaznaczoneIdUsun.size) return;
    if (!confirm('Usunąć ' + zaznaczoneIdUsun.size + ' sesji? Tej operacji nie da się cofnąć.')) return;
    const dok = Dane.wczytaj();
    dok.sesje = dok.sesje.filter(function (s) { return !zaznaczoneIdUsun.has(s.id); });
    Dane.zapisz(dok);
    zaznaczoneIdUsun = new Set();
    render();
  }

  App.zarejestrujWidok({
    id: 'ustawienia',
    etykieta: 'Ustawienia',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj,
    // Otwarty formularz edycji sesji ma niezapisane pola w DOM — przerysowanie by je
    // skasowalo. Poza edycja karta jest bezstanowa, wiec bezpiecznie sie przerysowuje.
    odswiez: function () { if (idSesjiEdycji === null && !syncPoleFocus) render(); }
  });

  return {};
})();
