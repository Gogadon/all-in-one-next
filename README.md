# All-in-One Rebuild

Sauberer Neustart der All-in-One-App. Version **0.2.0** enthält bewusst nur das Dashboard-Fundament.

## Aktueller Umfang

- kompaktes 2×2-Modulraster
- konsistente SVG-Line-Icons statt Emojis
- Status je Modul
- Wochenübersicht mit Aktivitäten, aktiven Tagen und Modulwerten
- Wochenkalender
- Monatskalender
- Tages-Sheet mit aufklappbaren Sessions
- einfache Tagesplanung mit Umrisspunkten
- Import alter Backups der ursprünglichen All-in-One-App
- Export des neuen Zustands
- Hash-Routing für Android-Zurück-Button und Reload
- PWA-Grundlage ohne veralteten Service-Worker-Cache
- mobile Höhenberechnung ohne künstliches Seiten-Padding

## Bewusst noch nicht enthalten

- Kraftmodul
- Radmodul
- Wandern-Modul
- Challenge-Modul

Die Modulkacheln öffnen nur eine neutrale Vorschauseite. Die Module werden erst nach der Dashboard-Abnahme einzeln portiert.

## Projektstruktur

```text
all-in-one-rebuild-0.1.0/
├── index.html
├── manifest.webmanifest
├── sw.js
├── package.json
├── README.md
├── assets/icons/
├── src/
│   ├── app.js
│   ├── styles.css
│   ├── core/
│   ├── features/dashboard/
│   ├── features/calendar/
│   └── ui/
└── tests/
```

## GitHub Pages

Den **Inhalt** des entpackten Ordners in die Repository-Wurzel hochladen.

```text
Settings → Pages → Deploy from a branch → main → /root
```

## Backup importieren

```text
Zahnrad → Backup importieren
```

Unterstützt werden Backups der alten App (`{ app, schema, daten }`) und dieses Rebuilds (`{ app, version, data }`).

## Tests

```bash
npm test
```

## Versionsplan

- `0.1.x`: Dashboard abnehmen
- `0.2.x`: Kraftmodul vollständig aus dem alten Repo portieren
- `0.3.x`: Radmodul
- `0.4.x`: Wandern
- `0.5.x`: Challenge
- `1.0.0`: vollständige, abgenommene App


## Änderungen in 0.1.1

- Textauswahl und Android-Kontextmenü außerhalb echter Eingabefelder deaktiviert
- Eingabefelder, Textbereiche und `contenteditable` bleiben normal auswählbar
- eigener Import-Warndialog im App-Design
- Warnung erscheint vor dem Öffnen der Dateiauswahl
- erfolgreiche Importe werden mit einem kleinen Toast bestätigt
- Importfehler werden in einem App-Dialog statt per Browser-`alert()` angezeigt
- auch das Zurücksetzen nutzt jetzt den einheitlichen App-Dialog


## Änderungen in 0.1.2

- fehlerhafte 0.1.1-Dialogumstellung tatsächlich korrigiert
- `alert()` und `confirm()` vollständig aus `src/app.js` entfernt
- eigener Warn- und Bestätigungsdialog für Import und Datenlöschung
- Toast nach erfolgreichem Import
- eigener Pull-to-Reload für Browser und installierte PWA
- Pull-to-Reload funktioniert am oberen Rand jeder normalen App-Seite
- Tages-Sheet und geöffnete Dialoge blockieren Pull-to-Reload bewusst


## Änderungen in 0.1.3

- eigener Bestätigungsdialog vor dem Backup-Export
- Export verändert oder löscht keine lokalen Daten
- eindeutige Export-Dateinamen mit Datum, Uhrzeit und Sekunden
- Beispiel: `all-in-one-backup-2026-07-15-231845.json`
- dadurch erscheint die systemseitige Nachfrage „Datei noch einmal herunterladen?“ normalerweise nicht mehr
- kleiner Toast nach dem Start des Downloads


## Kraft-Grundstruktur 0.2.0

Diese Etappe ist absichtlich **nur lesend**. Das Kraftmodul übernimmt Datenstruktur und Navigation der alten App, verändert aber noch keine Trainingsdaten.

### Enthalten

- Kraftnavigation: Start, Heute, Plan und Verlauf
- eigene URL-Pfade für sämtliche Kraftbereiche
- Android-Zurück-Navigation und Reload bleiben erhalten
- Tagesansicht mit:
  - aktueller Zyklusposition
  - nächster Einheit
  - erkanntem Rest Day
  - abgeschlossener oder offener heutiger Session
  - vollständiger Aktivitätenliste der Einheit
- Planansicht mit:
  - vollständigem Zyklus
  - Markierung der heutigen Position
  - Einheitenbibliothek
  - Nutzungshäufigkeit jeder Einheit im Zyklus
  - aufklappbaren Einheiten und geordneter Übungsliste
- separate Übungsbibliothek:
  - Kraft- und Cardioaktivitäten
  - Messwerte
  - Einarmig- und Assistiert-Merkmale
  - Progressionseinstellungen
  - Notizen
  - Alternativen als Referenzen auf andere Bibliotheksübungen
- lesbarer Trainingsverlauf mit aufklappbaren Sessions
- Datenprüfung auf fehlende Einheiten- und Aktivitätsreferenzen

### Noch nicht enthalten

- Training starten oder fortsetzen
- Überspringen
- Heute korrigieren
- Plan und Bibliotheken bearbeiten
- Verlauf teilen
- Fortschrittscharts

Diese Schreib- und Trainingsabläufe folgen in Version 0.2.1 und späteren Kraft-Etappen.
