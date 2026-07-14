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
