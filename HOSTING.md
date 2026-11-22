# Gra sieciowa: instrukcja dla gospodarza

Mars Terraform nie ma centralnego serwera gry. Wspólną grę prowadzi **gospodarz**: uruchamia serwer na swoim
komputerze i wysyła innym graczom link. Serwer serwuje stronę gry i połączenie WebSocket z jednego adresu,
trzyma pokoje tylko w pamięci i niczego nie zapisuje na dysku. Gra działa w kooperacji: 2–4 graczy w jednej kolonii.

Gospodarz potrzebuje komputera z Node.js. Pozostali gracze potrzebują tylko przeglądarki.

## 1. Pierwsze uruchomienie

Wymagania: [Node.js](https://nodejs.org/) 20 lub nowszy (z npm) i git.

```bash
git clone https://github.com/develforever/mars-terraform.git
cd mars-terraform
npm ci
```

## 2. Start serwera

```bash
npm run host
```

Polecenie buduje grę (ok. 1 minuty) i uruchamia serwer. Przy kolejnych startach, bez zmian w kodzie,
wystarczy `npm start`. Serwer wypisuje adresy:

```text
🚀 Mars Terraform server on port 3000
   This computer:   http://localhost:3000
   Local network:   http://192.168.1.20:3000
   Internet:        start a tunnel, e.g. `cloudflared tunnel --url http://localhost:3000`
```

Zatrzymanie: `Ctrl+C` w oknie serwera. Wszystkie pokoje się zamykają, a gracze grają dalej solo
na swojej kopii kolonii.

**Inny port** (gdy 3000 jest zajęty):

```bash
PORT=4000 npm start
```

W PowerShell:

```powershell
$env:PORT=4000; npm start
```

## 3. Gra w sieci lokalnej (ten sam router / Wi-Fi)

1. Uruchom serwer (punkt 2) i otwórz adres `Local network` z banera, np. `http://192.168.1.20:3000`.
2. **Windows** przy pierwszym starcie pyta o dostęp Node.js do sieci: zezwól dla **sieci prywatnych**.
   Jeśli okno się nie pojawiło, a inni nie mogą się połączyć, dodaj regułę w Zaporze systemu Windows dla
   `node.exe` (sieci prywatne) albo dla portu TCP 3000.
3. Pozostali gracze otwierają ten sam adres w swojej przeglądarce.

W LAN strona działa po `http`, więc przeglądarka nie daje dostępu do schowka: „Kopiuj link” pokazuje wtedy link
w polu do ręcznego skopiowania (`Ctrl+C`). Niektóre sieci (np. Wi-Fi dla gości) blokują ruch między urządzeniami;
wtedy użyj tunelu (punkt 4).

## 4. Gra przez internet: tunel

Tunel daje serwerowi publiczny adres `https://…` bez otwierania portów w routerze. Serwer działa dalej na Twoim
komputerze, a tunel uruchamiasz w **drugim oknie** terminala. Szyfrowanie (https / wss) zapewnia tunel,
więc w grze nic nie trzeba zmieniać.

### Cloudflare quick tunnel (domyślnie, bez konta)

Instalacja `cloudflared`:

- Windows: `winget install --id Cloudflare.cloudflared`
- macOS: `brew install cloudflared`
- Linux: pakiet z [dokumentacji Cloudflare](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/)

Start (port taki jak serwera):

```bash
cloudflared tunnel --url http://localhost:3000
```

`cloudflared` wypisze adres w rodzaju `https://losowe-slowa.trycloudflare.com`. Ten adres jest nowy przy każdym
uruchomieniu. Quick tunnel jest przeznaczony do testów i krótkich sesji, bez gwarancji dostępności.

### ngrok (alternatywa, wymaga darmowego konta)

1. Załóż konto na [ngrok.com](https://ngrok.com/), zainstaluj `ngrok` i dodaj token:
   `ngrok config add-authtoken <token z panelu ngrok>`.
2. Start:

   ```bash
   ngrok http 3000
   ```

3. Adres to linia `Forwarding`, np. `https://abcd-1234.ngrok-free.app`.

Na darmowym planie ngrok pokazuje graczom przy pierwszym wejściu stronę ostrzegawczą: trzeba kliknąć
**Visit Site**, potem gra działa normalnie.

### Przekierowanie portu w routerze (niezalecane)

Możesz przekierować port TCP 3000 z routera na adres LAN swojego komputera. Wtedy gracze łączą się
po `http://<twój-publiczny-IP>:3000`. Nie polecamy tej opcji: połączenie nie jest szyfrowane, ujawniasz swój
publiczny adres IP, a przeglądarka traktuje taką stronę jak niezabezpieczoną (bez schowka).

### Sprawdzenie adresu

Czy gracze połączą się pod danym adresem (w kolejnym oknie, przy działającym serwerze i tunelu):

```bash
npm run smoke -- https://losowe-slowa.trycloudflare.com
```

Test otwiera stronę, sprawdza nagłówki i `/api/health`, a potem przez WebSocket tworzy pokój, dołącza jako
drugi gracz i wysyła komendę. Działa też z adresem LAN (`npm run smoke -- http://192.168.1.20:3000`).

## 5. Zaproszenie graczy

1. Otwórz grę pod adresem, który dostaną gracze (adres tunelu albo LAN), i rozpocznij lub wczytaj kolonię.
2. Kliknij **🌐 Zaproś**, wpisz pseudonim i wybierz **Utwórz pokój z bieżącej kolonii**.
3. W panelu pokoju kliknij **Kopiuj link** i wyślij go graczom. Link ma postać `https://…/?join=MARS-XXXX`
   i od razu otwiera okno dołączenia z wpisanym kodem.

Gracz może też wejść na adres, kliknąć **🌐 Gra sieciowa** i wpisać kod pokoju ręcznie.

W grze sieciowej czas liczy serwer: nie ma pauzy ani zmiany prędkości. Wszyscy gracze mają równe prawa.
Pokój znika, gdy wyjdzie ostatni gracz albo po 30 minutach bez komend i dołączeń.

Limity serwera: 4 graczy w pokoju, 20 pokoi, 120 połączeń.

## 6. Prywatność i bezpieczeństwo

- Gracze łączą się z **Twoim** komputerem, więc Twój serwer (a przy tunelu także operator tunelu) widzi
  ich adresy IP. Autor gry nie prowadzi serwerów i nie ma dostępu do rozgrywek.
- Serwer nie zapisuje niczego na dysku. Logi zawierają tylko liczbę pokoi i powody ich zamknięcia, bez pseudonimów,
  kodów pokoi i adresów IP.
- Wpuszczaj tylko osoby, którym wysłałeś link. Kod pokoju jest jedynym „hasłem”: po 5 nietrafionych kodach serwer
  rozłącza zgadującego.
- Wyłącz serwer i tunel (`Ctrl+C` w obu oknach), gdy skończysz grać.
- Zostaw `cors_origins` w `.env` puste. Serwer akceptuje połączenia ze strony serwowanej przez siebie
  (w tym przez tunel). Listy potrzeba tylko w nietypowej konfiguracji (punkt 7).

Pełna informacja dla graczy: strona `/privacy` w grze.

## 7. Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Brak przycisków **🌐 Gra sieciowa** / **🌐 Zaproś** | Strona nie pochodzi z serwera gry (np. statyczny hosting). Otwórz adres z banera serwera albo tunelu. |
| Baner: `Frontend not built` | Uruchom `npm run host` (albo `npm run build`, potem `npm start`). |
| `Port 3000 is already in use` przy starcie | Na porcie działa już serwer (np. uruchomiony wcześniej w innym oknie) albo inna aplikacja. Zatrzymaj go albo uruchom na innym porcie (`PORT=4000`) i podaj ten port tunelowi. |
| Gracze w LAN nie mogą się połączyć | Zapora Windows (punkt 3), inna sieć Wi-Fi albo izolacja klientów w routerze. |
| „Utracono połączenie z serwerem gry” | Serwer lub tunel został zatrzymany albo zerwał się internet. Gra trwa dalej solo; po ponownym starcie utwórz nowy pokój. |
| Połączenie odrzucone (403) przez nietypowe proxy | Proxy zmienia nagłówek `Host` i nie wysyła `X-Forwarded-Host`. Dopisz adres strony do `cors_origins` w `.env`, np. `cors_origins=https://gra.example.org`. |
| „Pokój jest pełny” / „Serwer gry jest pełny” | Limit 4 graczy na pokój albo 20 pokoi na serwer. |
