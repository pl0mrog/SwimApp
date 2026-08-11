window.Model = (function () {
  const PROG_PRZERWY = 105;
  const MILESTONES = [500, 1000, 1500, 2000];

  function klonuj(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // ===== parsowanie i format =====

  function parsujCzas(str) {
    if (str == null) return null;
    str = String(str).trim().replace(/[^0-9]/g, '');
    if (!str) return null;
    let m, s;
    if (str.length <= 2) { m = 0; s = parseInt(str, 10); }
    else if (str.length === 3) { m = parseInt(str[0], 10); s = parseInt(str.slice(1), 10); }
    else { m = parseInt(str.slice(0, -2), 10); s = parseInt(str.slice(-2), 10); }
    if (isNaN(m) || isNaN(s) || s > 59) return null;
    return m * 60 + s;
  }

  function fmtCzas(sec) {
    if (sec == null || isNaN(sec)) return '';
    const m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function fmtExcel(sec) {
    if (sec == null || isNaN(sec)) return '';
    const m = Math.floor(sec / 60), s = sec % 60;
    return '00:' + (m < 10 ? '0' : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }

  function secNaCyfry(sec) {
    if (sec == null || isNaN(sec)) return '';
    const m = Math.floor(sec / 60), s = sec % 60;
    return String(m) + (s < 10 ? '0' : '') + String(s);
  }

  // ===== obliczenia na sesji =====

  function dystansSplitu(i) {
    return (i + 1) * 100;
  }

  function dystans(sesja) {
    if (sesja.recznyDystans != null) return sesja.recznyDystans;
    return (sesja.splity ? sesja.splity.length : 0) * 100;
  }

  function czasPlywania(sesja) {
    return (sesja.splity || []).reduce(function (a, sp) { return a + (sp.sec || 0); }, 0);
  }

  function czasPrzerw(sesja) {
    return (sesja.splity || []).reduce(function (a, sp) { return a + (sp.przerwa || 0); }, 0);
  }

  function czasRazem(sesja) {
    return czasPlywania(sesja) + czasPrzerw(sesja);
  }

  function tempo100(sesja) {
    const d = dystans(sesja);
    if (!d) return null;
    return Math.round(czasPlywania(sesja) / (d / 100));
  }

  // ===== mutacje sesji (zwracają nową sesję) =====

  function oznaczZbiorczeDoWeryfikacji(sesja, odIndeksu) {
    const nowa = klonuj(sesja);
    const odDystansu = dystansSplitu(odIndeksu);
    Object.keys(nowa.zbiorcze || {}).forEach(function (klucz) {
      if (Number(klucz) >= odDystansu) {
        nowa.zbiorcze[klucz].doWeryfikacji = true;
      }
    });
    return nowa;
  }

  function usunSplit(sesja, i) {
    const nowa = klonuj(sesja);
    nowa.splity.splice(i, 1);
    return oznaczZbiorczeDoWeryfikacji(nowa, i);
  }

  function wstawSplit(sesja, i) {
    const nowa = klonuj(sesja);
    nowa.splity.splice(i, 0, { sec: null, przerwa: null });
    return oznaczZbiorczeDoWeryfikacji(nowa, i);
  }

  function ustawPole(sesja, sciezka, sec) {
    const nowa = klonuj(sesja);
    const czesci = sciezka.split('.');
    let cel = nowa;
    for (let k = 0; k < czesci.length - 1; k++) {
      cel = cel[czesci[k]];
    }
    cel[czesci[czesci.length - 1]] = sec;
    return nowa;
  }

  // ===== eksport do Excela =====

  function buildExportExcel(sesja) {
    let out = 'Data:\t' + sesja.data + '\t' + (sesja.tag && sesja.tag !== 'brak' ? sesja.tag : '') + '\t' +
      (sesja.basen ? 'Basen ' + sesja.basen + 'm' : '') + '\n';
    out += '\tCzasy 100m\tCzas przerwy\tDystans\t\tCzas zbiorczy\n';
    for (let i = 0; i < sesja.splity.length; i++) {
      const sp = sesja.splity[i];
      const dist = dystansSplitu(i);
      const zb = (sesja.zbiorcze || {})[String(dist)];
      const czyOstatni = i === sesja.splity.length - 1;
      const maKoniec = czyOstatni && sesja.koniec && sesja.koniec.sec != null;
      const zbiorczy = maKoniec ? sesja.koniec.sec : (zb ? zb.swimSec : null);
      const zbiorczyRest = maKoniec ? null : (zb ? zb.restSec : null);
      out += '\t';
      out += fmtExcel(sp.sec) + '\t';
      out += (sp.przerwa != null ? fmtExcel(sp.przerwa) : '') + '\t';
      out += dist + 'm' + '\t';
      out += '\t';
      out += (zbiorczy != null ? fmtExcel(zbiorczy) : '') + '\t';
      out += (zbiorczyRest != null ? fmtExcel(zbiorczyRest) : '') + '\n';
    }
    return out;
  }

  // ===== walidacja =====

  function czyPoprawnaSesja(sesja) {
    if (!sesja || typeof sesja !== 'object') return false;
    if (sesja.recznyDystans != null) {
      return typeof sesja.recznyDystans === 'number' && !isNaN(sesja.recznyDystans) && sesja.recznyDystans > 0;
    }
    if (!Array.isArray(sesja.splity) || !sesja.splity.length) return false;
    for (let i = 0; i < sesja.splity.length; i++) {
      const sp = sesja.splity[i];
      if (sp.sec != null && (typeof sp.sec !== 'number' || isNaN(sp.sec) || sp.sec < 0)) return false;
      if (sp.przerwa != null && (typeof sp.przerwa !== 'number' || isNaN(sp.przerwa))) return false;
    }
    if (!sesja.koniec || typeof sesja.koniec.sec !== 'number' || isNaN(sesja.koniec.sec)) return false;
    return true;
  }

  // Sesja "pełna" ma zmierzone wszystkie czasy 100m — tylko takie powinny
  // wchodzić do statystyk tempa; sesje ręczne (tylko dystans) i sesje
  // z brakującymi splitami liczą się wyłącznie do sumy dystansu.
  function czyPelnaSesja(sesja) {
    if (!sesja || sesja.recznyDystans != null) return false;
    if (!Array.isArray(sesja.splity) || !sesja.splity.length) return false;
    return sesja.splity.every(function (sp) { return sp.sec != null; });
  }

  return {
    PROG_PRZERWY: PROG_PRZERWY,
    MILESTONES: MILESTONES,
    parsujCzas: parsujCzas,
    fmtCzas: fmtCzas,
    fmtExcel: fmtExcel,
    secNaCyfry: secNaCyfry,
    dystans: dystans,
    dystansSplitu: dystansSplitu,
    czasPlywania: czasPlywania,
    czasPrzerw: czasPrzerw,
    czasRazem: czasRazem,
    tempo100: tempo100,
    usunSplit: usunSplit,
    wstawSplit: wstawSplit,
    ustawPole: ustawPole,
    oznaczZbiorczeDoWeryfikacji: oznaczZbiorczeDoWeryfikacji,
    czyPoprawnaSesja: czyPoprawnaSesja,
    czyPelnaSesja: czyPelnaSesja,
    buildExportExcel: buildExportExcel
  };
})();
