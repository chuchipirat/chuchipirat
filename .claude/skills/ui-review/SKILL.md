---
name: ui-review
description: Review UI changes in chuchipirat against project conventions and check them in the browser on desktop and mobile. Use after changing React components, pages, dialogs or styles, before calling a UI task done.
---

# UI-Review

Prüft geänderte UI-Komponenten gegen die Projektkonventionen und im Browser. Befunde zuerst auflisten, nicht stillschweigend fixen.

## 1. Code-Prüfung

Nur die geänderten Komponenten (`git diff --name-only develop...` bzw. die Dateien der aktuellen Story):

- **Nur MUI**: keine anderen UI-Bibliotheken, kein Tailwind, keine eigenen CSS-Dateien.
- **Styles**: wiederverwendete Styles in `src/constants/styles/<bereich>.styles.ts` (`get<Bereich>Styles(theme)`), in `src/constants/styles.ts` über `useCustomStyles()` eingehängt. Einmalige, triviale `sx` direkt an der Komponente sind ok.
- **Texte**: alle UI-Texte in `src/constants/text/*.ts`, Schweizer Hochdeutsch (kein «ß»), «du»-Form. Keine hartcodierten Strings in JSX.
- **Zustände**: Laden, Fehler (Sentry, generische Meldung) und Leerzustand sind behandelt.
- **Löschen / Verwerfen**: passende Stufe gewählt?

  | Situation | Muster |
  |---|---|
  | Leicht wiederherstellbar (z.B. Listenzeile) | kein Dialog |
  | Normales Löschen, Änderungen verwerfen | `DialogType.Confirm` mit `destructive: true` und `buttonTextConfirm: TEXT_DELETE` (nie «OK» auf rotem Button) |
  | Gross und unumkehrbar (Anlass, Rezept, Einheit) | `DialogType.ConfirmSecure` (Name eintippen) |

  Kein eigenes Muster bauen (z.B. Gedrückt-halten-Buttons): auf dem Handy kollidiert langes Drücken mit Textauswahl/Kontextmenü, und es ist schlecht auffindbar.
- **Formulare**: Labels an allen Feldern, Fehlermeldung am Feld (`helperText`), Submit gesperrt während des Speicherns, Enter/Tab funktionieren.
- **Responsiv**: keine fixen Breiten, die auf 390 px überlaufen; lange Werte (IBAN, Namen, E-Mail) brechen um; Dialoge auf Mobile `fullScreen` oder ausreichend breit.
- **Touch**: MUI-Standardgrössen sind ok; melden nur `size="small"` bei Hauptaktionen, sehr kleine `IconButton`s ohne Abstand und Aktionen, die nur per Hover erreichbar sind.

## 2. Browser-Prüfung

Mit dem Skill `claude-in-chrome` (bzw. `anthropic-skills:chrome-browser`), App lokal (`npm start`, falls nicht schon läuft):

1. Seite mit der Änderung öffnen, Hauptablauf einmal durchspielen (inkl. Fehlerfall, z.B. ungültige Eingabe).
2. **Desktop** 1280 × 800: Screenshot.
3. **Mobile** 390 × 844 (`resize_window`): Screenshot, Ablauf erneut prüfen (Dialoge, Umbrüche, Scrollen). Prüfen, ob die Grösse wirklich greift (Screenshot-Breite). Bleibt das Fenster breit (maximiert/Vollbild), nicht weiter versuchen: den User bitten, das Chrome-Fenster zu verkleinern, sonst Mobile als «nicht geprüft» vermerken.
4. Konsole auf Fehler/Warnungen prüfen (`read_console_messages` mit Muster, z.B. `Error|Warning`).

Ist die Chrome-Erweiterung nicht verbunden: **nicht** behaupten, es sei geprüft. In der Review vermerken: «Browser-Prüfung Desktop + Mobile ausstehend (Chrome-Erweiterung nicht verbunden)».

## 3. Ergebnis

Kurz und in dieser Form:

```
Code:    <Befunde oder «ok»>
Desktop: <Befunde oder «ok»> (Screenshot)
Mobile:  <Befunde oder «ok»> (Screenshot)
Nicht geprüft: <was und warum>
```

Danach fragen, welche Befunde gefixt werden sollen.
