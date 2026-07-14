# All-in-One Next

Modularer Neustart der All-in-One-App für die Nutzung am Smartphone und die Veröffentlichung über GitHub Pages.

## Eigenschaften

- Vanilla JavaScript mit ES-Modulen
- kein Build-Schritt erforderlich
- direkt für GitHub Pages geeignet
- Hash-Routing
- IndexedDB mit LocalStorage-Fallback
- PWA mit Offline-App-Shell
- Backup-Export und -Import
- Import alter All-in-One-Backups aus Schema 2
- gemeinsame Touren-Engine für Rad und Wandern
- Dashboard mit Modulkacheln, Wochenübersicht und Kalender
- Tagesansicht mit modulübergreifenden Sessiondetails
- vorbereitet für Kraft, Challenges und weitere Module

## GitHub Pages

1. Neues Repository erstellen.
2. Alle Dateien aus diesem Projekt in das Repository hochladen.
3. In GitHub unter **Settings → Pages** als Quelle den Branch `main` und `/root` auswählen.
4. Danach die angezeigte GitHub-Pages-Adresse öffnen.

## Lokal testen

ES-Module funktionieren nicht zuverlässig über `file://`.

```bash
python3 -m http.server
```

Danach `http://localhost:8000` öffnen.

## Tests

```bash
npm test
```

Aktueller Stand:

```text
7 Tests
7 bestanden
0 fehlgeschlagen
```

## Aktueller Funktionsumfang

### Dashboard

- kompakte 2×2-Modulkacheln
- Status je Modul
- Wochenübersicht mit:
  - Aktivitäten insgesamt
  - aktiven Tagen
  - Aufschlüsselung nach Modul
- Wochenkalender mit farbigen Aktivitätspunkten
- Monatskalender mit Navigation und Legende

### Kalender

- Antippen eines Tages öffnet ein Tages-Sheet
- vergangene und heutige Tage zeigen abgeschlossene Sessions
- zukünftige Tage zeigen einen neutralen Vorschauzustand
- mehrere Aktivitäten am selben Tag möglich
- Sessions lassen sich einzeln aufklappen
- Rad und Wandern zeigen gespeicherte Messwerte
- Kraftsessions zeigen Übungen, Sätze, Volumen und Notizen
- Hintergrundscrollen ist bei geöffnetem Tages-Sheet gesperrt
- das Sheet kann geschlossen werden über:
  - X-Button
  - Tippen auf den Hintergrund
  - Tippen auf den Griff
  - Herunterziehen des Griffs

### Rad und Wandern

- Tour anlegen
- Tour bearbeiten
- Tour speichern
- Bearbeitung abbrechen
- Tour löschen
- Listenansicht
- Detailansicht
- Statistik für Woche, Monat und Jahr
- nur abgeschlossene Touren zählen in Statistiken und Challenges

### Challenges

Unterstützte Ziele:

- Rad-Kilometer
- Wander-Kilometer
- Wander-Höhenmeter
- Wander-Schritte

### Daten und Backups

- Backup exportieren
- Backup importieren
- alte Schema-2-Backups direkt importieren
- automatische Konvertierung von:
  - Bibliothek
  - Kraftsessions
  - Radtouren
  - Wanderungen
  - Notizen
  - unterstützten Challenges
  - altem Kraftplan als Legacy-Datensatz
- Snapshots vor kritischen Änderungen
- IndexedDB als Hauptspeicher
- LocalStorage als Fallback

## Architektur

```text
all-in-one-next/
│
├── index.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── README.md
│
├── assets/
├── src/
├── tests/
└── docs/
```

### Grundprinzipien

- `core` enthält Datenmodell, Zeiträume, Speicherung und Statistiken
- `features` enthalten vollständige Nutzerabläufe
- `modules` enthalten die Modulkonfigurationen
- `ui` enthält wiederverwendbare Komponenten und Styles
- Commands verändern den State
- Selectors lesen den State
- Statistiken und Challenges verwenden nur abgeschlossene Sessions
- Tourbearbeitungen laufen über Entwürfe und verändern das Original erst beim Speichern

## Datenmodell

```text
State
 ├─ activities
 ├─ sessions
 │   └─ segments
 │       └─ entries
 │           └─ metrics
 ├─ plans
 ├─ challenges
 ├─ preferences
 └─ meta
```

Session-Status:

- `draft`
- `completed`
- `skipped`
- `archived`

## Modulfarben

```text
Kraft       #C8F43D
Rad         #45D6F5
Wandern     #FFB84D
Challenge   #FF6D91
Schwimmen   #9E8CFF
Laufen      #66E0A3
```

## Aktueller Entwicklungsstand

Bereits funktional:

- Dashboard
- Navigation
- Rad
- Wandern
- Challenges
- Wochenübersicht
- Wochen- und Monatskalender
- Tages-Sheet
- Backup-System
- Import alter Backups
- Statistik
- PWA-Grundlage

Noch nicht vollständig umgesetzt:

- vollständiges Kraftmodul
- Planeditor
- Zykluslogik
- Progression
- Trainingsverlauf als eigenes Modul
- zukünftige Tagesplanung im Kalender
- Synchronisierung über mehrere Geräte

## Versionen

### v5

- Import alter Schema-2-Backups
- Konvertierung von Kraftsessions, Touren, Bibliothek und Notizen
- Hintergrundscrollen bei geöffnetem Tages-Sheet gesperrt
- Griff zum Schließen per Tippen und Herunterziehen
- 7 Tests

### v4

- Tages-Sheet mit modulübergreifenden Sessiondetails
- aufklappbare Sessions
- Kraftdaten-Darstellung vorbereitet

### v3

- kompakte Modulkacheln
- zweistufige Wochenübersicht
- Wochenkalender
- Monatskalender

### v2

- überarbeitetes Dashboard
- feste Rücknavigation zum Dashboard
- modernisierte Modulansichten

### v1

- technisches Grundfundament
- gemeinsame Touren-Engine
- IndexedDB
- Backup
- PWA
