# Architektur

- `core`: Modell, Store, Datenbank, Router, Statistiken
- `modules`: reine Konfiguration der Sportarten
- `features/tours`: eine gemeinsame Engine für Rad, Wandern und spätere Outdoor-Module
- `features/strength`: eigener Ausbaupunkt für Krafttraining
- `ui`: Darstellung und wiederverwendbare Helfer

Commands verändern den State. Selectors lesen ihn. Statistiken und Challenges berücksichtigen nur Sessions mit `status: completed`.
