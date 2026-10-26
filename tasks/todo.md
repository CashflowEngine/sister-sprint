# Task: Reittier wählen

## Context
Acht persönliche, rein kosmetische Reittiere für Desktop und iPhone, mit gemeinsamer Canvas-Grafik in Auswahl und Spiel und synchronisierter Mehrspieler-Auswahl.

## Todo
- [x] Acht erkennbare, animierte Reittiere als gemeinsame Zeichenfunktion erstellen.
- [x] Große Auswahl im Menü und Warteraum mit gespeicherter Wahl einbauen.
- [x] Auswahl in Spielerinformationen und Netzwerk integrieren; Trefferbox unverändert lassen.
- [x] Desktop, iPhone und echte PeerJS-Verbindung mit Playwright prüfen und Screenshots ansehen.
- [x] README und Review ergänzen und geprüfte Änderung für Feature-Branch und PR vorbereiten.

## Files Affected
- `js/mounts.js` — gemeinsame Grafik und Auswahlkatalog
- `js/game.js` — Picker, Speicherung, Rendering und Synchronisation
- `index.html`, `css/style.css` — Auswahlflächen und responsive Gestaltung
- `README.md` — Reittiere erklären

## Review
### Änderungen
- Gemeinsamer Canvas-Katalog mit fünf Pferderassen und drei Fahrzeugen, einschließlich kosmetischer Bewegung.
- Auswahl in Menü und Warteraum, lokale Speicherung, Spielerfarben und Namensschilder erhalten.
- Gastgeber bestätigt und verteilt die Wahl im Spielerinfo-Paket und im laufenden Zustand. Fehlende/unbekannte Werte ergeben Haflinger.
- Keine Änderungen an Physik, Trefferbox (40 × 52), Leveldaten, TURN-Abruf oder Hufeisenlogik.

### Prüfung
- `node --check` für alle JavaScript-Dateien unter `js/` und `api/`, `git diff --check`: erfolgreich.
- Lokaler Python-HTTP-Server auf Port 8765, Playwright/Chromium aus `/tmp/rs-pw`.
- Desktop 1280 × 720: alle acht Kacheln sichtbar, Wahl nach Neuladen erhalten, alle acht Reittiere im echten Spiel mit Tastatur bewegt.
- iPhone-Emulation 844 × 390, Touch und DPR 3: Auswahl per Tap, Pferd/Traktor/Bobcat bewegt, Steuerung sichtbar. Hochkant 390 × 844: Drehhinweis sichtbar.
- Öffentlicher PeerJS-Server und echte WebRTC-Verbindung zwischen getrennten Kontexten: Traktor/Lusitano gegenseitig sichtbar, beide Warteraum-Wechsel synchronisiert, später Beitritt erfolgreich.
- Fehlende und unbekannte Auswahl per echten hello-Nachrichten: Haflinger. Wechsel während laufendem Spiel abgewiesen.
- iPhone-Beitritt über Einladungslink sowie horizontaler Warteraum-Picker per Tap geprüft.
- Hufeisen eingesammelt und geworfen, Tastatur-Sprung erfolgreich. Keine JavaScript-Laufzeitfehler.
- Alle gespeicherten Screenshots persönlich geprüft. Bobcat-Kabinendach über den Helm verlegt, Tap-Hervorhebung bereinigt. Schutz-Blinkphase vor Spielaufnahmen abgewartet.

### Nachweise und Grenzen
- Screenshots, Prüfprotokolle und reproduzierbare Playwright-Skripte: `/Users/thomas/tom-work/reitstall-mounts-out/`.
- Lokal liefert `/api/turn` erwartungsgemäß 404; der STUN-Fallback funktioniert. WebRTC-Transport meldet `dtlsState: connected`.
- iPhone wurde in Chromium emuliert; kein physisches iPhone/Safari geprüft.
- Keine GitHub Actions ausgeführt, kein Merge und kein Deployment beauftragt.
