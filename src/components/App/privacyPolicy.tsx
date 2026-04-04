import {
  Container,
  Typography,
  Link,
  Card,
  CardHeader,
  CardContent,
  Box,
} from "@mui/material";
import {PRIVACY_POLICY as ROUTE_PRIVACY_POLICY} from "../../constants/routes";
import {Link as RouterLink} from "react-router";
import {PageTitle} from "../Shared/pageTitle";
import {
  PRIVACY_POLICY as TEXT_PRIVACY_POLICY,
  SMALL_PRINT as TEXT_SMALL_PRINT,
} from "../../constants/text";

const customStyles = {
  customOrderedList: {
    counterReset: "item",
    fontSize: "1rem",
    paddingLeft: "0",
  },
  listItem: {
    paddingLeft: "0rem",
    paddingTop: "0.5rem",
    paddingBottom: "1rem",
    display: "block",
    "&:before": {
      content: 'counters(item, ".") " "',
      counterIncrement: "item",
      width: "1.5em",
      display: "inline-block",
      fontWeight: "bold",
    },
  },
  subListItem: {
    fontWeight: "normal",
    paddingBottom: "0.5rem",
    "&:before": {
      content: 'counters(item, ".") " "',
      counterIncrement: "item",
      width: "2em",
      display: "inline-block",
      fontWeight: "normal",
    },
  },
};

/**
 * Seite «Datenschutzerklärung» — rendert Titel und Karte mit dem
 * vollständigen Datenschutztext.
 *
 * @returns JSX-Element der Datenschutzerklärung-Seite.
 */
const PrivacyPolicyPage = () => {
  return (
    <>
      <PageTitle title={TEXT_PRIVACY_POLICY} subTitle={TEXT_SMALL_PRINT} />

      <Container component="main" maxWidth="md">
        <Card sx={{mt: "2rem", mb: "3rem"}}>
          <CardHeader title={TEXT_PRIVACY_POLICY} />
          <CardContent>
            <PrivacyPolicyText />
          </CardContent>
        </Card>
      </Container>
    </>
  );
};

/**
 * Datenschutzerklärungs-Text — enthält alle 10 Abschnitte der
 * Datenschutzerklärung als nummerierte Liste.
 *
 * Wird auch im Footer als Standalone-Text verwendet.
 *
 * @returns JSX-Element mit dem vollständigen Datenschutztext.
 */
const PrivacyPolicyText = () => {
  return (
    <>
      <Typography>Stand: 21. März 2026</Typography>

      <Box component="ol" sx={customStyles.customOrderedList}>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Verantwortliche Stelle</strong>
          <br />
          Die Verantwortliche Stelle im Sinne der Datenschutzgesetze ist:
          <br />
          <br />
          Verein chuchipirat
          <br />
          <Link href="mailto:hallo@chuchipirat.ch">hallo@chuchipirat.ch</Link>
          <br />
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Datenschutzbeauftragte*r</strong>
          <br />
          Ein Datenschutzbeauftragter wurde nicht bestellt, da dies gesetzlich
          nicht erforderlich ist.
          <br />
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Erhebung und Verarbeitung von personenbezogenen Daten</strong>
          <Box component="ol" sx={customStyles.customOrderedList}>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Personenbezogene Daten umfassen alle Informationen, die sich auf
              eine identifizierte oder identifizierbare natürliche Person
              beziehen. Dazu gehören beispielsweise Name, Adresse,
              E-Mail-Adresse und Nutzerverhalten.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Die Nutzung der Webapp chuchipirat erfordert die Anmeldung über
              die E-Mail-Adresse. Hierbei werden personenbezogene Daten wie
              E-Mail-Adresse, Name und weitere erforderliche Informationen
              abgefragt. Die Angabe dieser Daten erfolgt auf freiwilliger Basis,
              jedoch ist für die Nutzung der Webapp eine Anmeldung erforderlich.
            </Box>
          </Box>
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>
            Datenübermittlung und -protokollierung für interne und statistische
            Zwecke
          </strong>
          <br />
          <Box component="ol" sx={customStyles.customOrderedList}>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Die Webapp chuchipirat erhebt und speichert automatisch
              Informationen in sogenannten Server-Log-Dateien, die dein Browser
              automatisch an uns übermittelt. Dies sind:
              <br />
              <br />
              <ul>
                <Box component="li">Browsertyp und Browserversion</Box>
                <Box component="li">verwendetes Betriebssystem</Box>
                <Box component="li">Referrer URL</Box>
                <Box component="li">Hostname des zugreifenden Rechners</Box>
                <Box component="li">Uhrzeit der Serveranfrage</Box>
                <Box component="li">IP-Adresse</Box>
              </ul>
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Diese Daten sind nicht bestimmten Personen zuordenbar. Eine
              Zusammenführung dieser Daten mit anderen Datenquellen wird nicht
              vorgenommen.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Diese Daten dienen ausschliesslich internen und statistischen
              Zwecken, um die Sicherheit und Stabilität der Webapp zu
              gewährleisten.
            </Box>
          </Box>
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Cookies</strong>
          <br />
          <Box component="ol" sx={customStyles.customOrderedList}>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Die Webapp chuchipirat verwendet Cookies. Cookies sind kleine
              Textdateien, die auf deinem Endgerät gespeichert werden. Sie
              richten keinen Schaden an und enthalten keine Viren.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Cookies dienen dazu, die Nutzung der Webapp benutzerfreundlicher,
              effektiver und sicherer zu machen. Einige Cookies sind
              «Session-Cookies», die nach Ende deiner Browser-Sitzung
              automatisch gelöscht werden. Andere Cookies bleiben auf deinem
              Endgerät gespeichert, bis du diese löschst.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Du kannst deinen Browser so einstellen, dass du über das Setzen
              von Cookies informiert wirst und Cookies nur im Einzelfall
              erlaubst, die Annahme von Cookies für bestimmte Fälle oder
              generell ausschliesst sowie das automatische Löschen der Cookies
              beim Schliessen des Browsers aktivierst. Bei der Deaktivierung von
              Cookies kann die Funktionalität der Webapp eingeschränkt sein.
            </Box>
          </Box>
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>SSL-Verschlüsselung</strong>
          <br />
          Die Webapp chuchipirat nutzt aus Gründen der Sicherheit und zum Schutz
          der Übertragung vertraulicher Inhalte eine SSL-Verschlüsselung. Damit
          sind Daten, die du über diese Website übermittelst, für Dritte nicht
          mitlesbar. Du erkennst eine verschlüsselte Verbindung an der
          «https://» Adresszeile deines Browsers.
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Nutzung von Umami Analytics</strong>
          <br />
          Die Webapp chuchipirat verwendet Umami, eine datenschutzfreundliche
          Webanalyse-Lösung. Umami wird auf eigenen Servern von Hetzner in der
          EU (Deutschland) betrieben. Es werden keine Cookies gesetzt und keine
          personenbezogenen Daten an Dritte übermittelt. Die erhobenen Daten
          dienen ausschliesslich der anonymen Nutzungsanalyse.
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Nutzung von Supabase</strong>
          <br />
          Die Webapp chuchipirat verwendet Supabase für Datenbanken und
          Authentifizierung. Die Daten werden auf Servern von Hetzner in der EU
          (Deutschland) gespeichert. Weitere Informationen findest du in der{" "}
          <Link href="https://supabase.com/privacy" target="_blank">
            Datenschutzerklärung von Supabase
          </Link>
          .
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Rechte der betroffenen Person</strong>
          <br />
          <Box component="ol" sx={customStyles.customOrderedList}>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Als Nutzer*in der Webapp chuchipirat hast du das Recht, auf Antrag
              unentgeltlich Auskunft über die personenbezogenen Daten zu
              erhalten, die über dich gespeichert wurden.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Darüber hinaus hast du das Recht auf Berichtigung unrichtiger
              Daten, Sperrung und Löschung deiner personenbezogenen Daten,
              soweit dem keine gesetzliche Aufbewahrungspflicht entgegensteht.
            </Box>
            <Box
              component="li"
              sx={[customStyles.listItem, customStyles.subListItem]}
            >
              Für Anfragen zur Auskunft, Berichtigung, Sperrung oder Löschung
              von personenbezogenen Daten sowie für weitergehende Fragen zum
              Datenschutz kannst du dich an{" "}
              <Link href="mailto:hallo@chuchipirat.ch">
                hallo@chuchipirat.ch
              </Link>{" "}
              wenden.
            </Box>
          </Box>
        </Box>
        <Box component="li" sx={customStyles.listItem}>
          <strong>Änderungen dieser Datenschutzerklärung</strong>
          <br />
          Diese Datenschutzerklärung kann sich aufgrund gesetzlicher Neuerungen
          oder Änderungen der Webapp chuchipirat ändern. Die jeweils aktuelle
          Datenschutzerklärung findest du jederzeit auf&nbsp;
          <Link component={RouterLink} to={ROUTE_PRIVACY_POLICY}>
            chuchipirat.ch/privacypolicy
          </Link>
          .
        </Box>
      </Box>
    </>
  );
};

export {PrivacyPolicyPage, PrivacyPolicyText};
