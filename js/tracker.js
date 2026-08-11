window.Tracker = (function () {
  const PRESETY_TAGOW = ['Trening A - długie odcinki', 'Trening B - krótkie interwały'];
  const CEL_DOMYSLNY = 2000;

  let sesja = sesjaPusta();
  let zakonczony = false;
  let zapisany = false;
  let kontenerGlobalny = null;
  let sesjaRozwinieta = true;
  let przerwaAktywna = false;
  let milestoneOtwarty = null;
  let wlasnyTagAktywny = false;

  function sesjaPusta() {
    const dok = Dane.wczytaj();
    return {
      id: null,
      data: new Date().toISOString().slice(0, 10),
      basen: dok.ustawienia.ostatniBasen || 25,
      tag: PRESETY_TAGOW[0],
      splity: [],
      zbiorcze: {},
      koniec: { sec: null },
      utworzono: null,
      zmodyfikowano: null
    };
  }

  function swimDist() {
    return Model.dystans(sesja);
  }

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
    kontener.innerHTML =
      '<div class="view-scroll">' +
        sesjaCardHtml() +
        '<div id="milestoneArea"></div>' +
        '<div id="endArea"></div>' +
        '<div id="summaryArea"></div>' +
        heroHtml() +
        '<div id="exportArea"></div>' +
      '</div>' +
      footerHtml();

    wireStatyczne(kontener);
    odswiezDynamiczne(kontener);
    if (zakonczony) showExport(kontener);
  }

  // ===== karta „Sesja" (zwijana, §5.1) =====

  function sesjaCardHtml() {
    const czyPreset = PRESETY_TAGOW.indexOf(sesja.tag) !== -1;
    wlasnyTagAktywny = !czyPreset;
    return '<div class="card">' +
      '<div class="sesja-head" id="sesjaHead">' +
        '<div class="sesja-head-txt">' +
          '<div class="section-label">Sesja</div>' +
          '<div class="sesja-summary" id="sesjaSummary"></div>' +
        '</div>' +
        '<span class="chevron' + (sesjaRozwinieta ? ' open' : '') + '" id="sesjaChevron">▾</span>' +
      '</div>' +
      '<div class="sesja-body" id="sesjaBody" style="display:' + (sesjaRozwinieta ? '' : 'none') + ';">' +
        '<div class="param-row"><input type="date" id="metaData" class="chip" title="Data"></div>' +
        '<div class="param-row toggle-group" id="basenGroup">' +
          '<button type="button" class="toggle-btn" data-basen="25">25 m</button>' +
          '<button type="button" class="toggle-btn" data-basen="50">50 m</button>' +
        '</div>' +
        '<div class="param-row toggle-group" id="tagGroup">' +
          PRESETY_TAGOW.map(function (t) {
            return '<button type="button" class="toggle-btn" data-tag="' + t + '">' + t + '</button>';
          }).join('') +
          '<button type="button" class="toggle-btn" data-tag="__inny__">własny…</button>' +
        '</div>' +
        '<div class="param-row" id="tagInnyRow" style="display:' + (wlasnyTagAktywny ? '' : 'none') + ';">' +
          '<input type="text" id="metaTagInny" placeholder="własny tag" style="width:160px;">' +
        '</div>' +
        '<label class="cb-label" id="manualCbWrap"><input type="checkbox" id="manualCb"> trening bez splitów</label>' +
        '<div class="input-row" id="manualRow" style="display:none;margin-top:6px;">' +
          '<input type="text" id="manualDystans" placeholder="dystans np. 2000" maxlength="5"> m' +
          '<input type="text" id="manualCzas" placeholder="czas np. 3237 (opcjonalnie)" maxlength="4">' +
          '<button class="small" id="manualZapisz">Zapisz</button>' +
        '</div>' +
        '<div class="err-msg" id="manualMsg"></div>' +
      '</div>' +
    '</div>';
  }

  function sesjaSummaryTekst() {
    return sesja.data + ' · ' + sesja.basen + ' m';
  }

  function wireSesjaCard(kontener) {
    const head = kontener.querySelector('#sesjaHead');
    head.addEventListener('click', function () {
      sesjaRozwinieta = !sesjaRozwinieta;
      const body = kontener.querySelector('#sesjaBody');
      const chevron = kontener.querySelector('#sesjaChevron');
      body.style.display = sesjaRozwinieta ? '' : 'none';
      chevron.classList.toggle('open', sesjaRozwinieta);
    });

    const dataInp = kontener.querySelector('#metaData');
    dataInp.value = sesja.data;
    dataInp.addEventListener('change', function () {
      sesja.data = dataInp.value;
      odswiezDynamiczne(kontener);
    });

    const basenGroup = kontener.querySelector('#basenGroup');
    ustawAktywny(basenGroup, sesja.basen === 25 ? '25' : '50');
    basenGroup.querySelectorAll('.toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        sesja.basen = Number(btn.dataset.basen);
        ustawAktywny(basenGroup, btn.dataset.basen);
        odswiezDynamiczne(kontener);
      });
    });

    const tagGroup = kontener.querySelector('#tagGroup');
    const tagInnyRow = kontener.querySelector('#tagInnyRow');
    const tagInny = kontener.querySelector('#metaTagInny');
    tagInny.value = wlasnyTagAktywny ? sesja.tag : '';
    ustawAktywny(tagGroup, wlasnyTagAktywny ? '__inny__' : sesja.tag);
    tagGroup.querySelectorAll('.toggle-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        ustawAktywny(tagGroup, btn.dataset.tag);
        if (btn.dataset.tag === '__inny__') {
          wlasnyTagAktywny = true;
          tagInnyRow.style.display = '';
          sesja.tag = tagInny.value;
          tagInny.focus();
        } else {
          wlasnyTagAktywny = false;
          tagInnyRow.style.display = 'none';
          sesja.tag = btn.dataset.tag;
        }
      });
    });
    tagInny.addEventListener('input', function () { sesja.tag = tagInny.value; });

    const manualCb = kontener.querySelector('#manualCb');
    const manualRow = kontener.querySelector('#manualRow');
    manualCb.addEventListener('change', function () {
      manualRow.style.display = manualCb.checked ? '' : 'none';
      if (manualCb.checked) kontener.querySelector('#manualDystans').focus();
    });

    kontener.querySelector('#manualZapisz').addEventListener('click', function () { zapiszTreningReczny(kontener); });
  }

  function ustawAktywny(grupa, wartosc) {
    grupa.querySelectorAll('.toggle-btn').forEach(function (btn) {
      const klucz = btn.dataset.basen || btn.dataset.tag;
      btn.classList.toggle('active', klucz === wartosc);
    });
  }

  // ===== hero stat block (§5.2) =====

  function heroHtml() {
    return '<div class="card">' +
      '<div class="hero-status" id="heroStatus"></div>' +
      '<div class="hero-main">' +
        '<span class="hero-num" id="heroNum">0</span><span class="hero-unit">m</span>' +
        '<span class="hero-elapsed" id="heroElapsed"></span>' +
      '</div>' +
      '<div class="hero-bar" id="heroBar"></div>' +
      '<div class="hero-scale" id="heroScale"></div>' +
    '</div>';
  }

  // Czas zbiorczy wpisany dla danego progu (milestone albo koniec treningu dokładnie na tym dystansie).
  function tickCzas(dist) {
    if (sesja.koniec && sesja.koniec.sec != null && swimDist() === dist) return sesja.koniec.sec;
    const zb = sesja.zbiorcze && sesja.zbiorcze[String(dist)];
    return zb ? zb.swimSec : null;
  }

  function statusTekst() {
    if (zapisany) return 'sesja zapisana';
    if (zakonczony) return 'trening zakończony';
    if (milestoneOtwarty) return 'milestone ' + milestoneOtwarty + ' m';
    return 'w wodzie';
  }

  function odswiezHero(kontener) {
    const statusEl = kontener.querySelector('#heroStatus');
    const numEl = kontener.querySelector('#heroNum');
    const elapsedEl = kontener.querySelector('#heroElapsed');
    const barEl = kontener.querySelector('#heroBar');
    if (!statusEl) return;

    const dist = swimDist();
    statusEl.textContent = statusTekst();
    numEl.textContent = String(dist);
    const elapsed = zakonczony ? sesja.koniec.sec : Model.czasRazem(sesja);
    elapsedEl.textContent = elapsed ? Model.fmtCzas(elapsed) : '';

    const segmenty = CEL_DOMYSLNY / 100;
    const wypelnione = Math.min(Math.floor(dist / 100), segmenty);
    let bar = '';
    for (let i = 0; i < segmenty; i++) {
      let klasa = '';
      if (i < wypelnione - 1) klasa = ' filled';
      else if (i === wypelnione - 1) klasa = ' current';
      else if (wypelnione >= segmenty) klasa = ' filled';
      bar += '<span class="hero-seg' + klasa + '"></span>';
    }
    barEl.innerHTML = bar;

    const scaleEl = kontener.querySelector('#heroScale');
    if (scaleEl) {
      const progi = [0, CEL_DOMYSLNY / 4, CEL_DOMYSLNY / 2, CEL_DOMYSLNY * 3 / 4, CEL_DOMYSLNY];
      scaleEl.innerHTML = progi.map(function (d, i) {
        const sek = tickCzas(d);
        const etykieta = i === progi.length - 1 ? d + 'm' : String(d);
        return '<span class="hero-tick">' +
          '<span class="hero-scale-time">' + (sek != null ? Model.fmtCzas(sek) : '') + '</span>' +
          '<span>' + etykieta + '</span>' +
        '</span>';
      }).join('');
    }
  }

  // ===== render statyczny / dynamiczny =====

  function wireStatyczne(kontener) {
    wireSesjaCard(kontener);

    const mainInput = kontener.querySelector('#mainInput');
    const przerwaBtn = kontener.querySelector('#przerwaBtn');
    const preview = kontener.querySelector('#preview');

    mainInput.addEventListener('input', function () {
      const str = mainInput.value.replace(/[^0-9]/g, '');
      const sec = Model.parsujCzas(str);
      if (str.length >= 2 && sec === null) {
        preview.textContent = '';
        setErr(kontener, 'Nieprawidłowy czas – sekundy nie mogą być ≥ 60');
      } else if (sec !== null) {
        preview.textContent = '= ' + Model.fmtCzas(sec);
        setErr(kontener, '');
        przerwaAktywna = sec < Model.PROG_PRZERWY;
        przerwaBtn.classList.toggle('active', przerwaAktywna);
      } else {
        preview.textContent = '';
        setErr(kontener, '');
      }
    });

    mainInput.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') { e.preventDefault(); addEntry(kontener); }
    });

    przerwaBtn.addEventListener('click', function () {
      przerwaAktywna = !przerwaAktywna;
      przerwaBtn.classList.toggle('active', przerwaAktywna);
    });

    kontener.querySelector('#secondaryBtn').addEventListener('click', function () {
      if (zakonczony) nowyTrening(); else pokazEndPrompt(kontener);
    });
  }

  function footerHtml() {
    return '<footer class="tracker-panel">' +
      '<div class="tracker-panel-inner">' +
        '<div id="panelUndoArea"></div>' +
        '<div class="panel-target" id="panelTarget"></div>' +
        '<div class="panel-row">' +
          '<input type="text" id="mainInput" placeholder="155" maxlength="4">' +
          '<button type="button" class="toggle-btn' + (przerwaAktywna ? ' active' : '') + '" id="przerwaBtn">przerwa</button>' +
        '</div>' +
        '<div class="panel-preview"><span class="preview" id="preview"></span><span class="panel-err err-msg" id="errMsg"></span></div>' +
        '<div class="panel-buttons">' +
          '<button class="btn-secondary" id="secondaryBtn">Koniec</button>' +
          '<button class="primary btn-primary" id="dodajBtn">Dodaj 100 m</button>' +
        '</div>' +
        '<div class="err-msg" id="zapisMsg"></div>' +
      '</div>' +
    '</footer>';
  }

  function zapiszTreningReczny(kontener) {
    const inp = kontener.querySelector('#manualDystans');
    const czasInp = kontener.querySelector('#manualCzas');
    const dystansM = parseInt(inp.value, 10);
    inp.classList.remove('err');
    czasInp.classList.remove('err');
    if (!dystansM || dystansM <= 0) {
      inp.classList.add('err');
      kontener.querySelector('#manualMsg').textContent = 'Podaj dystans w metrach (liczba > 0).';
      return;
    }
    let czasSec = null;
    if (czasInp.value.trim()) {
      czasSec = Model.parsujCzas(czasInp.value);
      if (czasSec === null) {
        czasInp.classList.add('err');
        kontener.querySelector('#manualMsg').textContent = 'Nieprawidłowy czas – sekundy nie mogą być ≥ 60.';
        return;
      }
    }
    kontener.querySelector('#manualMsg').textContent = '';
    const iso = new Date().toISOString();
    const nowaSesja = {
      id: iso.slice(0, 19).replace(/:/g, '-') + '-' + Math.random().toString(36).slice(2, 6),
      data: sesja.data,
      basen: sesja.basen,
      tag: sesja.tag,
      splity: [],
      zbiorcze: {},
      koniec: { sec: null },
      recznyDystans: dystansM,
      recznyCzas: czasSec,
      utworzono: iso,
      zmodyfikowano: iso
    };
    const dok = Dane.wczytaj();
    dok.sesje.push(nowaSesja);
    dok.ustawienia.ostatniBasen = sesja.basen;
    Dane.zapisz(dok);

    sesja = sesjaPusta();
    zakonczony = false;
    zapisany = false;
    milestoneOtwarty = null;
    przerwaAktywna = false;
    render();
    pokazZapisMsg(kontener, 'Zapisano trening ręczny (' + dystansM + 'm' + (czasSec != null ? ', ' + Model.fmtCzas(czasSec) : '') + ').');
  }

  function setErr(kontener, msg) {
    const el = kontener.querySelector('#errMsg');
    if (!el) return;
    el.textContent = msg;
    if (msg) setTimeout(function () { if (el.textContent === msg) el.textContent = ''; }, 3000);
  }

  function addEntry(kontener) {
    if (zakonczony) return;
    const inp = kontener.querySelector('#mainInput');
    const sec = Model.parsujCzas(inp.value);
    if (sec === null) {
      setErr(kontener, 'Nieprawidłowy czas – sprawdź czy sekundy są < 60');
      inp.classList.add('err');
      setTimeout(function () { inp.classList.remove('err'); }, 1500);
      return;
    }
    if (przerwaAktywna) {
      if (!sesja.splity.length) { setErr(kontener, 'Nie można dodać przerwy przed pierwszym basenem.'); return; }
      const ostatni = sesja.splity[sesja.splity.length - 1];
      if (ostatni.przerwa != null) { setErr(kontener, 'Ten basen ma już przerwę. Odznacz „przerwa" jeśli to kolejny basen.'); return; }
      ostatni.przerwa = sec;
    } else {
      sesja.splity.push({ sec: sec, przerwa: null });
      const nowyDystans = swimDist();
      if (Model.MILESTONES.indexOf(nowyDystans) !== -1 && !sesja.zbiorcze[String(nowyDystans)]) {
        pokazMilestone(kontener, nowyDystans);
      }
    }
    setErr(kontener, '');
    inp.value = '';
    przerwaAktywna = false;
    kontener.querySelector('#przerwaBtn').classList.remove('active');
    kontener.querySelector('#preview').textContent = '';
    odswiezDynamiczne(kontener);
  }

  function pokazMilestone(kontener, dist) {
    milestoneOtwarty = dist;
    const area = kontener.querySelector('#milestoneArea');
    area.innerHTML =
      '<div class="banner">' +
        '<div class="banner-title">Osiągnięto ' + dist + 'm</div>' +
        '<div class="banner-desc">Wpisz czasy zbiorcze</div>' +
        '<div class="inputs">' +
          '<label>Czas na ' + dist + 'm:</label>' +
          '<input type="text" id="msSwim" placeholder="1148" maxlength="4">' +
          '<label>+ przerwa (opcjonalnie):</label>' +
          '<input type="text" id="msRest" placeholder="105" maxlength="4">' +
          '<button class="small" id="msZapisz">Zapisz</button>' +
          '<button class="small" id="msPomin">Pomiń</button>' +
        '</div>' +
        '<div class="err-msg" id="msBlad"></div>' +
      '</div>';
    const swimInp = area.querySelector('#msSwim');
    const restInp = area.querySelector('#msRest');
    const blad = area.querySelector('#msBlad');
    swimInp.focus();

    function zamknij() {
      milestoneOtwarty = null;
      area.innerHTML = '';
      odswiezDynamiczne(kontener);
    }

    function zapisz() {
      const swimSec = Model.parsujCzas(swimInp.value);
      const restVal = restInp.value;
      const restSec = restVal ? Model.parsujCzas(restVal) : null;
      if (swimSec === null) { swimInp.classList.add('err'); return; }
      if (restVal && restSec === null) { restInp.classList.add('err'); blad.textContent = 'Nieprawidłowy czas — sekundy nie mogą być ≥ 60.'; return; }
      if (restVal && restSec <= swimSec) {
        restInp.classList.add('err');
        blad.textContent = 'Czas z przerwą musi być większy niż czas zbiorczy pływania.';
        return;
      }
      restInp.classList.remove('err');
      blad.textContent = '';
      sesja.zbiorcze[String(dist)] = { swimSec: swimSec, restSec: restSec, doWeryfikacji: false };
      zamknij();
      kontener.querySelector('#mainInput').focus();
    }

    area.querySelector('#msZapisz').addEventListener('click', zapisz);
    area.querySelector('#msPomin').addEventListener('click', function () {
      zamknij();
      kontener.querySelector('#mainInput').focus();
    });
    [swimInp, restInp].forEach(function (el) {
      el.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); zapisz(); } });
    });
  }

  function pokazEndPrompt(kontener) {
    if (zakonczony) return;
    const sd = swimDist();
    const area = kontener.querySelector('#endArea');
    area.innerHTML =
      '<div class="banner">' +
        '<div class="banner-title">Koniec treningu (' + sd + 'm)</div>' +
        '<div class="banner-desc">Wpisz łączny czas</div>' +
        '<div class="inputs">' +
          '<input type="text" id="endTime" placeholder="3237" maxlength="4">' +
          '<button class="small" id="endZapisz">Zapisz</button>' +
          '<button class="small" id="endAnuluj">Anuluj</button>' +
        '</div>' +
      '</div>';
    const inp = area.querySelector('#endTime');
    inp.focus();

    function zapisz() {
      const sec = Model.parsujCzas(inp.value);
      if (sec === null) { inp.classList.add('err'); return; }
      sesja.koniec = { sec: sec };
      zakonczony = true;
      area.innerHTML = '';
      odswiezDynamiczne(kontener);
      showExport(kontener);
    }

    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); zapisz(); } });
    area.querySelector('#endZapisz').addEventListener('click', zapisz);
    area.querySelector('#endAnuluj').addEventListener('click', function () { area.innerHTML = ''; });
  }

  function cofnijZakonczenie(kontener) {
    zakonczony = false;
    sesja.koniec = { sec: null };
    const exportArea = kontener.querySelector('#exportArea');
    if (exportArea) exportArea.innerHTML = '';
    odswiezDynamiczne(kontener);
    kontener.querySelector('#mainInput').focus();
  }

  function zapiszSesje(kontener) {
    if (!sesja.splity.length) { pokazZapisMsg(kontener, 'Brak splitów — nie ma czego zapisać.'); return; }
    if (sesja.koniec.sec == null) { pokazZapisMsg(kontener, 'Brak czasu końcowego — zakończ trening przed zapisem.'); return; }
    if (!Model.czyPoprawnaSesja(sesja)) { pokazZapisMsg(kontener, 'Dane sesji są niepoprawne — sprawdź czasy.'); return; }

    const iso = new Date().toISOString();
    sesja.id = iso.slice(0, 19).replace(/:/g, '-') + '-' + Math.random().toString(36).slice(2, 6);
    sesja.utworzono = iso;
    sesja.zmodyfikowano = iso;

    const dok = Dane.wczytaj();
    dok.sesje.push(sesja);
    dok.ustawienia.ostatniBasen = sesja.basen;
    Dane.zapisz(dok);

    zapisany = true;
    pokazZapisMsg(kontener, 'Zapisano.');
    odswiezDynamiczne(kontener);
  }

  function pokazZapisMsg(kontener, msg) {
    const el = kontener.querySelector('#zapisMsg');
    if (el) el.textContent = msg;
  }

  function updateExportValue(kontener) {
    const ta = kontener.querySelector('#csvText');
    if (ta) ta.value = Model.buildExportExcel(sesja);
  }

  function showExport(kontener) {
    if (!sesja.splity.length) return;
    const area = kontener.querySelector('#exportArea');
    area.innerHTML =
      '<div class="export-area">' +
        '<div class="lbl">Kliknij w Excelu w pustą komórkę A1 nowego bloku i wklej (Ctrl+V) — cała struktura (Data:, data, tag, basen, nagłówki, splity) wjedzie od razu:</div>' +
        '<textarea id="csvText" spellcheck="false">' + Model.buildExportExcel(sesja) + '</textarea>' +
        '<div class="copy-btn-row">' +
          '<button class="small" id="copySchowek">Kopiuj do schowka</button>' +
          '<span class="copied" id="copiedMsg"></span>' +
        '</div>' +
      '</div>';
    const ta = area.querySelector('#csvText');
    ta.addEventListener('click', function () { ta.select(); });
    ta.select();
    area.querySelector('#copySchowek').addEventListener('click', function () {
      ta.select();
      document.execCommand('copy');
      const msg = area.querySelector('#copiedMsg');
      msg.textContent = 'Skopiowano!';
      setTimeout(function () { msg.textContent = ''; }, 2000);
    });
  }

  function nowyTrening() {
    if (sesja.splity.length && !confirm('Zresetować dane treningu? Niezapisane dane zostaną utracone.')) return;
    sesja = sesjaPusta();
    zakonczony = false;
    zapisany = false;
    milestoneOtwarty = null;
    przerwaAktywna = false;
    render();
  }

  function panelTargetTekst() {
    if (zakonczony) return zapisany ? '' : 'łączny czas treningu wpisany — zapisz sesję';
    return 'następne ' + (swimDist() + 100) + ' m';
  }

  function odswiezDynamiczne(kontener) {
    odswiezHero(kontener);

    const sesjaSummary = kontener.querySelector('#sesjaSummary');
    if (sesjaSummary) sesjaSummary.textContent = sesjaSummaryTekst();

    const manualCbWrap = kontener.querySelector('#manualCbWrap');
    const manualRow = kontener.querySelector('#manualRow');
    const ukryjManualny = sesja.splity.length > 0 || zakonczony;
    if (manualCbWrap) manualCbWrap.style.display = ukryjManualny ? 'none' : '';
    if (ukryjManualny && manualRow) manualRow.style.display = 'none';

    const mainInput = kontener.querySelector('#mainInput');
    if (mainInput) mainInput.disabled = zakonczony;
    const przerwaBtn = kontener.querySelector('#przerwaBtn');
    if (przerwaBtn) przerwaBtn.disabled = zakonczony;

    const target = kontener.querySelector('#panelTarget');
    if (target) target.textContent = panelTargetTekst();

    const undoArea = kontener.querySelector('#panelUndoArea');
    if (undoArea) {
      undoArea.innerHTML = (zakonczony && !zapisany)
        ? '<button class="link-btn panel-undo" id="cofnijBtn">Cofnij zakończenie</button>'
        : '';
      const cofnijBtn = undoArea.querySelector('#cofnijBtn');
      if (cofnijBtn) cofnijBtn.addEventListener('click', function () { cofnijZakonczenie(kontener); });
    }

    const secondaryBtn = kontener.querySelector('#secondaryBtn');
    const dodajBtn = kontener.querySelector('#dodajBtn');
    if (secondaryBtn) secondaryBtn.textContent = zakonczony ? 'Nowy' : 'Koniec';
    if (dodajBtn) {
      if (zakonczony) {
        dodajBtn.textContent = zapisany ? 'Zapisano ✓' : 'Zapisz…';
        dodajBtn.disabled = zapisany;
        dodajBtn.onclick = function () { zapiszSesje(kontener); };
      } else {
        dodajBtn.textContent = 'Dodaj 100 m';
        dodajBtn.disabled = false;
        dodajBtn.onclick = function () { addEntry(kontener); };
      }
    }

    const tabelaKontener = kontener.querySelector('#summaryArea');
    if (tabelaKontener) {
      if (sesja.splity.length) {
        SesjaTabela.render(tabelaKontener, sesja, {
          edytowalna: !zapisany,
          onZmiana: function (nowaSesja) { sesja = nowaSesja; odswiezDynamiczne(kontener); }
        });
      } else {
        tabelaKontener.innerHTML = '';
      }
    }

    updateExportValue(kontener);
  }

  window.addEventListener('beforeunload', function (e) {
    if (sesja.splity.length && !zapisany) {
      e.preventDefault();
      e.returnValue = '';
    }
  });

  App.zarejestrujWidok({
    id: 'tracker',
    etykieta: 'Tracker',
    aktywny: true,
    montuj: montuj,
    odmontuj: odmontuj
  });

  return {};
})();
