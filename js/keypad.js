window.Keypad = (function () {
  const MAXLEN_DEFAULT = 4;

  function cyfry(str) {
    return String(str || '').replace(/[^0-9]/g, '');
  }

  function odpal(input, typ) {
    input.dispatchEvent(new Event(typ, { bubbles: true }));
  }

  // Cała klawiatura ekranowa działa tylko na dotyku (telefon/tablet): tam blokujemy
  // klawiaturę systemową i pokazujemy własną siatkę. Na komputerze nie montujemy nic,
  // a pole zostaje normalnie edytowalne — wpisywanie z fizycznej klawiatury jest szybsze.
  function dotykowe() {
    return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }

  // inputMode='none' wystarcza, żeby iOS nie podniósł klawiatury systemowej.
  // Świadomie NIE ustawiamy readOnly — w polu tylko do odczytu iOS nie rysuje
  // migającej karetki, więc nie widać gdzie się wpisuje.
  function przygotujPole(input) {
    input.setAttribute('autocomplete', 'off');
    if (!dotykowe()) return;
    input.inputMode = 'none';
  }

  function przyciskKeypada(zawartosc, klasa) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'keypad-key' + (klasa ? ' ' + klasa : '');
    b.innerHTML = zawartosc;
    // preventDefault na mousedown: bez tego tapnięcie przycisku zabiera focus
    // z inputa PRZED wywołaniem click, co przy polach z commitem "na blur"
    // (tabelka splitów) zamyka edycję w trakcie wpisywania cyfry.
    b.addEventListener('mousedown', function (e) { e.preventDefault(); });
    return b;
  }

  function zbudujSiatke(input) {
    const maxLen = input.maxLength && input.maxLength > 0 ? input.maxLength : MAXLEN_DEFAULT;

    const wrap = document.createElement('div');
    wrap.className = 'keypad';

    ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'].forEach(function (d) {
      wrap.appendChild(cyfraBtn(d));
    });
    wrap.appendChild(backspaceBtn());

    return wrap;

    function cyfraBtn(d) {
      const b = przyciskKeypada(d, 'keypad-digit');
      b.addEventListener('click', function () {
        if (cyfry(input.value).length >= maxLen) return;
        input.value = cyfry(input.value) + d;
        odpal(input, 'input');
      });
      return b;
    }

    function backspaceBtn() {
      const b = przyciskKeypada('&larr;', 'keypad-back');
      b.setAttribute('aria-label', 'Usuń cyfrę');
      b.addEventListener('click', function () {
        input.value = cyfry(input.value).slice(0, -1);
        odpal(input, 'input');
      });
      return b;
    }
  }

  // Klawiatura na stałe wmontowana w kontenerze (np. stopka Trackera) — bez focusu/blura.
  function mountInline(container, input) {
    przygotujPole(input);
    if (!dotykowe()) return;
    container.innerHTML = '';
    container.appendChild(zbudujSiatke(input));
  }

  // Klawiatura pojawiająca się w dockEl, gdy pole dostaje focus (tap na readonly input).
  function mountOnFocus(input, dockEl) {
    przygotujPole(input);
    if (!dotykowe()) return;
    input.addEventListener('focus', function () {
      dockEl.innerHTML = '';
      dockEl.appendChild(zbudujSiatke(input));
    });
  }

  return { mountInline: mountInline, mountOnFocus: mountOnFocus };
})();
