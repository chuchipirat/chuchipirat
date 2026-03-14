/**
 * Zentrale Roboto-Font- und Emoji-Registrierung für alle PDF-Exporte.
 *
 * Wird als Side-Effect-Import verwendet: `import "./pdfFontRegistration";`
 * Registriert die Roboto-Schriftfamilie in vier Varianten (thin, italic, normal, bold)
 * sowie eine Emoji-Quelle (Twemoji), damit Emojis in PDF-Texten korrekt dargestellt werden.
 *
 * Falls die Registrierung fehlschlägt (z.B. CDN nicht erreichbar), wird der
 * Fehler geloggt, damit die PDF-Generierung mit einer aussagekräftigen Meldung
 * fehlschlagen kann.
 *
 * @see https://gist.github.com/karimnaaji/b6c9c9e819204113e9cabf290d580551
 */
import {Font} from "@react-pdf/renderer";

try {
  Font.register({
    family: "Roboto",
    fonts: [
      {
        src: "https://fonts.gstatic.com/s/roboto/v15/7MygqTe2zs9YkP0adA9QQQ.ttf",
        fontStyle: "normal",
        fontWeight: 100,
      },
      {
        src: "https://fonts.gstatic.com/s/roboto/v15/T1xnudodhcgwXCmZQ490TPesZW2xOQ-xsNqO47m55DA.ttf",
        fontStyle: "italic",
        fontWeight: 100,
      },
      {
        src: "https://fonts.gstatic.com/s/roboto/v16/zN7GBFwfMP4uA6AR0HCoLQ.ttf",
        fontStyle: "normal",
        fontWeight: 400,
      },
      {
        src: "https://fonts.gstatic.com/s/roboto/v15/bdHGHleUa-ndQCOrdpfxfw.ttf",
        fontStyle: "normal",
        fontWeight: 700,
      },
    ],
  });

  // Twemoji als Emoji-Quelle registrieren — rendert Emojis als Bilder im PDF
  Font.registerEmojiSource({
    format: "png",
    url: "https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/",
  });
} catch (error) {
  console.error(
    "PDF-Schriftregistrierung fehlgeschlagen. PDF-Export wird voraussichtlich nicht korrekt funktionieren:",
    error,
  );
}
