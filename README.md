# All-in-One Next

Direkt auf GitHub Pages lauffähige PWA ohne Build-Schritt.

## Enthalten
- Dashboard und Modulfarben
- Hash-Router
- IndexedDB mit LocalStorage-Fallback
- Backup-Export/-Import
- gemeinsame Touren-Engine für Rad und Wandern
- Bearbeitungsentwürfe: Originaldaten ändern sich erst beim Speichern
- Zeitraumstatistik
- Challenges für Rad und Wandern
- vorbereiteter Platz für die Kraft-Engine

## GitHub Pages
Alle Dateien in ein neues Repository hochladen. Danach unter **Settings → Pages** den Branch `main` und `/root` auswählen.

## Tests
```bash
npm test
```

Die Kraft-/Plan-/Zykluslogik ist bewusst noch nicht vollständig implementiert. Dieses Projekt ist das neue, saubere Fundament.


## Design-Update v2

- kompaktes 2×2-Kachel-Dashboard
- dauerhafter Start-Button in allen Modulen
- Start-Tab in der unteren Modulnavigation
- hochwertigere Modulheader, Listen, Formulare und Statistik-Karten


## Dashboard-Update v3

- kompakte 2×2-Modulkacheln nach dem aktuellen Dashboard der ersten App
- zweistufige Wochenübersicht mit Aktivitäten und aktiven Tagen
- modulspezifische Wochenzeilen
- Wochenkalender mit Farbpunkten
- Monatskalender mit Navigation und Legende


## Kalender-Update v4

- Antippen eines Tages öffnet ein Bottom-Sheet.
- Vergangene und heutige Tage zeigen abgeschlossene Sessions aller Module.
- Sessions lassen sich einzeln aufklappen.
- Rad und Wandern zeigen alle gespeicherten Messwerte.
- Kraftsessions werden generisch mit Übungen, Satzwerten und Volumen dargestellt.
- Zukünftige Tage besitzen einen neutralen Vorschauzustand.


## Funktions-Update v6

- Teilkarten für Rad, Wandern und Kraft
- Web Share API mit PNG-Download als Fallback
- optionale Messwerte für Touren
- Rad: Maximalgeschwindigkeit, Maximalpuls, Leistung, Trittfrequenz
- Wandern: Maximalpuls
- freie Krafttrainings mit Übungen, Sätzen, Gewicht und Wiederholungen
- Aufwärmsätze, Trainingsvolumen, Notizen, Bearbeiten und Löschen
- Plan und Zyklus bleiben die nächste Kraft-Etappe


## Kraft- und Fortschritts-Update v7

- einarmige Satzfelder für links und rechts
- Progression verwendet die schwächere Seite
- Steigerung erst, wenn beide Seiten in allen Zielsätzen die Maximalwiederholungen erreichen
- Assistenzmodus ohne Minus-Eingabe
- Umschalten von Unterstützung auf Körpergewicht oder Zusatzgewicht
- Prefill aus dem letzten Training
- Progressionsvorschläge für Double Progression, feste Wiederholungen und Technik
- PR-Erkennung für Gewicht, Wiederholungen und reduzierte Unterstützung
- Fortschrittsbereich mit Top-Gewicht, Durchschnittsgewicht und Übungsvolumen
- Wochenvolumen als Balkendiagramm
- aufklappbarer vollständiger Satzverlauf


## Kraft-Struktur-Update v8

- Navigation wieder als Start, Heute, Plan und Verlauf
- Start führt ausschließlich zum globalen Dashboard
- Heute zeigt nur nächste oder laufende Einheit
- manuelles Überspringen einer Einheit
- Rest- und Active-Rest-Einheiten werden automatisch übersprungen
- geplante und freie Sessions
- Planansicht mit Zyklus und Einheitenbibliothek
- Übungen bleiben in einer separaten, wiederverwendbaren Bibliothek
- Alternativen bleiben Beziehungen zwischen Übungen
- Verlauf und Fortschritt als Umschalter im selben Bereich
- Cardioaktivitäten im Krafttraining verwenden ihre eigenen Messwerte
- Laufband, Fahrrad und weitere Cardiosegmente werden nicht als Kraftsätze dargestellt


## Zyklus- und Rest-Day-Korrektur v9
- Active Rest Days bleiben am aktuellen Tag sichtbar.
- Nicht absolvierte Rest Days werden am nächsten Kalendertag automatisch durch die datumsbasierte Zyklusberechnung verlassen.
- Überspringen gilt für jede aktuelle Einheit.
- Einheiten können explizit als Rest Day markiert werden.
- Heute korrigieren öffnet eine Auswahl aller Zykluspositionen.
- Der Anker wird beim Abschluss nicht mehr doppelt weitergeschaltet.


## Heute-Paritätsupdate v10

- maximal eine Kraftsession pro Kalendertag
- abgeschlossene Einheit bleibt bis zum Tageswechsel im Heute-Tab sichtbar
- nächste Zykluseinheit erscheint erst am Folgetag
- Heute korrigieren verwirft eine offene oder abgeschlossene heutige Kraftsession
- Bestätigungsdialog vor dem Ersetzen
- kompakte Cardiofelder mit bis zu drei Feldern pro Zeile
- kompaktere Satzfelder
- dynamische Kopfzusammenfassung für Kraft, Cardio und gemischte Einheiten
