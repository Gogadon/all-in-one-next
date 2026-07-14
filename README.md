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
