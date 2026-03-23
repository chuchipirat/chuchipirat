import React from "react";
import {useNavigate} from "react-router";

import Typography from "@mui/material/Typography";
import {Breadcrumbs, Link} from "@mui/material";
import {useCustomStyles} from "../../constants/styles";
import {Box} from "@mui/material";

/**
 * Breadcrumb-Eintrag für die Seitennavigation.
 *
 * @param label Angezeigter Text.
 * @param route Ziel-Route bei Klick.
 */
export type BreadcrumbEntry = {
  label: string;
  route: string;
};

/**
 * Daten für das Ribbon-Banner (z.B. Test-Umgebung).
 *
 * @param text Anzuzeigter Text im Ribbon.
 * @param class CSS-Klasse für das Ribbon-Styling.
 */
type RibbonData = {
  text: string;
  class: string;
};

/**
 * Eigenschaften der PageTitle-Komponente.
 *
 * @param title Grosser Seitentitel.
 * @param smallTitle Kleiner Seitentitel.
 * @param subTitle Untertitel.
 * @param windowTitle Fenstertitel (Browser-Tab).
 * @param ribbon Ribbon-Daten (z.B. Test-Banner).
 * @param breadcrumbs Breadcrumb-Pfad (ohne aktuelle Seite).
 */
interface PageTitleProps {
  title?: string;
  smallTitle?: string;
  subTitle?: string;
  windowTitle?: string;
  ribbon?: RibbonData;
  breadcrumbs?: BreadcrumbEntry[];
}

/**
 * Standard-Seitentitel mit optionalen Breadcrumbs, Untertitel und Ribbon.
 * Setzt auch den Browser-Tab-Titel via `document.title`.
 *
 * @param title Grosser Seitentitel.
 * @param smallTitle Kleiner Seitentitel.
 * @param subTitle Untertitel.
 * @param windowTitle Fenstertitel (Browser-Tab).
 * @param ribbon Ribbon-Daten (z.B. Test-Banner).
 * @param breadcrumbs Breadcrumb-Pfad.
 */
const PageTitle = ({
  title,
  smallTitle,
  subTitle,
  windowTitle,
  ribbon,
  breadcrumbs,
}: PageTitleProps) => {
  const classes = useCustomStyles();

  // Fenstertitel als Side-Effect in useEffect setzen
  React.useEffect(() => {
    window.document.title = windowTitle
      ? windowTitle
      : title
        ? title
        : smallTitle
          ? smallTitle
          : "";
  }, [windowTitle, title, smallTitle]);

  return (
    <React.Fragment>
      {ribbon && <Ribbon text={ribbon.text} cssProperty={ribbon.class} />}
      <Box component="div" sx={classes.heroContent}>
        {breadcrumbs && breadcrumbs.length > 0 && (
          <BreadcrumbBar
            breadcrumbs={breadcrumbs}
            currentPage={title || smallTitle || ""}
          />
        )}
        {title && (
          <Typography
            component="h1"
            variant="h2"
            align="center"
            color="textPrimary"
          >
            {title}
          </Typography>
        )}
        {smallTitle && (
          <Typography
            component="h1"
            variant="h5"
            align="center"
            color="textPrimary"
            gutterBottom
          >
            {smallTitle}
          </Typography>
        )}
        {subTitle && (
          <Typography
            component="h2"
            variant="h5"
            align="center"
            color="textSecondary"
            gutterBottom
          >
            {subTitle}
          </Typography>
        )}
      </Box>
    </React.Fragment>
  );
};

/* ===================================================================
// ========================== Breadcrumb-Bar =========================
// =================================================================== */

/**
 * Breadcrumb-Navigation — nur gerendert wenn Breadcrumbs vorhanden.
 * Eigene Komponente, damit `useNavigate` nur aufgerufen wird wenn
 * tatsächlich ein Router-Kontext existiert.
 */
const BreadcrumbBar = ({
  breadcrumbs,
  currentPage,
}: {
  breadcrumbs: BreadcrumbEntry[];
  currentPage: string;
}) => {
  const navigate = useNavigate();

  return (
    <Breadcrumbs
      aria-label="Breadcrumb"
      sx={{justifyContent: "center", display: "flex", mb: 1}}
    >
      {breadcrumbs.map((crumb) => (
        <Link
          key={crumb.route}
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate(crumb.route)}
          sx={{cursor: "pointer"}}
        >
          {crumb.label}
        </Link>
      ))}
      <Typography color="text.primary">{currentPage}</Typography>
    </Breadcrumbs>
  );
};

/* ===================================================================
// ============================== Ribbon =============================
// =================================================================== */
interface RibbonProps {
  text: string;
  cssProperty: string;
}
export const Ribbon = ({text, cssProperty}: RibbonProps) => {
  return <div className={cssProperty}>{text}</div>;
};
export {PageTitle};
