# SwimApp

Prywatna aplikacja webowa do logowania treningów pływackich — tracker splitów co 100 m, plan
treningowy i historia sesji. Bez frameworka, bez kroku builda: czysty HTML/CSS/JS serwowany
jako statyczna strona.

Projekt hobbystyczny, nie komercyjny. Powstaje przy okazji nauki [Claude Code](https://claude.com/claude-code).

**Wersja:** 1.1.2

## Co potrafi

- **Tracker** — dodawanie kolejnych setek jednym polem (`155` → `1:55`), automatyczne wykrywanie
  przerw, czasy zbiorcze na progach 500 / 1000 / 1500 / 2000 m, tryb „trening bez splitów"
  (sam dystans), ostrzeżenie przy dacie, na którą jest już zapisany trening, eksport pojedynczej
  sesji do wklejenia w Excelu.
- **Plan** — plan treningowy (domyślnie 16-tygodniowy) z odhaczaniem wykonanych jednostek
  i kartą „następny trening"; sam plan da się podmienić przez import pliku, bez edycji kodu.
- **Historia** — lista sesji grupowana rok / miesiąc, podgląd splitów, kopiowanie do Excela.
- **Ustawienia** — kopia zapasowa i eksport/import JSON (scalanie po `id`, bez duplikatów),
  import/eksport planu treningowego, edycja i masowe usuwanie sesji, synchronizacja online.
- **Synchronizacja przez GitHub Gist** — dane widoczne na kilku urządzeniach: zapis lokalny
  jest zawsze natychmiastowy i pewny, wysyłka do Gista idzie w tle. Przy równoczesnym zapisie
  z dwóch urządzeń apka pyta, jak rozstrzygnąć konflikt, zamiast po cichu coś nadpisać.
- **Link do podglądu dla znajomych** — osobny link daje dostęp tylko do odczytu: te same dane
  i wszystkie zakładki (można też poklikać sam tracker, żeby zobaczyć jak działa), ale bez
  możliwości zapisu, edycji ani dodawania treningów.

## Pod telefon

Czas mierzy zegarek-stoper, nie apka — wpisywanie do apki jest zawsze po treningu, czasem
tego samego dnia, czasem dopiero po kilku dniach, z telefonu albo z komputera. Telefon nie jest
więc pierwszym ekranem z założenia, ale ma być tak samo wygodny jak komputer, nie wersją
„też działa":

- **Własna klawiatura numeryczna** zamiast systemowej — na iOS natywna klawiatura zasłaniała
  pół ekranu przy każdym z kilkunastu splitów na trening. Na komputerze pola zostają zwykłymi
  polami tekstowymi (wpisywanie z klawiatury + Enter), blokada włącza się tylko na dotyku.
- **Stały układ w trakcie treningu** — karty sesji, podsumowania i pole wpisywania stoją
  w miejscu, przewija się wyłącznie lista splitów. Podgląd wpisywanego czasu i komunikat błędu
  dzielą wiersz z dystansem i mają stałą wysokość, więc panel nie skacze pod palcem.
- **Blokada widoku poziomego i przybliżania** — po obróceniu telefonu pełnoekranowy komunikat
  zamiast rozjechanego układu; wszystkie pola mają 16 px, bo przy mniejszym foncie iOS sam
  przybliża widok po tapnięciu.
- **Bezpieczny margines na notch** (`env(safe-area-inset-top)`), ikona na ekran początkowy
  i ekran startowy z animowanym paskiem ładowania (~3,5 s, całość na CSS).

## Uruchomienie lokalne

Wystarczy otworzyć `index.html` w przeglądarce — nie ma zależności ani kroku builda.
Jeśli wolisz przez serwer:

```bash
python -m http.server 8000
# → http://localhost:8000
```

## Dane

Wszystko żyje przede wszystkim w `localStorage` przeglądarki (klucz `swim.dane`) — zapis
lokalny jest zawsze natychmiastowy i nigdy nie czeka na sieć. Jeśli w Ustawieniach →
Synchronizacja wklejone jest ID sekretnego GitHub Gista i token, apka w tle wysyła tam
kopię danych, dzięki czemu komputer i telefon widzą te same treningi. Bez tej konfiguracji
apka działa dokładnie jak wcześniej — czysto lokalnie, bez żadnego ruchu sieciowego.

**Trzy tryby, zależnie od tego, co jest skonfigurowane:**
- **lokalny** — brak konfiguracji, dane tylko na tym urządzeniu (jak w wersjach 0.x)
- **właściciel** — ID Gista i token: pełna edycja, zapis synchronizuje się w tle
- **gość** — samo ID Gista, bez tokenu: podgląd danych, bez możliwości zapisu

Tryb gościa służy do udostępniania podglądu znajomym: link postaci
`https://pl0mrog.github.io/SwimApp/?gist=<ID>` konfiguruje urządzenie odbiorcy na czysty
odczyt (Tracker i edycja są niedostępne, widać tylko historię i plan). Urządzenie z już
wklejonym tokenem ignoruje taki link — nie da się w ten sposób podmienić cudzej konfiguracji.

Cała warstwa danych jest odizolowana w `js/dane.js` — to jedyny plik w projekcie, który
dotyka `localStorage` i `fetch`. Reszta kodu korzysta wyłącznie z synchronicznych
`wczytaj()`/`zapisz()`/`eksportJSON()`/`importJSON()`.

> W repo nie ma i nie będzie żadnych realnych danych treningowych, ID Gista ani tokenów —
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
js/plan.js              plan wbudowany (domyślny) + walidacja importowanego planu, zero DOM
js/sesja-tabela.js      wspólna tabela splitów (podgląd + edycja)
js/tracker.js           js/plan-widok.js   js/historia.js   js/ustawienia.js  — widoki
```

Kolejność `<script>` w `index.html` jest znacząca — to klasyczne skrypty bez modułów,
każdy eksportuje dokładnie jeden obiekt do `window`.

## Wsparcie przeglądarek

Nowoczesne przeglądarki (Chrome / Edge / Safari, w tym iOS). Kolory używają `oklch()`,
więc bardzo stare wydania mogą renderować się niepoprawnie.
