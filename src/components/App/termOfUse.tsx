import {
  Container,
  Typography,
  Card,
  CardHeader,
  CardContent,
} from "@mui/material";
import {PageTitle} from "../Shared/pageTitle";
import {
  TERM_OF_USE as TEXT_TERM_OF_USE,
  SMALL_PRINT as TEXT_SMALL_PRINT,
} from "../../constants/text";

/**
 * Seite «Nutzungsbedingungen» — rendert Titel und Karte mit dem
 * vollständigen Nutzungsbedingungs-Text.
 *
 * @returns JSX-Element der Nutzungsbedingungen-Seite.
 */
const TermOfUsePage = () => {
  return (
    <>
      <PageTitle title={TEXT_TERM_OF_USE} subTitle={TEXT_SMALL_PRINT} />

      <Container component="main" maxWidth="md">
        <Card sx={{mt: "2rem", mb: "3rem"}}>
          <CardHeader title={TEXT_TERM_OF_USE} />
          <CardContent>
            <TermOfUseText />
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

/* Nutzungsbedingungen */

/**
 * Nutzungsbedingungs-Text — enthält «Kostenhinweis» und
 * «Haftungsausschluss» als eigenständige Abschnitte.
 *
 * Wird auch im Footer als Standalone-Text verwendet.
 *
 * @returns JSX-Element mit dem vollständigen Nutzungsbedingungen-Text.
 */
const TermOfUseText = () => {
  return (
    <>
      <Typography variant="h6" sx={{mb: 1}}>
        Kostenhinweis für die Nutzung
      </Typography>
      <Typography sx={{mb: 2}}>
        Aktuell ist die Nutzung des chuchipirat kostenlos. Die App-Betreiber
        schätzen jedoch eine freiwillige Spende in Höhe von Fr. 5.00 pro
        Anlass, um die laufenden Fixkosten der App zu decken und deren
        Fortbestand zu unterstützen.
      </Typography>
      <Typography sx={{mb: 2}}>
        Es wird darauf hingewiesen, dass diese Spende rein freiwillig ist und
        die App weiterhin kostenlos genutzt werden kann, unabhängig von
        finanziellen Beiträgen.
      </Typography>
      <Typography sx={{mb: 2}}>
        Zukünftige Kosten: Die Betreiber behalten sich das Recht vor, in
        Zukunft Kosten für die Nutzung der App zu erheben, wenn die laufenden
        Betriebskosten nicht mehr vollständig durch freiwillige Spenden
        gedeckt werden können. Jegliche Kostenänderungen werden den Nutzenden
        rechtzeitig mitgeteilt, und es liegt in der Verantwortung der
        Nutzenden, sich über die aktuellen Konditionen zu informieren.
      </Typography>
      <Typography sx={{mb: 2}}>
        Die Betreiber verpflichten sich, transparent über jegliche
        Kostenänderungen zu kommunizieren und die Nutzer*innen über mögliche
        Auswirkungen zu informieren.
      </Typography>
      <Typography sx={{mb: 2}}>
        Durch die Nutzung der App stimmst du diesem Kostenhinweis zu.
      </Typography>

      <Typography variant="h6" sx={{mb: 1}}>
        Allgemeiner Haftungsausschluss
      </Typography>
      <Typography sx={{mb: 2}}>
        Die Web-Applikation chuchipirat (nachfolgend «App») wurde von
        ehrenamtlichen Personen für den ehrenamtlichen Gebrauch entwickelt. Die
        Entwickler*innen haben nach bestem Wissen und Gewissen an der Erstellung
        der App gearbeitet.
      </Typography>
      <Typography sx={{mb: 2}}>
        Bitte beachte, dass die Nutzung der App auf eigene Verantwortung
        erfolgt. Die Betreiber übernehmen keine Gewähr für die Richtigkeit,
        Vollständigkeit oder Aktualität der in der App bereitgestellten
        Informationen. Es wird darauf hingewiesen, dass die App möglicherweise
        Fehler, Ungenauigkeiten oder technische Probleme enthalten kann.
      </Typography>
      <Typography sx={{mb: 2}}>
        Die Betreiber schliessen jegliche Haftung für Schäden, die direkt oder
        indirekt aus der Nutzung der App resultieren, aus. Dies schliesst, ist
        jedoch nicht beschränkt auf falsch berechnete Mengen, Schäden durch
        Verlust von Daten oder finanzielle Verluste ein.
      </Typography>
      <Typography sx={{mb: 2}}>
        Die App kann Links zu externen Websites oder Diensten enthalten, die
        nicht unter der Kontrolle der Betreiber stehen. Die Betreiber übernehmen
        keine Verantwortung für die Inhalte externer Websites oder Dienste.
      </Typography>
      <Typography sx={{mb: 2}}>
        Die Nutzenden werden dazu aufgefordert, die App verantwortungsbewusst
        und im Einklang mit den geltenden Gesetzen und Vorschriften zu nutzen.
        Bei Unsicherheiten oder Problemen wird empfohlen, professionellen Rat
        einzuholen.
      </Typography>
      <Typography sx={{mb: 2}}>
        Durch die Nutzung der App stimmst du diesem Haftungsausschluss zu. Die
        Betreiber behalten sich das Recht vor, den Inhalt der App und diesen
        Haftungsausschluss jederzeit und ohne vorherige Ankündigung zu ändern.
      </Typography>
      <Typography>Stand, 1. März 2024.</Typography>
    </>
  );
};

export {TermOfUsePage, TermOfUseText};
