window.Tracker = (function () {
  const PRESETY_TAGOW = ['Trening A - długie odcinki', 'Trening B - krótkie interwały'];
  const CEL_DOMYSLNY = 2000;

  let sesja = sesjaPusta();
  let zakonczony = false;
  let kontenerGlobalny = null;
  // Zanim użytkownik kliknie "Dodaj nową sesję" Tracker pokazuje sam ekran startowy.
  let sesjaRozpoczeta = false;
  // Rozwinięta na starcie sesji (jest miejsce, można ustawić basen/tag), zwijana
  // automatycznie po pierwszym splicie — inaczej zjadałaby wysokość listy splitów.
  let sesjaRozwinieta = true;
  let heroZwiniety = false;
  let komunikatStartu = '';
  let endPromptOtwarty = false;
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

  function startCardHtml() {
    return '<div class="card start-card">' +
      '<div class="section-label">Nowa sesja</div>' +
      (komunikatStartu ? '<p class="start-komunikat">' + komunikatStartu + '</p>' : '') +
      '<p class="hint">Wpisujesz czasy kolejnych 100 m — dystans, sumy i tempo apka policzy sama.</p>' +
      '<div class="btn-row"><button class="primary" id="startBtn">Dodaj nową sesję</button></div>' +
    '</div>';
  }

  function renderStart(kontener) {
    kontener.innerHTML = '<div class="view-scroll">' + startCardHtml() + '</div>';
    komunikatStartu = '';   // pokazujemy raz, po powrocie z zapisanego treningu
    kontener.querySelector('#startBtn').addEventListener('click', function () {
      sesja = sesjaPusta();
      zakonczony = false;
      milestoneOtwarty = null;
      przerwaAktywna = false;
      sesjaRozwinieta = true;
      heroZwiniety = false;
      sesjaRozpoczeta = true;
      render();
    });
  }

  // Przypinanie kart ma sens tylko przy szybkim dopisywaniu splitów. Przed
  // pierwszym splitem, przy otwartym dialogu (milestone/koniec) i po zakończeniu
  // treningu na ekranie jest więcej treści niż miejsca — wtedy zwykłe przewijanie.
  function czyLuznyUklad() {
    return zakonczony || !sesja.splity.length || milestoneOtwarty !== null || endPromptOtwarty;
  }

  function odswiezUklad(kontener) {
    const layout = kontener.querySelector('.tracker-layout');
    if (layout) layout.classList.toggle('luzny', czyLuznyUklad());
    // Przy otwartym dialogu (milestone / koniec) wpisuje się czas w banerze —
    // dolny pasek ze splitami tylko zabierałby wtedy miejsce i mylił.
    const panel = kontener.querySelector('.tracker-panel');
    if (panel) panel.classList.toggle('ukryty', milestoneOtwarty !== null || endPromptOtwarty);
  }

  function render() {
    const kontener = kontenerGlobalny;
    if (!sesjaRozpoczeta) { renderStart(kontener); return; }
    // Układ: karty Sesja/banery i "w wodzie" stoją w miejscu, przewija się
    // wyłącznie lista splitów w środku (#summaryArea → .tbl-wrap).
    kontener.innerHTML =
      '<div class="tracker-layout' + (czyLuznyUklad() ? ' luzny' : '') + '">' +
        '<div class="tracker-fixed">' +
          sesjaCardHtml() +
          '<div id="milestoneArea"></div>' +
          '<div id="endArea"></div>' +
        '</div>' +
        '<div class="tracker-splity">' +
          '<div id="summaryArea"></div>' +
          '<div id="exportArea"></div>' +
        '</div>' +
        '<div class="tracker-fixed">' +
          heroHtml() +
        '</div>' +
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
    return '<div class="card sesja-card">' +
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
          '<button class="small primary" id="manualZapisz">Zapisz</button>' +
        '</div>' +
        '<div class="keypad-dock" id="manualKeypadDock"></div>' +
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

    const manualDystans = kontener.querySelector('#manualDystans');
    const manualCzas = kontener.querySelector('#manualCzas');
    const manualDock = kontener.querySelector('#manualKeypadDock');
    Keypad.mountOnFocus(manualDystans, manualDock);
    Keypad.mountOnFocus(manualCzas, manualDock);

    const manualCb = kontener.querySelector('#manualCb');
    const manualRow = kontener.querySelector('#manualRow');
    manualCb.addEventListener('change', function () {
      manualRow.style.display = manualCb.checked ? '' : 'none';
      if (manualCb.checked) {
        manualDystans.focus();
      } else {
        // odznaczenie czyści wpisane wartości i chowa klawiaturę — inaczej
        // zostawałaby otwarta pod schowanym formularzem
        manualDystans.value = '';
        manualCzas.value = '';
        manualDystans.classList.remove('err');
        manualCzas.classList.remove('err');
        manualDock.innerHTML = '';
        kontener.querySelector('#manualMsg').textContent = '';
      }
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
    return '<div class="card hero-card">' +
      '<span class="chevron hero-chevron' + (heroZwiniety ? '' : ' open') + '" id="heroChevron">▾</span>' +
      '<div class="hero-status" id="heroStatus"></div>' +
      '<div class="hero-main" id="heroMain"' + (heroZwiniety ? ' style="display:none;"' : '') + '>' +
        '<span class="hero-num" id="heroNum">0</span><span class="hero-unit">m</span>' +
        '<span class="hero-elapsed" id="heroElapsed"></span>' +
      '</div>' +
      '<div class="hero-times" id="heroTimes"></div>' +
      '<div class="hero-bar" id="heroBar"></div>' +
      '<div class="hero-scale" id="heroScale"></div>' +
    '</div>';
  }

  function wireHero(kontener) {
    const chevron = kontener.querySelector('#heroChevron');
    if (!chevron) return;
    chevron.addEventListener('click', function () {
      heroZwiniety = !heroZwiniety;
      const main = kontener.querySelector('#heroMain');
      const status = kontener.querySelector('#heroStatus');
      if (main) main.style.display = heroZwiniety ? 'none' : '';
      if (status) status.style.display = heroZwiniety ? 'none' : '';
      chevron.classList.toggle('open', !heroZwiniety);
    });
  }

  // Czas zbiorczy wpisany dla danego progu (milestone albo koniec treningu dokładnie na tym dystansie).
  function tickCzas(dist) {
    if (sesja.koniec && sesja.koniec.sec != null && swimDist() === dist) return sesja.koniec.sec;
    const zb = sesja.zbiorcze && sesja.zbiorcze[String(dist)];
    return zb ? zb.swimSec : null;
  }

  function statusTekst() {
    if (zakonczony) return 'trening zakończony';
    if (milestoneOtwarty) return 'milestone ' + milestoneOtwarty + ' m';
    return '';
  }

  function odswiezHero(kontener) {
    const statusEl = kontener.querySelector('#heroStatus');
    const numEl = kontener.querySelector('#heroNum');
    const elapsedEl = kontener.querySelector('#heroElapsed');
    const barEl = kontener.querySelector('#heroBar');
    if (!statusEl) return;

    const dist = swimDist();
    const status = statusTekst();
    statusEl.textContent = status;
    statusEl.classList.toggle('empty', !status);
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

    // Czas zbiorczy siada dokładnie nad pastylką kończącą dany dystans:
    // pastylka o indeksie (d/100 - 1) zajmuje pas [i/n, (i+1)/n] szerokości paska.
    const scaleEl = kontener.querySelector('#heroScale');
    const timesEl = kontener.querySelector('#heroTimes');
    const progi = [0, CEL_DOMYSLNY / 4, CEL_DOMYSLNY / 2, CEL_DOMYSLNY * 3 / 4, CEL_DOMYSLNY];
    if (timesEl) {
      timesEl.innerHTML = progi.map(function (d) {
        const sek = d > 0 ? tickCzas(d) : null;
        if (sek == null) return '';
        const srodek = ((d / 100 - 1) + 0.5) / segmenty * 100;
        return '<span class="hero-time" style="left:' + srodek.toFixed(3) + '%;">' +
          Model.fmtCzas(sek) + '</span>';
      }).join('');
    }
    if (scaleEl) {
      scaleEl.innerHTML = progi.map(function (d, i) {
        const etykieta = i === progi.length - 1 ? d + 'm' : String(d);
        return '<span class="hero-tick">' + etykieta + '</span>';
      }).join('');
    }
  }

  // ===== render statyczny / dynamiczny =====

  function wireStatyczne(kontener) {
    wireSesjaCard(kontener);
    wireHero(kontener);

    const mainInput = kontener.querySelector('#mainInput');
    const przerwaBtn = kontener.querySelector('#przerwaBtn');
    const preview = kontener.querySelector('#preview');

    Keypad.mountInline(kontener.querySelector('#mainKeypadDock'), mainInput);

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
        '<div class="keypad-dock" id="mainKeypadDock"></div>' +
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
      if (czasSec === null || czasSec === 0) {
        czasInp.classList.add('err');
        kontener.querySelector('#manualMsg').textContent = czasSec === 0
          ? 'Czas nie może być zerowy.'
          : 'Nieprawidłowy czas – sekundy nie mogą być ≥ 60.';
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

    komunikatStartu = 'Zapisano trening ręczny (' + dystansM + 'm' +
      (czasSec != null ? ', ' + Model.fmtCzas(czasSec) : '') + ').';
    resetTrening();
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
    if (sec === null || sec === 0) {
      setErr(kontener, sec === 0
        ? 'Czas nie może być zerowy.'
        : 'Nieprawidłowy czas – sprawdź czy sekundy są < 60');
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
      // pierwszy split = koniec ustawiania parametrów; zwijamy kartę Sesja,
      // żeby zwolnić miejsce na listę splitów
      if (sesja.splity.length === 1 && sesjaRozwinieta) {
        sesjaRozwinieta = false;
        const body = kontener.querySelector('#sesjaBody');
        const chevron = kontener.querySelector('#sesjaChevron');
        if (body) body.style.display = 'none';
        if (chevron) chevron.classList.remove('open');
      }
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
          '<button class="small primary" id="msZapisz">Zapisz</button>' +
          '<button class="small" id="msPomin">Pomiń</button>' +
        '</div>' +
        '<div class="keypad-dock" id="msKeypadDock"></div>' +
        '<div class="err-msg" id="msBlad"></div>' +
      '</div>';
    odswiezUklad(kontener);
    const swimInp = area.querySelector('#msSwim');
    const restInp = area.querySelector('#msRest');
    const blad = area.querySelector('#msBlad');
    const msDock = area.querySelector('#msKeypadDock');
    Keypad.mountOnFocus(swimInp, msDock);
    Keypad.mountOnFocus(restInp, msDock);
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
      if (swimSec === null || swimSec === 0) {
        swimInp.classList.add('err');
        blad.textContent = swimSec === 0 ? 'Czas nie może być zerowy.' : 'Nieprawidłowy czas — sekundy nie mogą być ≥ 60.';
        return;
      }
      swimInp.classList.remove('err');
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
    endPromptOtwarty = true;
    const sd = swimDist();
    const area = kontener.querySelector('#endArea');
    area.innerHTML =
      '<div class="banner">' +
        '<div class="banner-head">' +
          '<div>' +
            '<div class="banner-title">Koniec treningu (' + sd + 'm)</div>' +
            '<div class="banner-desc">Wpisz łączny czas</div>' +
          '</div>' +
          '<div class="banner-btn-row">' +
            '<button class="small primary" id="endZapisz">Zapisz</button>' +
            '<button class="small" id="endCofnij">Cofnij</button>' +
            '<button class="small danger" id="endAnulujTrening">Anuluj trening</button>' +
          '</div>' +
        '</div>' +
        '<div class="inputs">' +
          '<input type="text" id="endTime" placeholder="3237" maxlength="4">' +
        '</div>' +
        '<div class="keypad-dock" id="endKeypadDock"></div>' +
      '</div>';
    const inp = area.querySelector('#endTime');
    Keypad.mountOnFocus(inp, area.querySelector('#endKeypadDock'));
    odswiezUklad(kontener);
    inp.focus();

    function zapisz() {
      const sec = Model.parsujCzas(inp.value);
      if (sec === null || sec === 0) { inp.classList.add('err'); return; }
      inp.classList.remove('err');
      sesja.koniec = { sec: sec };
      zakonczony = true;
      endPromptOtwarty = false;
      area.innerHTML = '';
      odswiezDynamiczne(kontener);
      showExport(kontener);
    }

    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); zapisz(); } });
    area.querySelector('#endZapisz').addEventListener('click', zapisz);
    area.querySelector('#endCofnij').addEventListener('click', function () {
      endPromptOtwarty = false;
      area.innerHTML = '';
      odswiezDynamiczne(kontener);
    });
    area.querySelector('#endAnulujTrening').addEventListener('click', anulujTrening);
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

    // Po zapisie wracamy na ekran startowy — potwierdzenie leci w komunikacie tam.
    // Kopię do Excela robi się wcześniej: karta eksportu jest na ekranie od momentu
    // wpisania czasu końcowego.
    komunikatStartu = 'Zapisano sesję (' + swimDist() + 'm, ' + Model.fmtCzas(sesja.koniec.sec) + ').';
    resetTrening();
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

  function resetTrening() {
    sesja = sesjaPusta();
    zakonczony = false;
    milestoneOtwarty = null;
    przerwaAktywna = false;
    endPromptOtwarty = false;
    sesjaRozpoczeta = false;   // z powrotem na ekran startowy
    render();
  }

  function nowyTrening() {
    if (sesja.splity.length && !confirm('Zresetować dane treningu? Niezapisane dane zostaną utracone.')) return;
    resetTrening();
  }

  function anulujTrening() {
    if (!confirm('Anulować cały trening? Wszystkie wpisane splity zostaną utracone.')) return;
    resetTrening();
  }

  function panelTargetTekst() {
    if (zakonczony) return 'łączny czas treningu wpisany — zapisz sesję';
    return 'następne ' + (swimDist() + 100) + ' m';
  }

  function odswiezDynamiczne(kontener) {
    odswiezHero(kontener);

    odswiezUklad(kontener);

    const sesjaSummary = kontener.querySelector('#sesjaSummary');
    if (sesjaSummary) sesjaSummary.textContent = sesjaSummaryTekst();

    const manualCbWrap = kontener.querySelector('#manualCbWrap');
    const manualRow = kontener.querySelector('#manualRow');
    const ukryjManualny = sesja.splity.length > 0 || zakonczony;
    if (manualCbWrap) manualCbWrap.style.display = ukryjManualny ? 'none' : '';
    if (ukryjManualny && manualRow) {
      manualRow.style.display = 'none';
      const manualDock = kontener.querySelector('#manualKeypadDock');
      if (manualDock) manualDock.innerHTML = '';
    }

    const mainInput = kontener.querySelector('#mainInput');
    if (mainInput) mainInput.disabled = zakonczony;
    const przerwaBtn = kontener.querySelector('#przerwaBtn');
    if (przerwaBtn) przerwaBtn.disabled = zakonczony;

    const target = kontener.querySelector('#panelTarget');
    if (target) target.textContent = panelTargetTekst();

    const undoArea = kontener.querySelector('#panelUndoArea');
    if (undoArea) {
      undoArea.innerHTML = zakonczony
        ? '<button class="small panel-undo" id="cofnijBtn">Cofnij zakończenie</button>'
        : '';
      const cofnijBtn = undoArea.querySelector('#cofnijBtn');
      if (cofnijBtn) cofnijBtn.addEventListener('click', function () { cofnijZakonczenie(kontener); });
    }

    const secondaryBtn = kontener.querySelector('#secondaryBtn');
    const dodajBtn = kontener.querySelector('#dodajBtn');
    if (secondaryBtn) secondaryBtn.textContent = zakonczony ? 'Nowy' : 'Koniec';
    if (dodajBtn) {
      if (zakonczony) {
        dodajBtn.textContent = 'Zapisz…';
        dodajBtn.disabled = false;
        dodajBtn.onclick = function () { zapiszSesje(kontener); };
      } else {
        dodajBtn.textContent = 'Dodaj 100 m';
        dodajBtn.disabled = false;
        dodajBtn.onclick = function () { addEntry(kontener); };
      }
    }

    const tabelaKontener = kontener.querySelector('#summaryArea');
    if (tabelaKontener) {
      SesjaTabela.render(tabelaKontener, sesja, {
        edytowalna: true,
        pustyTekst: 'Dodaj czas pierwszego splitu — pojawi się tutaj.',
        onZmiana: function (nowaSesja) { sesja = nowaSesja; odswiezDynamiczne(kontener); }
      });
    }

    updateExportValue(kontener);
  }

  // Po zapisie sesja jest resetowana, więc sama obecność splitów oznacza dane niezapisane.
  window.addEventListener('beforeunload', function (e) {
    if (sesja.splity.length) {
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
