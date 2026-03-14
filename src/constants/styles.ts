// import {makeStyles} from "@mui/material/styles";
import {alpha} from "@mui/system/colorManipulator";
import {useTheme} from "@mui/material/styles";
import Utils from "../components/Shared/utils.class";

const useCustomStyles = () => {
  const theme = useTheme();

  return {
    root: {
      display: "flex",
      justifyContent: "center",
      flexWrap: "wrap",
      listStyle: "none",
      padding: theme.spacing(1),
      // margin: 1,
    },
    /* ------------------------------------------
    // Global Steuerung
    // ------------------------------------------ */
    centerCenter: {
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    },
    centerRight: {
      display: "flex",
      // alignItems: "center",
      justifyContent: "flex-end",
    },
    topCenter: {
      display: "flex",
      alignItems: "top",
      justifyContent: "center",
    },

    marginCenter: {
      margin: "auto",
      marginLeft: "auto",
      marginRight: "auto",
    },
    backgroundGrey: {
      backgroundColor: theme.palette.action.hover,
    },
    // EX: listItemTextAlignRight
    textAlignRight: {
      textAlign: "right",
    },
    /* ------------------------------------------
    // Global Components
    // ------------------------------------------ */
    container: {
      padding: theme.spacing(3, 1, 6, 1),
      backgroundColor: theme.palette.background.default,
      width: "auto",
    },
    card: {
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
    },
    cardMedia: {
      height: 0,
      paddingTop: "56.25%", // 16:9
    },
    cardContent: {
      flexGrow: 1,
    },
    cardActions: {
      marginTop: "auto",
    },
    cardMenu: {
      backgroundColor: "none",
      display: "flex",
      flexDirection: "column",
    },
    cardDate: {
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      minWidth: "200px",
      width: "100%",
    },
    mediumDivider: {
      height: "1px",
      borderColor: theme.palette.primary.main,
    },
    thickDivider: {
      height: "2px",
      borderColor: theme.palette.primary.main,
    },
    backdrop: {
      zIndex: theme.zIndex.drawer + 1,
      color: "#fff",
    },
    button: {
      margin: theme.spacing(1),
    },
    heroButton: {
      margin: theme.spacing(3, 1, 3, 1),
    },
    submit: {
      margin: theme.spacing(2, 0, 1),
    },
    deleteButton: {
      color: "#C62828",
      borderColor: "#C62828",
    },
    heroContent: {
      backgroundColor: theme.palette.background.paper,
      padding: theme.spacing(6, 0, 1),
    },
    rating: {
      alignItems: "center",
      justifyContent: "center",
    },
    chip: {
      margin: theme.spacing(0.5),
    },
    typographyCode: {
      fontFamily: "Roboto Mono",
    },
    snackbar: {
      width: "100%",
    },
    alertMessage: {
      marginTop: theme.spacing(1),
      marginBottom: theme.spacing(1),
    },
    dialogHeaderWithPicture: {
      height: "300px",
      width: "100%",
      bottom: "5%",
      left: "0%",
      color: "white",
      padding: "0",
    },
    dialogHeaderWithPictureTitle: {
      marginTop: "225px",
      background: "rgba(0, 0, 0, 0.5)",
      lineHeight: "150%",
    },

    dataGridDisabled: {
      color: theme.palette.text.disabled,
    },

    /* ------------------------------------------
    // Navigation
    // ------------------------------------------ */
    navigationMenuButton: {
      marginRight: theme.spacing(2),
    },
    navigationTitle: {
      flexGrow: 1,
    },
    navigatioMmenuItem: {
      width: 230,
    },
    // Drawer
    navigationList: {
      width: 250,
    },
    navigationFullList: {
      width: "auto",
    },
    toolbar: {
      padding: theme.spacing(0),
    },
    fabBottom: {
      flexGrow: 1,
      margin: theme.spacing(1),
      position: "fixed",
      bottom: theme.spacing(4),
      right: theme.spacing(4),
      zIndex: 1000,
    },
    goBackFabButton: {
      flexGrow: 1,
      position: "absolute",
      margin: theme.spacing(1),
      top: theme.spacing(9),
      left: theme.spacing(1),
      zIndex: 1000,
      color: theme.palette.primary.main,
      background: theme.palette.background.paper,
      borderColor: theme.palette.primary.main,
      border: "2px solid",
    },
    goBackButtonIcon: {
      marginLeft: theme.spacing(0.9),
    },
    /* ------------------------------------------
    // Forms
    // ------------------------------------------ */
    formControl: {
      // margin: theme.spacing(0, 2, 2, 0),
      verticalAlign: "bottom",
      minWidth: 120,
    },
    /* ------------------------------------------
    // Lists
    // ------------------------------------------ */
    listItemIcon: {
      width: "5%",
    },
    listItemTitle: {
      width: "40%",
    },
    listItemContent: {
      width: "60%",
    },

    /* ------------------------------------------
    // Recipe
    // ------------------------------------------ */
    recipeHeader: {
      [theme.breakpoints.down("sm")]: {height: "100vw", maxHeight: "380px"},
      [theme.breakpoints.up("md")]: {height: "50vw", maxHeight: "380px"},
      // position: "relative",
      display: "flex",
      alignItems: "flex-end",
      textAlign: "center",
      flexDirection: "row",
      flexWrap: "nowrap",
      paddingLeft: theme.spacing(4),
      paddingRight: theme.spacing(4),
      // justifyContent: "center",
    },

    recipeHeaderTitle: {
      background: alpha(theme.palette.background.paper, 0.7),
      borderTopLeftRadius: "8px",
      borderTopRightRadius: "8px",
      padding: theme.spacing(2),
      flex: "1",
      alignItems: "flex-end",
    },

    recipeHeaderPictureSource: {
      background: alpha(theme.palette.background.paper, 0.7),
      writingMode: "vertical-rl",
      transform: "rotate(-180deg)",
      position: "absolute", // flex: "1",
      right: "0",
      bottom: "0",
      padding: theme.spacing(0.5),
      paddingBottom: theme.spacing(1),
      borderBottomRightRadius: "4px",
    },
    statsRatingBox: {
      display: "flex",
      m: "auto",
      alignItems: "center",
      justifyContent: "center",
    },
    statsKpiBox: {
      marginBottom: theme.spacing(3),
    },
    /* ------------------------------------------
    // Mail
    // ------------------------------------------ */
    cardActionRight: {
      justifyContent: "flex-end",
      marginBottom: theme.spacing(2),
      marginTop: theme.spacing(2),
    },
    textOnCardMediaImage: {
      width: "100%",
      position: "absolute",
      bottom: "5%",
      left: "0%",
      background: "rgba(0, 0, 0, 0.5)",
      color: "white",
    },
    /* ------------------------------------------
    // Twint Button
    // ------------------------------------------ */
    cardMediaQrCode: {
      height: "100%",
      margin: "auto",
      maxWidth: "350px",
    },
    twintButton: {
      textTransform: "none",
      maxWidth: "420px",
    },
    twintButtonLightMode: {
      backgroundColor: "#262626",
      color: "#fff",
      "&:hover": {
        backgroundColor: "#262626", // Hintergrundfarbe beim Hover-Effekt
        boxShadow: "#fff", // Schatten beim Hover-Effekt
      },
    },
    twintButtonDarkMode: {
      backgroundColor: "#fff",
      color: "#000",
      "&:hover": {
        backgroundColor: "#fff", // Hintergrundfarbe beim Hover-Effekt
        boxShadow: "#000", // Schatten beim Hover-Effekt
      },
    },
    /* ------------------------------------------
  // Menüplan
  // ------------------------------------------ */
    menuplanTabsContainer: {
      display: "flex",
      justifyContent: "center",
      width: "100%",
    },
    menuplanTabs: {
      justifyContent: "center",
    },
    // Drag & Drop
    // Inner Style
    menueCardListItemDrag: {
      idle: {
        cursor: "grab",
        ":hover": {
          // outlineStyle: "solid",
          // outlineWidth: "1px",
          // outlineColor: theme.palette.primary.light,
          // borderRadius: "4px",
        },
      },
      preview: (dragging) => {
        return {
          width: dragging.width,
          height: dragging.height,
          transform: !Utils.isSafari() ? "rotate(4deg)" : undefined,
          backgroundColor: theme.palette.background.paper,
        };
      },
      "is-dragging": {opacity: "0.4"},
      "is-over": {
        // outlineStyle: "solid",
        // outlineWidth: "2px",
        // outlineColor: theme.palette.primary.main,
        // borderRadius: "4px",
      },
      "is-dragging-and-left-self": {display: "none"},
    },

    menueCardDragBox: {
      // We no longer render the draggable item after we have left it
      // as it's space will be taken up by a shadow on adjacent items.
      // Using `display:none` rather than returning `null` so we can always
      // return refs from this component.
      // Keeping the refs allows us to continue to receive events during the drag.
      idle: {marginBottom: theme.spacing(1)},
      "is-dragging": {},
      "is-over": {},
      "is-dragging-and-left-self": {},
      // "is-dragging-and-left-self": {display: "none"},
      preview: {},
    },
    menueCardListItem: {
      // backgroundColor: theme.palette.background.paper,
      borderRadius: "4px",
    },
    menueCardListItemPlaceholder: {
      backgroundColor: theme.palette.primary.light,
      opacity: "0.4",
      borderRadius: "4px",
    },
    //CARD
    menueCardDrag: {
      idle: {cursor: "grab"},
      "is-dragging": {
        backgroundColor: theme.palette.background.paper,
        opacity: "0.4",
      },
      // "is-dragging-and-left-self": {display: "none"},
      "is-dragging-and-left-self": {},
      "is-over": {
        // outlineStyle: "solid",
        // outlineWidth: "2px",
        // borderRadius: "4px",
        // // backgroundColor: theme.palette.primary.light,
        // // opacity: "0.4",
      },
      preview: (dragging) => {
        return {
          width: dragging.width,
          height: dragging.height,
          transform: !Utils.isSafari() ? "rotate(4deg)" : undefined,
          backgroundColor: theme.palette.background.paper,
        };
      },
      // "is-listElement-over": {
      //   outlineStyle: "solid",
      //   outlineWidth: "2px",
      //   outlineColor: theme.palette.primary.light,
      // },
    },
    emptyMealBox: {
      idle: {
        borderColor: theme.palette.grey[500],
        borderWith: "1px",
        borderStyle: "dashed",
        borderRadius: "4px",
        height: "100%",
        width: "100%",
        padding: "0",
        display: "flex",
        alignItems: "center",
      },
      draggedOver: {
        borderColor: theme.palette.primary.light,
        borderWith: "2px",
        borderStyle: "dashed",
        borderRadius: "4px",
        backgroundColor: alpha(theme.palette.primary.light, 0.08),
        height: "100%",
        width: "100%",
        padding: "0",
        display: "flex",
        alignItems: "center",
        transition: "all 0.2s ease",
      },
    },

    /* ------------------------------------------
    // Gruppen-Konfiguration
    // ------------------------------------------ */
    itemGroupConfigurationRow: {
      height: theme.spacing(7),
      alignItems: "flex-end",
      display: "flex",
    },
    /* ------------------------------------------
    // Material/Einkaufsliste
    // ------------------------------------------ */
    // EX: listShoppingList
    eventList: {
      // display: "flex",
      justifyContent: "center",
      flexWrap: "wrap",
      listStyle: "none",
      marginTop: theme.spacing(0),
      paddingTop: theme.spacing(0),
    },
    // EX: listShoppingListItem
    eventListItem: {
      margin: theme.spacing(0.5),
      padding: theme.spacing(0.5),
    },
    // EX: shoppingListItemTextQuantity
    eventListItemTextQuantity: {
      textAlign: "right",
      minWidth: "5%",
      maxWidth: "15%",
      paddingRight: theme.spacing(2),
    },
    // EX: shoppingListItemTextUnit
    eventListItemTextUnit: {
      minWidth: "10%",
      maxWidth: "15%",
    },
    // EX: shoppingListItemTextProduct
    eventListItemTextProduct: {
      minWidth: "50%",
      maxWidth: "100%",
    },
    /* ------------------------------------------
    // Dialog löschen bestätigen
    // ------------------------------------------ */
    dialogDeletionConfirmationTitle: {
      backgroundColor: "#FBE9E7",
      color: "#C62828",
    },
    dialogDeletionConfirmationText: {
      color: "#C62828",
    },
    dialogDeletionConfirmationButton: {
      color: "blue",
      backgroundColor: "blue",
    },
    dialogDeletionConfirmationWarningIcon: {
      marginRight: theme.spacing(1.5),
    },
    dialogDeletedeleteButton: {
      backgroundColor: "#C62828",
      color: "#FFFFFF",
      "&:hover": {
        backgroundColor: "#b71c1c",
      },
    },
    /* ------------------------------------------
    // Worfklow Chips
    // ------------------------------------------ */
    workflowChipActive: {
      backgroundColor: "#01579B !important",
      color: "white !important",
    },
    workflowChipDone: {
      backgroundColor: "#1B5E20 !important",
      color: "white !important",
    },
    workflowChipAborted: {
      backgroundColor: "#B71C1C !important",
      color: "white !important",
    },
    /* ------------------------------------------
    // Tabelle
    // ------------------------------------------ */
    table: {
      // background: "red",
    },
    tableCellInactive: {
      color: theme.palette.text.disabled,
    },
    /* ------------------------------------------
    // Forms
    // ------------------------------------------ */
    formSelect: {
      width: "100%",
    },
    /* ------------------------------------------
    // Userprofile
    // ------------------------------------------ */
    userProfileCardNameOnImage: {
      marginLeft: "3%",
    },
    imageButtonInput: {
      display: "none",
    },
    /* ------------------------------------------
    // Dialog Menu
    // ------------------------------------------ */

    dialogSelectMenueRow: {
      display: "grid",
      gridTemplateColumns: "1fr",
      // gridAutoRows: "min-Content",
      gridAutoFlow: "column",
      padding: "0",
      // marginBottom: theme.spacing(1),
    },
    dialogSelectMenueItem: {
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: theme.spacing(2),
      minWidth: "15em",
    },
    dialogSelectMenuCardMealtype: {
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      // minWidth: "15em",
      width: "100%",
    },
    dialogSelectMenueItemCheckboxBox: {
      paddingTop: theme.spacing(2),
      paddingLeft: theme.spacing(2),
      paddingRight: theme.spacing(1),
      paddingBottom: theme.spacing(2),
      minWidth: "15em",
    },
    /* ------------------------------------------
    // Menüplan
    // ------------------------------------------ */
    stickyHeaderRow: {
      display: "flex",
      flexDirection: "row",
      flexWrap: "nowrap",
      position: "sticky",
      top: "64px", // Der Header ist 64px
      background: theme.palette.background.default,
      zIndex: 1000,
    },

    menuplanItem: {
      flexGrow: 1,
      flexBasis: 0,
      padding: theme.spacing(1),
      paddingBottom: theme.spacing(2),
      minWidth: "330px",
      display: "flex",
      flexDirection: "column",
      alignItems: "stretch",
    },
    recipeDrawerBackground: {
      "& .MuiDrawer-paper": {
        backgroundColor: theme.palette.background.default,
        height: "100%",
        overflowX: "hidden",
      },
    },
    menuCard: {
      position: "relative",
      height: "100%",
      display: "flex",
      flex: 1,
      flexDirection: "column",
    },
    menuCardPlaceholder: {
      backgroundColor: theme.palette.primary.light,
      opacity: "0.4",
      marginBottom: theme.spacing(1),
      marginTop: theme.spacing(1),
      // borderRadius: "4px",
    },
    closeDrawerIconButton: {
      flexGrow: 1,
      position: "fixed",
      margin: theme.spacing(1),
      top: theme.spacing(1),
      right: theme.spacing(1),
      zIndex: 1000,
      background: alpha(theme.palette.background.paper, 0.7), // color: theme.palette.primary.main,
    },
    cardMealType: {
      position: "relative",
      height: "100%",
      display: "flex",
      flexDirection: "column",
      minHeight: "10em",
      backgroundColor: alpha(theme.palette.primary.main, 0.2),
      minWidth: "200px",
      width: "100%",
    },
    toggleButtonGroup: {
      marginTop: theme.spacing(2),
      marginBottom: theme.spacing(4),
      display: "flex",
    },
    toggleButton: {
      flex: "1",
      height: "100%",
      whiteSpace: "nowrap",
    },
    /* ------------------------------------------
    // Realtime-Highlight: Glow-Animation für Änderungen
    // anderer Benutzer (Supabase Realtime).
    // ------------------------------------------ */
    remoteChangeGlow: {
      "@keyframes remoteChangeGlow": {
        "0%": {
          boxShadow: `0 0 8px 3px ${alpha(theme.palette.primary.main, 0.5)}`,
        },
        "100%": {
          boxShadow: `0 0 0 0 ${alpha(theme.palette.primary.main, 0)}`,
        },
      },
      animation: "remoteChangeGlow 2s ease-out",
    },
  };
};

export default useCustomStyles;
