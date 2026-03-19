import React from "react";

import Typography from "@mui/material/Typography";
import Link from "@mui/material/Link";
import LinearProgress from "@mui/material/LinearProgress";

import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";

import {
  JOBS as TEXT_JOBS,
  // TEMP_JOBS as TEXT_TEMP_JOBS,
} from "../../constants/text";

import {rebuildFile000AllRecipes} from "../../jobs/rebuildFile000AllRecipes";
import {rebuildFile000AllUsers} from "../../jobs/rebuildFile000AllUsers";
import {rebuildFile000AllEvents} from "../../jobs/rebuildFile000AllEvents";
import {rebuildFile000AllFeeds} from "../../jobs/rebuildFile000AllFeeds";

import PageTitle from "../Shared/pageTitle";
import AlertMessage from "../Shared/AlertMessage";

import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import Role from "../../constants/roles";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {useAuthUser} from "../Session/authUserContext";
import Stats from "../Shared/stats.class";
import {Container, Stack} from "@mui/material";
import useCustomStyles from "../../constants/styles";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
interface DocumentCounter {
  restructeredRecipes: number;
  privateRecipes: number;
  allRecipes: number;
  allUsers: number;
  allEvents: number;
  statsCounter: number;
  allFeeds: number;
  publicUserProfile: number;
  restructeredEvents: number;
  restructureProducts: number;
  fixEvents: number;
}

interface JobMonitor {
  restructeredRecipes: boolean;
  privateRecipes: boolean;
  allRecipes: boolean;
  allUsers: boolean;
  allEvents: boolean;
  allFeeds: boolean;
  statsCounter: boolean;
  publicUserProfile: boolean;
  restructeredEvents: boolean;
  restructureProducts: boolean;
  fixEvent: boolean;
}
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const ExecuteJobPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  // const {customDialog} = useCustomDialog();

  const [documentCounter, setDocumentCounter] = React.useState<DocumentCounter>(
    {
      restructeredRecipes: 0,
      privateRecipes: 0,
      allRecipes: 0,
      allUsers: 0,
      allEvents: 0,
      allFeeds: 0,
      statsCounter: 0,
      publicUserProfile: 0,
      restructeredEvents: 0,
      restructureProducts: 0,
      fixEvents: 0,
    }
  );

  const [jobMonitor, setJobMonitor] = React.useState<JobMonitor>({
    restructeredRecipes: false,
    privateRecipes: false,
    allRecipes: false,
    allUsers: false,
    allEvents: false,
    allFeeds: false,
    statsCounter: false,
    publicUserProfile: false,
    restructeredEvents: false,
    restructureProducts: false,
    fixEvent: false,
  });

  if (!authUser) {
    return <React.Fragment></React.Fragment>;
  }

  const onRebuildFile000AllRecipes = async () => {
    await rebuildFile000AllRecipes(firebase).then((result) => {
      setDocumentCounter({...documentCounter, allRecipes: result});
    });
  };

  const onRebuildFile000AllUsers = async () => {
    await rebuildFile000AllUsers(firebase, database).then((result) => {
      setDocumentCounter({...documentCounter, allUsers: result});
    });
  };

  const onRebuildFile000AllEvents = async () => {
    await rebuildFile000AllEvents(firebase, authUser).then((result) => {
      setDocumentCounter({...documentCounter, allEvents: result});
    });
  };
  const onRebuildFile000AllFeeds = async () => {
    await rebuildFile000AllFeeds().then((result) => {
      setDocumentCounter({...documentCounter, allFeeds: result});
    });
  };
  const onRebuildStatsCounter = async () => {
    setJobMonitor({...jobMonitor, statsCounter: true});
    Stats.rebuildStats({
      firebase: firebase,
      authUser: authUser,
      callback: (document) => {
        setDocumentCounter({
          ...documentCounter,
          statsCounter: document.processedDocuments,
        });
        setJobMonitor({...jobMonitor, statsCounter: false});
      },
    }).catch((error) => console.error(error));
  };
  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_JOBS} />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Stack spacing={2}>
          <PanelJobList
            onRebuild000AllRecipes={onRebuildFile000AllRecipes}
            onRebuild000AllUsers={onRebuildFile000AllUsers}
            onRebuild000AllEvents={onRebuildFile000AllEvents}
            onRebuild000AllFeeds={onRebuildFile000AllFeeds}
            onRebuildStatsCounter={onRebuildStatsCounter}
            documentCounter={documentCounter}
            jobMonitor={jobMonitor}
          />
        </Stack>
      </Container>
    </React.Fragment>
  );
};
/* ===================================================================
// ========================== Liste aller Jobs =======================
// =================================================================== */
interface JobListProps {
  onRebuild000AllRecipes: () => void;
  onRebuild000AllUsers: () => void;
  onRebuild000AllEvents: () => void;
  onRebuild000AllFeeds: () => void;
  onRebuildStatsCounter: () => void;
  documentCounter: DocumentCounter;
  jobMonitor: JobMonitor;
}

const PanelJobList = ({
  onRebuild000AllRecipes,
  onRebuild000AllUsers,
  onRebuild000AllEvents,
  onRebuild000AllFeeds,
  onRebuildStatsCounter,
  documentCounter,
  jobMonitor,
}: JobListProps) => {
  const classes = useCustomStyles();
  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_JOBS}
        </Typography>
        <JobEntry
          onClick={onRebuild000AllRecipes}
          jobName={"000_allRecipe neu aufbauen"}
          jobDescription={"Dokument 000_allRecipes neu aufbauen."}
          jobIsRunning={jobMonitor.allRecipes}
          changedRecords={documentCounter.allRecipes}
          successMessage={`Dokument 000_allRecipes mit ${documentCounter.allRecipes} Rezepten neu aufgebaut.`}
        />
        <br />
        <JobEntry
          onClick={onRebuild000AllUsers}
          jobName={"000_allUsers neu aufbauen"}
          jobDescription={"Dokument 000_allUsers neu aufbauen."}
          jobIsRunning={jobMonitor.allUsers}
          changedRecords={documentCounter.allUsers}
          successMessage={`Dokument 000_alUsers mit ${documentCounter.allUsers} Users neu aufgebaut.`}
        />
        <br />
        <JobEntry
          onClick={onRebuild000AllEvents}
          jobName={"000_allEvents neu aufbauen"}
          jobDescription={"Dokument 000_allEvents neu aufbauen."}
          jobIsRunning={jobMonitor.allEvents}
          changedRecords={documentCounter.allEvents}
          successMessage={`Dokument 000_alEvents mit ${documentCounter.allEvents} Events neu aufgebaut.`}
        />
        <br />
        <JobEntry
          onClick={onRebuild000AllFeeds}
          jobName={"000_allFeeds neu aufbauen"}
          jobDescription={"Dokument 000_allFeeds neu aufbauen."}
          jobIsRunning={jobMonitor.allFeeds}
          changedRecords={documentCounter.allFeeds}
          successMessage={`Dokument 000_alFeeds mit ${documentCounter.allFeeds} Feeds neu aufgebaut.`}
        />
        <br />
        <JobEntry
          onClick={onRebuildStatsCounter}
          jobName={"Stats-Counter neu aufbauen"}
          jobDescription={"Dokument stats/counter und Statistik neu berechnen."}
          jobIsRunning={jobMonitor.statsCounter}
          changedRecords={documentCounter.statsCounter}
          successMessage={`Dokument stats/counter mit ${documentCounter.statsCounter} gelesenen Dokumenten neu aufgebaut.`}
        />
      </CardContent>
    </Card>
  );
};
/* ===================================================================
// ======================== Eintrag in Job Liste =====================
// =================================================================== */
interface JobEntryProps {
  onClick: () => void;
  jobName: string;
  jobDescription: string;
  jobIsRunning: boolean;
  changedRecords: number;
  successMessage: string;
}
const JobEntry = ({
  onClick,
  jobName,
  jobDescription,
  jobIsRunning,
  changedRecords,
  successMessage,
}: JobEntryProps) => {
  return (
    <React.Fragment>
      <Link onClick={onClick} variant="body1">
        {jobName}
      </Link>
      <Typography>{jobDescription}</Typography>
      {jobIsRunning && <LinearProgress />}
      {changedRecords > 0 && (
        <AlertMessage severity="success" body={successMessage}></AlertMessage>
      )}
    </React.Fragment>
  );
};

export default ExecuteJobPage;
