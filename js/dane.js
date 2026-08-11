window.Dane = (function () {
  const KLUCZ = 'swim.dane';
  const SCHEMA_VERSION = 1;

  function dokumentStartowy() {
    return {
      schemaVersion: SCHEMA_VERSION,
      ostatnia_modyfikacja: new Date().toISOString(),
      ustawienia: { ostatniBasen: 25 },
      plan: { aktywnyPlan: null, wykonane: {} },
      sesje: []
    };
  }

  // Dokumenty zapisane przed 0.5.0 nie maja pola `plan`. Dopelniamy je przy odczycie
  // zamiast podbijac schemaVersion — nie ma tu zadnej transformacji danych do zrobienia,
  // tylko nowe, opcjonalne pole.
  function dopelnij(dok) {
    if (!dok.plan || typeof dok.plan !== 'object') dok.plan = { aktywnyPlan: null, wykonane: {} };
    if (!dok.plan.wykonane || typeof dok.plan.wykonane !== 'object') dok.plan.wykonane = {};
    if (dok.plan.aktywnyPlan === undefined) dok.plan.aktywnyPlan = null;
    return dok;
  }

  function poprawny(dok) {
    return !!dok && typeof dok === 'object' &&
      typeof dok.schemaVersion === 'number' &&
      Array.isArray(dok.sesje) &&
      !!dok.ustawienia && typeof dok.ustawienia === 'object';
  }

  function wczytaj() {
    let surowy;
    try {
      surowy = localStorage.getItem(KLUCZ);
    } catch (e) {
      return dokumentStartowy();
    }
    if (!surowy) return dokumentStartowy();
    let dok;
    try {
      dok = JSON.parse(surowy);
    } catch (e) {
      return dokumentStartowy();
    }
    return poprawny(dok) ? dopelnij(dok) : dokumentStartowy();
  }

  function zapisz(dokument) {
    if (!poprawny(dokument)) {
      throw new Error('Niepoprawny dokument — zapis odrzucony.');
    }
    dokument.ostatnia_modyfikacja = new Date().toISOString();
    localStorage.setItem(KLUCZ, JSON.stringify(dokument));
  }

  function eksportJSON() {
    return JSON.stringify(wczytaj(), null, 2);
  }

  function importJSON(tekst) {
    let dok;
    try {
      dok = JSON.parse(tekst);
    } catch (e) {
      throw new Error('Plik nie jest poprawnym JSON-em.');
    }
    if (!poprawny(dok)) {
      throw new Error('Plik nie ma poprawnej struktury danych SwimApp.');
    }
    const aktualny = wczytaj();
    const istniejaceId = new Set(aktualny.sesje.map(function (s) { return s.id; }));
    const noweSesje = dok.sesje.filter(function (s) { return !istniejaceId.has(s.id); });
    aktualny.sesje = aktualny.sesje.concat(noweSesje);

    // Postep planu scalamy ta sama zasada co sesje: brakujace odhaczenia dochodza,
    // istniejace nie sa nadpisywane.
    let noweOdhaczenia = 0;
    const zrodlowe = (dok.plan && dok.plan.wykonane && typeof dok.plan.wykonane === 'object') ? dok.plan.wykonane : {};
    Object.keys(zrodlowe).forEach(function (idPlanu) {
      const zrodlo = zrodlowe[idPlanu];
      if (!zrodlo || typeof zrodlo !== 'object') return;
      if (!aktualny.plan.wykonane[idPlanu]) aktualny.plan.wykonane[idPlanu] = {};
      const cel = aktualny.plan.wykonane[idPlanu];
      Object.keys(zrodlo).forEach(function (klucz) {
        if (cel[klucz] === undefined) {
          cel[klucz] = zrodlo[klucz];
          noweOdhaczenia++;
        }
      });
    });
    if (!aktualny.plan.aktywnyPlan && dok.plan && dok.plan.aktywnyPlan) {
      aktualny.plan.aktywnyPlan = dok.plan.aktywnyPlan;
    }

    zapisz(aktualny);
    return {
      dodano: noweSesje.length,
      pominieto: dok.sesje.length - noweSesje.length,
      odhaczenia: noweOdhaczenia
    };
  }

  return { wczytaj: wczytaj, zapisz: zapisz, eksportJSON: eksportJSON, importJSON: importJSON };
})();
