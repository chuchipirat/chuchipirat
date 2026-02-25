import React from "react";
import {pdf} from "@react-pdf/renderer";
import fileSaver from "file-saver";

import useCustomStyles from "../../constants/styles";
import {
  Container,
  Card,
  CardContent,
  Backdrop,
  CircularProgress,
  useTheme,
  Typography,
  IconButton,
  Menu,
  MenuItem,
  ListItemIcon,
  DialogTitle,
  Dialog,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Stack,
} from "@mui/material";

import {
  OpenInNew as OpenInNewIcon,
  MoreVert as MoreVertIcon,
  Receipt as ReceiptIcon,
} from "@mui/icons-material";

import PageTitle from "../Shared/pageTitle";

import Role from "../../constants/roles";

import {useFirebase} from "../Firebase/firebaseContext";
import {useDatabase} from "../Database/DatabaseContext";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {ChangeRecord} from "../Shared/global.interface";
import {useAuthUser} from "../Session/authUserContext";
import EventShort from "../Event/Event/eventShort.class";
import {EVENT as ROUTE_EVENT} from "../../constants/routes";
import {
  EVENT as TEXT_EVENT,
  EVENTS as TEXT_EVENTS,
  OVERVIEW_EVENTS_DESCRIPTION as TEXT_OVERVIEW_EVENTS_DESCRIPTION,
  ALERT_TITLE_WAIT_A_MINUTE as TEXT_ALERT_TITLE_WAIT_A_MINUTE,
  OPEN as TEXT_OPEN,
  CANCEL as TEXT_CANCEL,
  UID as TEXT_UID,
  NAME as TEXT_NAME,
  MOTTO as TEXT_MOTTO,
  LOCATION as TEXT_LOCATION,
  NO_OF_DAYS as TEXT_NO_OF_DAYS,
  NO_OF_COOKS as TEXT_NO_OF_COOKS,
  START_DATE as TEXT_START_DATE,
  END_DATE as TEXT_END_DATE,
  CREATED_AT as TEXT_CREATED_AT,
  CREATED_FROM as TEXT_CREATED_FROM,
  CREATE_RECEIPT as TEXT_CREATE_RECEIPT,
  CREATE as TEXT_CREATE,
  PAY_DATE as TEXT_PAY_DATE,
  DONOR as TEXT_DONOR,
  EMAIL as TEXT_EMAIL,
  AMOUNT as TEXT_AMOUNT,
  SUFFIX_PDF as TEXT_SUFFIX_PDF,
  FROM as TEXT_FROM,
} from "../../constants/text";
import AlertMessage from "../Shared/AlertMessage";
import SearchPanel from "../Shared/searchPanel";
import {
  DataGrid,
  GridColDef,
  GridToolbar,
} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";
import DialogEventQuickView from "../Event/Event/dialogEventQuickView";
import {useNavigate} from "react-router";
import Action from "../../constants/actions";
import User from "../User/user.class";

import EventReceiptPdf from "../Event/Event/eventRecipePdf";
import Receipt from "../Event/Event/receipt.class";
import Utils from "../Shared/utils.class";
import {SortOrder} from "../Firebase/Db/firebase.db.super.class";
import {DatePicker} from "@mui/x-date-pickers";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
enum ReducerActions {
  EVENTS_FETCH_INIT,
  EVENTS_FETCH_SUCCESS,
  FILTER_EVENTS_LIST,
  SHOW_LOADING,
  GENERIC_ERROR,
}

interface EventOverview {
  name: EventShort["name"];
  uid: EventShort["uid"];
  location: EventShort["location"];
  motto: EventShort["motto"];
  noOfCooks: EventShort["noOfCooks"];
  startDate: EventShort["startDate"];
  endDate: EventShort["endDate"];
  numberOfDays: EventShort["numberOfDays"];
  pictureSrc: EventShort["pictureSrc"];
  create_date: ChangeRecord["date"];
  create_fromUid: ChangeRecord["fromUid"];
  create_fromDisplayName: ChangeRecord["fromDisplayName"];
}

type DispatchAction = {
  type: ReducerActions;
  payload: {[key: string]: any};
};

type State = {
  events: EventShort[];
  filteredData: EventOverview[];
  isLoading: boolean;
  error: Error | null;
};

const inititialState: State = {
  events: [],
  filteredData: [],
  isLoading: false,
  error: null,
};

interface DialogQuickViewState {
  dialogOpen: boolean;
  selectedEvent: EventShort;
}

const DIALOG_QUICK_VIEW_INITIAL_STATE: DialogQuickViewState = {
  dialogOpen: false,
  selectedEvent: new EventShort(),
};
interface DialogCreateReceiptState {
  dialogOpen: boolean;
  eventUid: EventShort["uid"];
  eventName: EventShort["name"];
  payDate: Date;
  amount: number;
  donorName: string;
  donorEmail: string;
}
const DIALOG_CREATE_RECEIPT_INITIAL_STATE: DialogCreateReceiptState = {
  dialogOpen: false,
  eventUid: "",
  eventName: "",
  payDate: new Date(),
  amount: 0,
  donorName: "",
  donorEmail: "",
};

const moveDataToUiStructure = (events: EventShort[]): EventOverview[] => {
  const result: EventOverview[] = [];
  events.forEach((event) => {
    result.push({
      name: event.name,
      uid: event.uid,
      location: event.location,
      motto: event.motto,
      noOfCooks: event.noOfCooks,
      startDate: event.startDate,
      endDate: event.endDate,
      numberOfDays: event.numberOfDays,
      pictureSrc: event.pictureSrc,
      create_date: event.created?.date,
      create_fromUid: event.created?.fromUid,
      create_fromDisplayName: event.created?.fromDisplayName,
    });
  });
  return result;
};

const eventsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.EVENTS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.EVENTS_FETCH_SUCCESS:
      return {
        ...state,
        events: action.payload as EventShort[],
        filteredData: moveDataToUiStructure(action.payload as EventShort[]),
        isLoading: false,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isLoading: false,
        error: action.payload as Error,
      };
    case ReducerActions.FILTER_EVENTS_LIST: {
      let tmpList: EventOverview[] = moveDataToUiStructure(state.events);

      if (action.payload.searchString) {
        const searchString = action.payload.searchString.toLowerCase();
        tmpList = tmpList.filter(
          (event) =>
            event.uid.toLocaleLowerCase().includes(searchString) ||
            event.name.toLowerCase().includes(searchString) ||
            event.motto.toLowerCase().includes(searchString) ||
            event.location.toLowerCase().includes(searchString) ||
            event.create_fromDisplayName.toLowerCase().includes(searchString) ||
            event.create_fromUid.toLowerCase().includes(searchString)
        );
      }
      return {
        ...state,
        filteredData: tmpList,
      };
    }
    case ReducerActions.SHOW_LOADING:
      return {...state, isLoading: action.payload.value};
    default:
      console.error("Unbekannter ActionType: ", action.type);
      throw new Error();
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const OverviewEventsPage = () => {
  const firebase = useFirebase();
  const database = useDatabase();
  const authUser = useAuthUser();
  const [state, dispatch] = React.useReducer(eventsReducer, inititialState);
  const [dialogQuickView, setDialogQuickView] =
    React.useState<DialogQuickViewState>(DIALOG_QUICK_VIEW_INITIAL_STATE);
  const [dialogCreateReceipt, setDialogCreateReceipt] = React.useState(
    DIALOG_CREATE_RECEIPT_INITIAL_STATE
  );
  const classes = useCustomStyles();
  const navigate = useNavigate();

  /* ------------------------------------------
	// Daten aus DB holen
	// ------------------------------------------ */
  React.useEffect(() => {
    if (state.events.length === 0) {
      dispatch({
        type: ReducerActions.EVENTS_FETCH_INIT,
        payload: {},
      });
      EventShort.getShortEvents({firebase: firebase})
        .then((result) => {
          result = Utils.sortArray({
            array: result,
            attributeName: "startDate",
            sortOrder: SortOrder.desc,
          });

          dispatch({
            type: ReducerActions.EVENTS_FETCH_SUCCESS,
            payload: result,
          });
        })
        .catch((error) => {
          dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
        });
    }
  }, []);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Quick-View Dialog öffnen
  // ------------------------------------------ */
  const onEventOpen = (uid: EventShort["uid"]) => {
    setDialogQuickView({
      dialogOpen: true,
      selectedEvent: state.events.find((event) => event.uid === uid)!,
    });
  };
  const onQuickViewClose = () => {
    setDialogQuickView(DIALOG_QUICK_VIEW_INITIAL_STATE);
  };
  const onQuickDialogOpenEvent = (
    actionEvent: React.MouseEvent<HTMLButtonElement, MouseEvent> | undefined,
    event: EventShort
  ) => {
    navigate(`${ROUTE_EVENT}/${event.uid}`, {
      state: {
        action: Action.VIEW,
        event: event,
      }
    });
  };
  /* ------------------------------------------
  // Quittung erstellen
  // ------------------------------------------ */
  const onCreateReceipt = async (eventUid: EventShort["uid"]) => {
    const event = state.events.find((event) => event.uid === eventUid);
    if (!event) {
      return;
    }
    dispatch({type: ReducerActions.SHOW_LOADING, payload: {value: true}});

    await User.getFullProfile({firebase, database, uid: event.created.fromUid})
      .then((result) => {
        setDialogCreateReceipt({
          dialogOpen: true,
          amount: 0,
          eventUid: eventUid,
          eventName: event.name,
          payDate: event.created.date,
          donorEmail: result.email,
          donorName: result.firstName
            ? `${result.firstName} ${result.lastName}`
            : result.displayName,
        });
        dispatch({type: ReducerActions.SHOW_LOADING, payload: {value: false}});
      })
      .catch((error) => {
        console.error(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  };
  const onCreateReceiptClose = () => {
    setDialogCreateReceipt(DIALOG_CREATE_RECEIPT_INITIAL_STATE);
  };
  const generateReceipt = async (dialogValues: DialogCreateReceiptState) => {
    setDialogCreateReceipt(DIALOG_CREATE_RECEIPT_INITIAL_STATE);

    const receiptData = new Receipt();

    Object.entries(dialogValues).forEach(([key, value]) => {
      if (Object.prototype.hasOwnProperty.call(receiptData, key)) {
        receiptData[key] = value;
      }
    });

    receiptData.created = {
      fromDisplayName: authUser.publicProfile.displayName,
      date: new Date(),
      fromUid: authUser.uid,
    };

    pdf(<EventReceiptPdf receiptData={receiptData} authUser={authUser} />)
      .toBlob()
      .then((result) => {
        fileSaver.saveAs(
          result,
          dialogValues.eventName + TEXT_CREATE_RECEIPT + TEXT_SUFFIX_PDF
        );
      })
      .catch((error) => {
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });

    Receipt.save({
      firebase: firebase,
      receipt: receiptData,
      authUser: authUser,
    }).catch((error) => {
      console.error(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
    });
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_EVENTS}
        subTitle={TEXT_OVERVIEW_EVENTS_DESCRIPTION}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        <Stack>
          {state.error && (
            <AlertMessage
              error={state.error!}
              messageTitle={TEXT_ALERT_TITLE_WAIT_A_MINUTE}
            />
          )}

          <EventsPanel
            events={state.events}
            filteredData={state.filteredData}
            onEventOpen={onEventOpen}
            onCreateReceipt={onCreateReceipt}
            dispatch={dispatch}
          />
        </Stack>{" "}
      </Container>
      <DialogEventQuickView
        firebase={firebase}
        eventShort={dialogQuickView.selectedEvent}
        dialogOpen={dialogQuickView.dialogOpen}
        handleClose={onQuickViewClose}
        dialogActions={[
          {
            key: "close",
            name: TEXT_CANCEL,
            variant: "text",
            onClick: onQuickViewClose,
          },
          {
            key: "open",
            name: `${TEXT_EVENT} ${TEXT_OPEN}`,
            variant: "outlined",
            onClick: onQuickDialogOpenEvent,
          },
        ]}
      />

      <DialogCreateReceipt
        dialogData={dialogCreateReceipt}
        handleClose={onCreateReceiptClose}
        handleOk={generateReceipt}
      />
    </React.Fragment>
  );
};
/* ===================================================================
// =========================== Event Panel ===========================
// =================================================================== */
interface EventsPanelProps {
  events: EventShort[];
  filteredData: EventOverview[];
  onEventOpen: (eventUid: EventShort["uid"]) => void;
  onCreateReceipt: (eventUid: EventShort["uid"]) => void;
  dispatch: (value: DispatchAction) => void;
}

const EventsPanel = ({
  events,
  filteredData,
  onEventOpen,
  onCreateReceipt,
  dispatch,
}: EventsPanelProps) => {
  const theme = useTheme();
  const classes = useCustomStyles();
  const [searchString, setSearchString] = React.useState<string>("");
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    React.useState<HTMLElement | null>(null);
  const [contextMenuSelectedItem, setContextMenuSelectedItem] =
    React.useState("");

  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuSelectedItem("");
  };
  const createReceipt = () => {
    onCreateReceipt(contextMenuSelectedItem);
    setContextMenuAnchorElement(null);
    setContextMenuSelectedItem("");
  };

  /* ------------------------------------------
  // Search String Handling
  // ------------------------------------------ */
  const onUpdateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => {
    setSearchString(event.target.value);

    dispatch({
      type: ReducerActions.FILTER_EVENTS_LIST,
      payload: {
        searchString: event.target.value,
      },
    });
  };
  const onClearSearchString = () => {
    setSearchString("");
    dispatch({
      type: ReducerActions.FILTER_EVENTS_LIST,
      payload: {searchString: ""},
    });
  };

  /* ------------------------------------------
  // Spalten Definition
  // ------------------------------------------ */
  const DATA_GRID_COLUMNS: GridColDef[] = [
    {
      field: "open",
      headerName: TEXT_OPEN,
      sortable: false,
      renderCell: (params) => {
        const onClick = () => {
          onEventOpen(params.id as string);
        };

        return (
          <IconButton
            aria-label="open User"
            style={{margin: theme.spacing(1)}}
            size="small"
            onClick={onClick}
          >
            <OpenInNewIcon fontSize="inherit" />
          </IconButton>
        );
      },
    },
    {
      field: "uid",
      headerName: TEXT_UID,
      editable: false,
      cellClassName: () => `super-app ${classes.typographyCode}`,
      width: 200,
    },
    {
      field: "name",
      headerName: TEXT_NAME,
      editable: false,
      width: 200,
    },
    {
      field: "location",
      headerName: TEXT_LOCATION,
      editable: false,
      width: 200,
    },
    {
      field: "motto",
      headerName: TEXT_MOTTO,
      editable: false,
      hide: true,
      width: 200,
    },
    {
      field: "noOfCooks",
      headerName: TEXT_NO_OF_COOKS,
      editable: false,
      type: "number",
      width: 100,
    },
    {
      field: "startDate",
      headerName: TEXT_START_DATE,
      editable: false,
      width: 150,
      valueGetter: (value) => {
        return value instanceof Date
          ? value.toLocaleString("de-CH", {
              dateStyle: "medium",
            })
          : "";
      },
    },
    {
      field: "endDate",
      headerName: TEXT_END_DATE,
      editable: false,
      width: 150,
      valueGetter: (value) => {
        return value instanceof Date
          ? value.toLocaleString("de-CH", {
              dateStyle: "medium",
            })
          : "";
      },
    },
    {
      field: "numberOfDays",
      headerName: TEXT_NO_OF_DAYS,
      editable: false,
      type: "number",
      width: 100,
    },
    {
      field: "create_date",
      headerName: TEXT_CREATED_AT,
      editable: false,
      valueGetter: (value) => {
        return value instanceof Date
          ? value.toLocaleString("de-CH", {
              dateStyle: "medium",
            })
          : "";
      },
      width: 100,
    },
    {
      field: "create_fromUid",
      headerName: `${TEXT_CREATED_FROM} ${TEXT_UID}`,
      editable: false,
      cellClassName: () => `super-app ${classes.typographyCode}`,
      valueGetter: (value) => {
        return value;
      },
      width: 200,
    },
    {
      field: "create_fromDisplayName",
      headerName: TEXT_CREATED_FROM,
      editable: false,
      valueGetter: (value) => {
        return value;
      },
      width: 200,
    },
    {
      field: "menu",
      headerName: "",
      editable: false,
      sortable: false,
      renderCell: (params) => {
        const onClick = (event: React.MouseEvent<HTMLElement>) => {
          setContextMenuSelectedItem(params.id as string);
          setContextMenuAnchorElement(event.currentTarget);
        };

        return (
          <IconButton
            aria-label="open User"
            style={{margin: theme.spacing(1)}}
            size="small"
            onClick={onClick}
          >
            <MoreVertIcon fontSize="inherit" />
          </IconButton>
        );
      },
      width: 50,
    },
  ];

  return (
    <React.Fragment>
      <Card sx={classes.card} key={"cardProductsPanel"}>
        <CardContent sx={classes.cardContent} key={"cardPrdocutContent"}>
          <Stack>
            <SearchPanel
              searchString={searchString}
              onUpdateSearchString={onUpdateSearchString}
              onClearSearchString={onClearSearchString}
            />
            <Typography
              variant="body2"
              style={{marginTop: "0.5em", marginBottom: "2em"}}
            >
              {events.length == filteredData.length
                ? `${events.length} ${TEXT_EVENTS}`
                : `${filteredData.length} ${TEXT_FROM.toLowerCase()} ${
                    events.length
                  } ${TEXT_EVENTS}`}
            </Typography>
            <Box component="div" style={{display: "flex", height: "100%"}}>
              <Box component="div" style={{flexGrow: 1}}>
                <DataGrid
                  autoHeight
                  rows={filteredData}
                  columns={DATA_GRID_COLUMNS}
                  getRowId={(row) => row.uid}
                  localeText={
                    deDE.components.MuiDataGrid.defaultProps.localeText
                  }
                  getRowClassName={(params) => {
                    if (params.row?.disabled) {
                      return `super-app ${classes.dataGridDisabled}`;
                    } else {
                      return `super-app-theme`;
                    }
                  }}
                  components={{
                    Toolbar: GridToolbar,
                  }}
                />
              </Box>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={createReceipt}>
          <ListItemIcon>
            <ReceiptIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_CREATE_RECEIPT}
          </Typography>
        </MenuItem>
      </Menu>
    </React.Fragment>
  );
};
/* ===================================================================
// ==================== Dialog Rezept erstellen ======================
// =================================================================== */

interface DialogCreateReceiptProps {
  dialogData: DialogCreateReceiptState;
  handleClose: () => void;
  handleOk: (dialogValues: DialogCreateReceiptState) => void;
}
const DialogCreateReceipt = ({
  dialogData,
  handleClose,
  handleOk: handleOkSuper,
}: DialogCreateReceiptProps) => {
  const classes = useCustomStyles();
  const [dialogValues, setDialogValues] = React.useState(
    DIALOG_CREATE_RECEIPT_INITIAL_STATE
  );
  /* ------------------------------------------
  // Initialisieren
  // ------------------------------------------ */
  if (
    dialogValues == DIALOG_CREATE_RECEIPT_INITIAL_STATE &&
    dialogData != DIALOG_CREATE_RECEIPT_INITIAL_STATE
  ) {
    setDialogValues(dialogData);
  }
  /* ------------------------------------------
  // Felder-Update
  // ------------------------------------------ */
  const onFieldChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    let value: string | Date | number;
    if (event.target.id === "amount") {
      value = parseFloat(event.target.value);
    } else {
      value = event.target.value;
    }

    setDialogValues({...dialogValues, [event.target.id]: value});
  };
  const handlOk = () => {
    handleOkSuper(dialogValues);
    setDialogValues(DIALOG_CREATE_RECEIPT_INITIAL_STATE);
  };

  return (
    <Dialog
      open={dialogData.dialogOpen}
      onClose={handleClose}
      aria-labelledby="dialog Quittung für Event erstellen"
      fullWidth={true}
      maxWidth="sm"
    >
      <DialogTitle>{TEXT_CREATE_RECEIPT}</DialogTitle>
      <DialogContent>
        <Stack spacing={2}>
          <TextField
            id="eventUid"
            fullWidth
            label={TEXT_UID}
            value={dialogValues.eventUid}
            disabled={true}
            sx={classes.typographyCode}
          />
          <TextField
            id="eventName"
            fullWidth
            value={dialogValues.eventName}
            label={TEXT_EVENT}
            onChange={onFieldChange}
          />
          <DatePicker
            key={"payDate"}
            label={TEXT_PAY_DATE}
            format="dd.MM.yyyy"
            value={dialogValues.payDate}
            onChange={(date) => {
              setDialogValues({...dialogValues, payDate: date as Date});
            }}
          />
          <TextField
            id="donorName"
            fullWidth
            value={dialogValues.donorName}
            label={TEXT_DONOR}
            onChange={onFieldChange}
          />
          <TextField
            id="donorEmail"
            fullWidth
            value={dialogValues.donorEmail}
            label={`${TEXT_DONOR} ${TEXT_EMAIL}`}
            onChange={onFieldChange}
          />
          <TextField
            id="amount"
            fullWidth
            value={dialogValues.amount}
            label={TEXT_AMOUNT}
            onChange={onFieldChange}
            inputProps={{
              inputMode: "numeric",
              pattern: "[0-9]*",
            }}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button color="primary" onClick={handleClose}>
          {TEXT_CANCEL}
        </Button>
        <Button variant="outlined" color="primary" onClick={handlOk}>
          {TEXT_CREATE}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default OverviewEventsPage;
