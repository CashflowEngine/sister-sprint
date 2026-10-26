# Basti’s Reitstall 🐴

Ein Koop-Jump'n'Run zu Pferd für bis zu **5 Spieler** – direkt im Browser, auf iPad, Mac oder PC, **ohne Anmeldung**.
Die Spielmechanik ist an klassische 80er-Jump'n'Runs wie *The Great Giana Sisters* angelehnt; Grafik, Musik, Level und Name sind eigen.

## Spielen

1. Seite öffnen, Namen eingeben, **„Neues Spiel starten“**.
2. Den Link (oder QR-Code) aus dem Warteraum an Freunde schicken. Wer ihn öffnet, klickt **„Mitspielen“**.
3. Der Gastgeber klickt **„Los geht's!“**. Man kann auch später noch dazukommen (Knopf **👥 Einladen**).

| Aktion | Tastatur | iPad |
| --- | --- | --- |
| Laufen | ◀ ▶ oder A / D | Knöpfe unten links |
| Springen (länger = höher) | ↑, W oder Leertaste | großer Knopf rechts |
| Hufeisen werfen | X (oder J, K) | goldener „Wurf“-Knopf |

**Hufeisen:** Goldene Hufeisen schweben im Level (das erste gleich nach dem Start). Jedes gibt 3 Würfe, der Zähler
steht oben links (und am Wurf-Knopf). Ein geworfenes Hufeisen besiegt Gegner aus der Ferne – auch den Igel.
In Level 1 erklären kurze Hinweise, wie es geht. Jede Spielerin sammelt ihre eigenen Hufeisen.

**Im Spiel:** Diamanten sammeln (100 = Extraleben), Bonusblöcke von unten anstoßen, Gegnern auf den Kopf springen
(nicht dem Igel!), zur Fahne reiten. Sobald jemand im Ziel ist, läuft ein Countdown, dann geht es für alle ins nächste Level.

**Zauberblöcke** geben zufällig: Zauberstern (Feuer-Mähne, zerschlägt Ziegel und schützt vor einem Treffer,
plus 5 Hufeisen), Regenbogen (10 s unbesiegbar), Zauberuhr (Gegner eingefroren), Donnerschlag (Gegner in der Nähe weg),
Herz (Extraleben), Diamantenbeutel (+10).

**Welten:** Blumenwiese, Zauberwald, Kristallhöhle, Sandwüste, Eisberge, Ritterburg – danach wiederholen sie sich und werden länger und schwerer.

## Technik

- Reines HTML/JavaScript mit Canvas, kein Build-Schritt. Einfach als statische Seite hosten (z. B. Vercel).
- Mehrspieler über WebRTC mit [PeerJS](https://peerjs.com/) (öffentlicher Vermittlungs-Server). Der Gastgeber-Browser
  verwaltet die gemeinsame Welt (Gegner, Blöcke, Diamanten, Punkte); jeder steuert sein eigenes Pferd.
- Grenzen: Der Gastgeber muss das Spiel offen und im Vordergrund lassen. In sehr strengen Firmen-/Schul-Netzen kann
  WebRTC blockiert sein (dann bräuchte es einen TURN-Server).

## Mehrspieler-Verbindung (TURN)

Damit Mitspielen auch über Mobilfunk oder strenge WLANs klappt, holt das Spiel beim Start kurzlebige
TURN-Zugangsdaten von `/api/turn` (Vercel-Funktion, Cloudflare Realtime TURN). Die Schlüssel liegen nur als
Vercel-Umgebungsvariablen `TURN_KEY_ID` und `TURN_KEY_API_TOKEN` vor, nie im Code. Klappt `/api/turn` nicht,
spielt man mit den öffentlichen STUN-Servern weiter.

## Lokal starten

```bash
python3 -m http.server 8000
# dann http://localhost:8000 öffnen
# zum Testen direkt in einem späteren Level starten: http://localhost:8000/?level=3
```
