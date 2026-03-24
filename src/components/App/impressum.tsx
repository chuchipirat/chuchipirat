import {
  Container,
  Typography,
  Link,
  Card,
  CardHeader,
  CardContent,
} from "@mui/material";

import {PageTitle} from "../Shared/pageTitle";
import {
  IMPRESSUM as TEXT_IMPRESSUM,
  SMALL_PRINT as TEXT_SMALL_PRINT,
} from "../../constants/text";

/**
 * Seite «Impressum» — rendert Titel und Karte mit den rechtlich
 * erforderlichen Angaben zum Verein chuchipirat.
 *
 * @returns JSX-Element der Impressum-Seite.
 */
const ImpressumPage = () => {
  return (
    <>
      <PageTitle title={TEXT_IMPRESSUM} subTitle={TEXT_SMALL_PRINT} />

      <Container component="main" maxWidth="md">
        <Card sx={{mt: "2rem", mb: "3rem"}}>
          <CardHeader title={TEXT_IMPRESSUM} />
          <CardContent>
            <ImpressumText />
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

/**
 * Impressum-Text — enthält die rechtlich erforderlichen Angaben
 * (Verantwortliche Stelle, Zweck, Haftungsausschluss).
 *
 * @returns JSX-Element mit dem vollständigen Impressum-Text.
 */
const ImpressumText = () => {
  return (
    <>
      <Typography variant="h6" gutterBottom>
        Verantwortlich für den Inhalt
      </Typography>
      <Typography paragraph>
        Verein chuchipirat
        <br />
        8041 Zürich
        <br />
        <Link href="mailto:hallo@chuchipirat.ch">hallo@chuchipirat.ch</Link>
      </Typography>

      <Typography variant="h6" gutterBottom>
        Zweck
      </Typography>
      <Typography paragraph>
        chuchipirat ist eine kostenlose, quelloffene Webapp für Schweizer
        Jugendorganisationen (Jungwacht Blauring, Pfadi uvm.), um die Lagerküche
        zu planen. Der Verein chuchipirat betreibt die Webapp ehrenamtlich und
        gemeinnützig.
      </Typography>

      <Typography variant="h6" gutterBottom>
        Haftungsausschluss
      </Typography>
      <Typography paragraph>
        Die Inhalte dieser Website wurden mit grösster Sorgfalt erstellt. Für
        die Richtigkeit, Vollständigkeit und Aktualität der Inhalte können wir
        jedoch keine Gewähr übernehmen. Als Diensteanbieter sind wir für eigene
        Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich.
        Eine Verpflichtung zur Überwachung übermittelter oder gespeicherter
        fremder Informationen besteht jedoch nicht.
      </Typography>
      <Typography paragraph>
        Verpflichtungen zur Entfernung oder Sperrung der Nutzung von
        Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.
        Eine diesbezügliche Haftung ist jedoch erst ab dem Zeitpunkt der
        Kenntnis einer konkreten Rechtsverletzung möglich. Bei Bekanntwerden von
        entsprechenden Rechtsverletzungen werden wir diese Inhalte umgehend
        entfernen.
      </Typography>
    </>
  );
};

export {ImpressumPage, ImpressumText};
