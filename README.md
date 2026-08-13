# SwimApp

Prywatna aplikacja webowa do logowania treningów pływackich — tracker splitów co 100 m, plan
treningowy i historia sesji. Bez frameworka, bez kroku builda: czysty HTML/CSS/JS serwowany
jako statyczna strona.

Projekt hobbystyczny, nie komercyjny. Powstaje przy okazji nauki [Claude Code](https://claude.com/claude-code).

**Wersja:** 0.9.8

## Co potrafi

- **Tracker** — dodawanie kolejnych setek jednym polem (`155` → `1:55`), automatyczne wykrywanie
  przerw, czasy zbiorcze na progach 500 / 1000 / 1500 / 2000 m, tryb „trening bez splitów"
  (sam dystans), ostrzeżenie przy dacie, na którą jest już zapisany trening, eksport pojedynczej
  sesji do wklejenia w Excelu.
- **Plan** — 16-tygodniowy plan treningowy z odhaczaniem wykonanych jednostek i kartą
  „następny trening".
- **Historia** — lista sesji grupowana rok / miesiąc, podgląd splitów, kopiowanie do Excela.
- **Ustawienia** — kopia zapasowa i eksport/import JSON (scalanie po `id`, bez duplikatów),
  edycja i masowe usuwanie sesji.

## Pod telefon

Apka powstała z myślą o wpisywaniu czasów na basenie, więc telefon jest tu pierwszym ekranem,
nie wersją „też działa":

- **Własna klawiatura numeryczna** zamiast systemowej — na iOS natywna klawiatura zasłaniała
  pół ekranu przy każdym z kilkunastu splitów na trening. Na komputerze pola zostają zwykłymi
  polami tekstowymi (wpisywanie z klawiatury + Enter), blokada włącza się tylko na dotyku.
- **Stały układ w trakcie treningu** — karty sesji, podsumowania i pole wpisywania stoją
  w miejscu, przewija się wyłącznie lista splitów. Pasek podglądu pod polem ma stałą wysokość,
  więc pojawienie się komunikatu nie przesuwa panelu pod palcem.
- **Blokada widoku poziomego i przybliżania** — po obróceniu telefonu pełnoekranowy komunikat
  zamiast rozjechanego układu; wszystkie pola mają 16 px, bo przy mniejszym foncie iOS sam
  przybliża widok po tapnięciu.
- **Bezpieczny margines na notch** (`env(safe-area-inset-top)`), ikona na ekran początkowy
  i ekran startowy z animowanym paskiem ładowania (~2,7 s, całość na CSS).

## Uruchomienie lokalne

Wystarczy otworzyć `index.html` w przeglądarce — nie ma zależności ani kroku builda.
Jeśli wolisz przez serwer:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Dane

Aktualnie wszystko żyje w `localStorage` przeglądarki (klucz `swim.dane`) — dane **nie są
współdzielone** między urządzeniami. Przenosi się je ręcznie przez eksport/import JSON
w zakładce Ustawienia.

Docelowo (etap 3) źródłem prawdy ma być sekretny GitHub Gist, żeby komputer i telefon
widziały te same dane. Cała warstwa danych jest już odizolowana w `js/dane.js`
za czterema funkcjami (`wczytaj`, `zapisz`, `eksportJSON`, `importJSON`), więc podmiana
backendu to jeden plik.

> W repo nie ma i nie będzie żadnych realnych danych treningowych ani tokenów —
> patrz `.gitignore`.

## Struktura

```
index.html              szkielet + rejestracja skryptów
css/style.css           warstwa wizualna „Navy Pool" (ciemny motyw)
icon/                   ikony aplikacji (ekran początkowy iOS)
js/wersja.js            numer wersji (jedno źródło prawdy dla UI)
js/app.js               router zakładek, rejestr widoków, ekran startowy
js/dane.js              warstwa danych — jedyne miejsce dotykające localStorage
js/model.js             obliczenia na sesji, parsowanie czasów, eksport do Excela
js/keypad.js            klawiatura numeryczna zastępująca systemową na dotyku
js/plan.js              treść planu treningowego (same dane, zero DOM)
js/sesja-tabela.js      wspólna tabela splitów (podgląd + edycja)
js/tracker.js           js/plan-widok.js   js/historia.js   js/ustawienia.js  — widoki
```

Kolejność `<script>` w `index.html` jest znacząca — to klasyczne skrypty bez modułów,
każdy eksportuje dokładnie jeden obiekt do `window`.

## Wsparcie przeglądarek

Nowoczesne przeglądarki (Chrome / Edge / Safari, w tym iOS). Kolory używają `oklch()`,
więc bardzo stare wydania mogą renderować się niepoprawnie.
