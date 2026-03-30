/**
 * MergeItemsPage — Admin-Seite zum Zusammenführen von Produkten und Materialien.
 *
 * Ermöglicht es, zwei Produkte oder zwei Materialien auszuwählen und zu
 * einem zusammenzuführen. Alle Referenzen (Rezeptzutaten, Einkaufslisten,
 * Menüpläne, Einheitenumrechnungen) werden auf das Ziel-Element
 * aktualisiert und das Quell-Element wird gelöscht.
 *
 * Verwendet den AdminOperationsRepository (Postgres RPC) anstelle der
 * früheren Firebase Cloud Functions.
 */
import React from "react";
import * as Sentry from "@sentry/browser";

import {useCustomStyles} from "../../constants/styles";

import {
  ListItemText,
  Tab,
  Tabs,
  useTheme,
  AutocompleteChangeReason,
  Container,
  Backdrop,
  CircularProgress,
  Card,
  CardContent,
  Typography,
  LinearProgress,
  Button,
  List,
  ListSubheader,
  ListItem,
} from "@mui/material";

import {PageTitle} from "../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "./system";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  MERGE_ITEM_EXPLANATION as TEXT_MERGE_ITEM_EXPLANATION,
  CHANGED_DOCUMENTS as TEXT_CHANGED_DOCUMENTS,
  MERGE_ERROR_SAME_ITEMS as TEXT_MERGE_ERROR_SAME_ITEMS,
  TIME_TO_CLEAN_UP as TEXT_TIME_TO_CLEAN_UP,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  MERGE_PRODUCT_SELECTION as TEXT_MERGE_PRODUCT_SELECTION,
  MERGE_MATERIAL_SELECTION as TEXT_MERGE_MATERIAL_SELECTION,
  MERGE_ITEMS as TEXT_MERGE_ITEMS,
  LOG as TEXT_LOG,
  PRODUCT as TEXT_PRODUCT,
  PRODUCTS as TEXT_PRODUCTS,
  MATERIAL as TEXT_MATERIAL,
  MATERIALS as TEXT_MATERIALS,
  MATERIAL_TYPE_KEY_TEXT as TEXT_MATERIAL_TYPE_KEY_TEXT,
  UID as TEXT_UID,
  NAME as TEXT_NAME,
  DEPARTMENT as TEXT_DEPARTMENT,
  SHOPPING_UNIT as TEXT_SHOPPING_UNIT,
  DIET_TYPES as TEXT_DIET_TYPES,
  ALLERGEN_KEY_TEXT as TEXT_ALLERGEN_KEY_TEXT,
  RESTRICTIONS as TEXT_RESTRICTIONS,
  ALLERGENS as TEXT_ALLERGENS,
  TYPE as TEXT_TYPE,
} from "../../constants/text";

import {Product} from "../Product/product.types";
import {Material} from "../Material/material.types";
import {ProductAutocomplete} from "../Product/productAutocomplete";
import {MaterialAutocomplete} from "../Material/materialAutocomplete";
import {FormListItem} from "../Shared/formListItem";
import {useDatabase} from "../Database/DatabaseContext";
import {
  MergeProductsResult,
  MergeMaterialsResult,
} from "../Database/Repository/AdminOperationsRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

enum ReducerActions {
  PRODUCTS_FETCH_INIT = "PRODUCTS_FETCH_INIT",
  PRODUCTS_FETCH_SUCCESS = "PRODUCTS_FETCH_SUCCESS",
  PRODUCTS_CHANGE_PRODUCT = "PRODUCTS_CHANGE_PRODUCT",
  PRODUCT_MERGE_START = "PRODUCT_MERGE_START",
  PRODUCT_MERGE_FINISHED = "PRODUCT_MERGE_FINISHED",
  MATERIALS_FETCH_INIT = "MATERIALS_FETCH_INIT",
  MATERIALS_FETCH_SUCCESS = "MATERIALS_FETCH_SUCCESS",
  MATERIALS_CHANGE_MATERIAL = "MATERIALS_CHANGE_MATERIAL",
  MATERIAL_MERGE_START = "MATERIAL_MERGE_START",
  MATERIAL_MERGE_FINISHED = "MATERIAL_MERGE_FINISHED",
  CLEAR_MERGE_PROTOCOL = "CLEAR_MERGE_PROTOCOL",
  GENERIC_ERROR = "GENERIC_ERROR",
}

/** Diskriminierte Union für alle Reducer-Aktionen. */
type DispatchAction =
  | {type: ReducerActions.PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {
      type: ReducerActions.PRODUCTS_CHANGE_PRODUCT;
      payload: {field: string; value: Product | null};
    }
  | {type: ReducerActions.PRODUCT_MERGE_START}
  | {
      type: ReducerActions.PRODUCT_MERGE_FINISHED;
      payload: MergeProductsResult;
    }
  | {type: ReducerActions.MATERIALS_FETCH_INIT}
  | {type: ReducerActions.MATERIALS_FETCH_SUCCESS; payload: Material[]}
  | {
      type: ReducerActions.MATERIALS_CHANGE_MATERIAL;
      payload: {field: string; value: Material | null};
    }
  | {type: ReducerActions.MATERIAL_MERGE_START}
  | {
      type: ReducerActions.MATERIAL_MERGE_FINISHED;
      payload: MergeMaterialsResult;
    }
  | {type: ReducerActions.CLEAR_MERGE_PROTOCOL}
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

/** Zusammenführungsprotokoll — entweder Produkt- oder Material-Ergebnis. */
type MergeProtocol =
  | {kind: "product"; result: MergeProductsResult}
  | {kind: "material"; result: MergeMaterialsResult}
  | null;

type ItemSelection = {uid: string; name: string};

type State = {
  products: Product[];
  materials: Material[];
  product_A: ItemSelection;
  product_B: ItemSelection;
  material_A: ItemSelection;
  material_B: ItemSelection;
  mergeProtocol: MergeProtocol;
  isLoading: boolean;
  isMerging: boolean;
  error: Error | null;
};

const initialState: State = {
  products: [],
  materials: [],
  product_A: {uid: "", name: ""},
  product_B: {uid: "", name: ""},
  material_A: {uid: "", name: ""},
  material_B: {uid: "", name: ""},
  mergeProtocol: null,
  isLoading: false,
  isMerging: false,
  error: null,
};

enum TabValue {
  products = "products",
  materials = "materials",
}

/**
 * Reducer für den Merge-State.
 *
 * Verwaltet Lade-, Auswahl- und Zusammenführungszustände
 * für Produkte und Materialien.
 */
const mergeItemsReducer = (state: State, action: DispatchAction): State => {
  switch (action.type) {
    case ReducerActions.PRODUCTS_FETCH_INIT:
    case ReducerActions.MATERIALS_FETCH_INIT:
      return {
        ...state,
        isLoading: true,
      };
    case ReducerActions.PRODUCTS_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        products: action.payload,
      };
    case ReducerActions.MATERIALS_FETCH_SUCCESS:
      return {
        ...state,
        isLoading: false,
        materials: action.payload,
      };
    case ReducerActions.PRODUCTS_CHANGE_PRODUCT: {
      const product = action.payload.value
        ? {uid: action.payload.value.uid, name: action.payload.value.name}
        : {uid: "", name: ""};

      return {
        ...state,
        [action.payload.field]: product,
        error: null,
      };
    }
    case ReducerActions.MATERIALS_CHANGE_MATERIAL: {
      const material = action.payload.value
        ? {uid: action.payload.value.uid, name: action.payload.value.name}
        : {uid: "", name: ""};

      return {
        ...state,
        [action.payload.field]: material,
        error: null,
      };
    }
    case ReducerActions.PRODUCT_MERGE_START:
    case ReducerActions.MATERIAL_MERGE_START:
      return {
        ...state,
        mergeProtocol: null,
        isMerging: true,
      };
    case ReducerActions.PRODUCT_MERGE_FINISHED: {
      // Quellprodukt aus der lokalen Liste entfernen
      const products = state.products.filter(
        (product) => product.uid !== state.product_A.uid
      );
      return {
        ...state,
        mergeProtocol: {kind: "product", result: action.payload},
        products: products,
        product_A: {uid: "", name: ""},
        product_B: {uid: "", name: ""},
        isMerging: false,
        error: null,
      };
    }
    case ReducerActions.MATERIAL_MERGE_FINISHED: {
      // Quellmaterial aus der lokalen Liste entfernen
      const materials = state.materials.filter(
        (material) => material.uid !== state.material_A.uid
      );
      return {
        ...state,
        mergeProtocol: {kind: "material", result: action.payload},
        material_A: {uid: "", name: ""},
        material_B: {uid: "", name: ""},
        materials: materials,
        isMerging: false,
        error: null,
      };
    }
    case ReducerActions.CLEAR_MERGE_PROTOCOL:
      return {
        ...state,
        mergeProtocol: null,
      };
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isMerging: false,
        error: action.payload,
      };
    default:
      throw new Error("Unbekannter ActionType im mergeItemsReducer");
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptkomponente für die Admin-Seite «Elemente zusammenführen».
 *
 * Bietet Tabs für Produkte und Materialien. In jedem Tab können
 * ein Quell- und ein Ziel-Element gewählt werden, die dann per
 * Postgres-RPC zusammengeführt werden.
 */
const MegeItemsPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const theme = useTheme();

  const [state, dispatch] = React.useReducer(mergeItemsReducer, initialState);
  const [tabValue, setTabValue] = React.useState(TabValue.products);

  /* ------------------------------------------
  // Produkte aus der DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.PRODUCTS_FETCH_INIT});

    database.products
      .getAllProducts({onlyUsable: true, withDepartmentName: true})
      .then((result) => {
        // ProductDomain auf Product-Klasse mappen, da Autocomplete dies erwartet
        const products = result.map((domain) => {
          const product: Product = {
            uid: domain.uid,
            name: domain.name,
            department: domain.department,
            shoppingUnit: domain.shoppingUnit,
            dietProperties: domain.dietProperties,
            usable: domain.usable,
            qaChecked: false,
            qaCheckedAt: null,
          };
          return product;
        });
        dispatch({
          type: ReducerActions.PRODUCTS_FETCH_SUCCESS,
          payload: products,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  /* ------------------------------------------
  // Materialien aus der DB lesen
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.MATERIALS_FETCH_INIT});

    database.materials
      .getAllMaterials(true)
      .then((result) => {
        dispatch({
          type: ReducerActions.MATERIALS_FETCH_SUCCESS,
          payload: result,
        });
      })
      .catch((error) => {
        Sentry.captureException(error);
        dispatch({type: ReducerActions.GENERIC_ERROR, payload: error});
      });
  }, []);

  /* ------------------------------------------
  // Produktauswahl ändern
  // ------------------------------------------ */
  const onChangeProductSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Product | null,
    action?: AutocompleteChangeReason
  ) => {
    if (action === "blur") {
      return;
    }

    dispatch({
      type: ReducerActions.PRODUCTS_CHANGE_PRODUCT,
      payload: {
        field: event.target.id.split("-")[0],
        value: newValue as Product | null,
      },
    });
  };

  /* ------------------------------------------
  // Materialauswahl ändern
  // ------------------------------------------ */
  const onChangeMaterialSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material | null,
    action?: AutocompleteChangeReason
  ) => {
    if (action === "blur") {
      return;
    }

    dispatch({
      type: ReducerActions.MATERIALS_CHANGE_MATERIAL,
      payload: {
        field: event.target.id.split("-")[0],
        value: newValue as Material | null,
      },
    });
  };

  /* ------------------------------------------
  // Produkte zusammenführen (Supabase RPC)
  // ------------------------------------------ */
  const onMergeProducts = async () => {
    if (state.product_A.uid === state.product_B.uid) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error(TEXT_MERGE_ERROR_SAME_ITEMS(TEXT_PRODUCT)),
      });
      return;
    }

    dispatch({type: ReducerActions.PRODUCT_MERGE_START});
    try {
      const mergeResult = await database.adminOps.mergeProducts(
        state.product_A.uid,
        state.product_B.uid
      );
      dispatch({
        type: ReducerActions.PRODUCT_MERGE_FINISHED,
        payload: mergeResult,
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };

  /* ------------------------------------------
  // Materialien zusammenführen (Supabase RPC)
  // ------------------------------------------ */
  const onMergeMaterials = async () => {
    if (state.material_A.uid === state.material_B.uid) {
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: new Error(TEXT_MERGE_ERROR_SAME_ITEMS(TEXT_MATERIAL)),
      });
      return;
    }

    dispatch({type: ReducerActions.MATERIAL_MERGE_START});
    try {
      const mergeResult = await database.adminOps.mergeMaterials(
        state.material_A.uid,
        state.material_B.uid
      );
      dispatch({
        type: ReducerActions.MATERIAL_MERGE_FINISHED,
        payload: mergeResult,
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };

  /* ------------------------------------------
  // Tab-Handler
  // ------------------------------------------ */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(
      newValue === 0 ? TabValue.products : TabValue.materials
    );
    dispatch({type: ReducerActions.CLEAR_MERGE_PROTOCOL});
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_MERGE_ITEMS} subTitle={TEXT_TIME_TO_CLEAN_UP} breadcrumbs={[SYSTEM_BREADCRUMB]} />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Backdrop sx={classes.backdrop} open={state.isLoading}>
          <CircularProgress color="inherit" />
        </Backdrop>
        {state.error && (
          <AlertMessage
            error={state.error}
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}
        <Tabs
          value={tabValue === TabValue.products ? 0 : 1}
          onChange={handleTabChange}
          centered
          style={{marginBottom: theme.spacing(2)}}
        >
          <Tab label={TEXT_PRODUCTS} />
          <Tab label={TEXT_MATERIALS} />
        </Tabs>

        {tabValue === TabValue.products ? (
          <PanelMergeProducts
            mergeItems={state}
            onChangeProductSelection={onChangeProductSelection}
            onMergeProducts={onMergeProducts}
            mergeProtocol={
              state.mergeProtocol?.kind === "product"
                ? state.mergeProtocol.result
                : null
            }
          />
        ) : (
          <PanelMergeMaterials
            mergeItems={state}
            onChangeMaterialSelection={onChangeMaterialSelection}
            onMergeMaterials={onMergeMaterials}
            mergeProtocol={
              state.mergeProtocol?.kind === "material"
                ? state.mergeProtocol.result
                : null
            }
          />
        )}
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ======================== Merge Product Card =======================
// =================================================================== */

type PanelMergeProductsProps = {
  mergeItems: State;
  onChangeProductSelection: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Product | null,
    action?: AutocompleteChangeReason,
    objectId?: string
  ) => void;
  onMergeProducts: () => void;
  mergeProtocol: MergeProductsResult | null;
};

/**
 * Panel für die Produkt-Zusammenführung.
 *
 * Zeigt zwei Autocomplete-Felder für Quell- und Zielprodukt,
 * einen Merge-Button und das Ergebnisprotokoll.
 */
const PanelMergeProducts = ({
  mergeItems,
  onChangeProductSelection,
  onMergeProducts,
  mergeProtocol,
}: PanelMergeProductsProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_MERGE_PRODUCT_SELECTION}
        </Typography>
        <Typography gutterBottom={true}>
          {TEXT_MERGE_ITEM_EXPLANATION(TEXT_PRODUCT)}
        </Typography>
        <br />
        <ProductAutocomplete
          componentKey={"A"}
          product={mergeItems.product_A}
          products={mergeItems.products}
          onChange={onChangeProductSelection}
          label={`${TEXT_PRODUCT} A`}
          allowCreateNewProduct={false}
        />

        <ProductDetailList
          productUid={mergeItems.product_A.uid}
          products={mergeItems.products}
        />
        <br />
        <ProductAutocomplete
          componentKey={"B"}
          product={mergeItems.product_B}
          products={mergeItems.products}
          onChange={onChangeProductSelection}
          label={`${TEXT_PRODUCT} B`}
          allowCreateNewProduct={false}
        />
        <ProductDetailList
          productUid={mergeItems.product_B.uid}
          products={mergeItems.products}
        />
        <br />

        {mergeItems.isMerging && (
          <React.Fragment>
            <br />
            <LinearProgress />
          </React.Fragment>
        )}
        <Button
          fullWidth
          disabled={!mergeItems?.product_A?.uid || !mergeItems?.product_B?.uid}
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onMergeProducts}
        >
          {TEXT_MERGE_ITEMS}
        </Button>
        {mergeProtocol !== null && (
          <MergeProductsResultList result={mergeProtocol} />
        )}
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// =================== Ergebnisanzeige Produkt-Merge =================
// =================================================================== */

/**
 * Zeigt das Ergebnis einer Produkt-Zusammenführung als Liste
 * mit Anzahl betroffener Zeilen pro Tabelle.
 */
const MergeProductsResultList = ({result}: {result: MergeProductsResult}) => {
  return (
    <React.Fragment>
      <br />
      <List
        subheader={
          <ListSubheader component="div" id="subheader-merge-result">
            {TEXT_CHANGED_DOCUMENTS}
          </ListSubheader>
        }
      >
        <ListItem divider key={"result_recipe_ingredients"}>
          <ListItemText
            primary="Rezeptzutaten"
            secondary={`${result.recipe_ingredients} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_shopping_list_items"}>
          <ListItemText
            primary="Einkaufslisteneinträge"
            secondary={`${result.shopping_list_items} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_menue_products"}>
          <ListItemText
            primary="Menüplan-Produkte"
            secondary={`${result.menue_products} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_unit_conversions"}>
          <ListItemText
            primary="Einheitenumrechnungen"
            secondary={`${result.unit_conversions} Zeilen aktualisiert`}
          />
        </ListItem>
      </List>
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Detail-Anzeige Produkt =====================
// =================================================================== */

type ProductDetailListProps = {
  productUid: Product["uid"];
  products: Product[];
};

/**
 * Zeigt die Details eines ausgewählten Produkts (UID, Name,
 * Abteilung, Einkaufseinheit, Diäteigenschaften, Allergene).
 */
export const ProductDetailList = ({
  products,
  productUid,
}: ProductDetailListProps) => {
  const theme = useTheme();
  const product = products.find((product) => product.uid === productUid);

  if (!product) {
    return null;
  }

  return (
    <List dense style={{marginBottom: theme.spacing(2)}}>
      <FormListItem
        key={product.uid + "_uid"}
        id={product.uid + "_uid"}
        value={product.uid}
        label={TEXT_UID}
        displayAsCode={true}
      />
      <FormListItem
        key={product.uid + "_name"}
        id={product.uid + "_name"}
        value={product.name}
        label={TEXT_NAME}
      />
      <FormListItem
        key={product.uid + "_department"}
        id={product.uid + "_department"}
        value={product.department.name}
        label={TEXT_DEPARTMENT}
      />
      <FormListItem
        key={product.uid + "_unit"}
        id={product.uid + "_unit"}
        value={product.shoppingUnit}
        label={TEXT_SHOPPING_UNIT}
      />
      <FormListItem
        key={product.uid + "_diet"}
        id={product.uid + "_diet"}
        value={TEXT_DIET_TYPES[product.dietProperties.diet]}
        label={TEXT_RESTRICTIONS}
      />
      <FormListItem
        key={product.uid + "_allergens"}
        id={product.uid + "_allergens"}
        value={product.dietProperties.allergens
          .map((allergen) => TEXT_ALLERGEN_KEY_TEXT[allergen])
          .join(", ")}
        label={TEXT_ALLERGENS}
      />
    </List>
  );
};

/* ===================================================================
// ======================== Merge Material Card ======================
// =================================================================== */

type PanelMergeMaterialsProps = {
  mergeItems: State;
  onChangeMaterialSelection: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material | null,
    action?: AutocompleteChangeReason,
    objectId?: string
  ) => void;
  onMergeMaterials: () => void;
  mergeProtocol: MergeMaterialsResult | null;
};

/**
 * Panel für die Material-Zusammenführung.
 *
 * Zeigt zwei Autocomplete-Felder für Quell- und Zielmaterial,
 * einen Merge-Button und das Ergebnisprotokoll.
 */
const PanelMergeMaterials = ({
  mergeItems,
  onChangeMaterialSelection,
  onMergeMaterials,
  mergeProtocol,
}: PanelMergeMaterialsProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_MERGE_MATERIAL_SELECTION}
        </Typography>
        <Typography gutterBottom={true}>
          {TEXT_MERGE_ITEM_EXPLANATION(TEXT_MATERIAL)}
        </Typography>
        <br />
        <MaterialAutocomplete
          componentKey={"A"}
          label={`${TEXT_MATERIAL} A`}
          material={mergeItems.material_A}
          materials={mergeItems.materials}
          allowCreateNewMaterial={false}
          onChange={onChangeMaterialSelection}
          disabled={false}
        />
        <MaterialDetailList
          materialUid={mergeItems.material_A.uid}
          materials={mergeItems.materials}
        />
        <br />

        <MaterialAutocomplete
          componentKey={"B"}
          label={`${TEXT_MATERIAL} B`}
          material={mergeItems.material_B}
          materials={mergeItems.materials}
          allowCreateNewMaterial={false}
          onChange={onChangeMaterialSelection}
          disabled={false}
        />
        <MaterialDetailList
          materialUid={mergeItems.material_B.uid}
          materials={mergeItems.materials}
        />
        <br />
        {mergeItems.isMerging && (
          <React.Fragment>
            <br />
            <LinearProgress />
          </React.Fragment>
        )}
        <Button
          fullWidth
          disabled={
            !mergeItems?.material_A?.uid || !mergeItems?.material_B?.uid
          }
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onMergeMaterials}
        >
          {TEXT_MERGE_ITEMS}
        </Button>
        {mergeProtocol !== null && (
          <MergeMaterialsResultList result={mergeProtocol} />
        )}
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ================== Ergebnisanzeige Material-Merge =================
// =================================================================== */

/**
 * Zeigt das Ergebnis einer Material-Zusammenführung als Liste
 * mit Anzahl betroffener Zeilen pro Tabelle.
 */
const MergeMaterialsResultList = ({
  result,
}: {
  result: MergeMaterialsResult;
}) => {
  return (
    <React.Fragment>
      <br />
      <List
        subheader={
          <ListSubheader component="div" id="subheader-merge-result">
            {TEXT_CHANGED_DOCUMENTS}
          </ListSubheader>
        }
      >
        <ListItem divider key={"result_recipe_materials"}>
          <ListItemText
            primary="Rezeptmaterialien"
            secondary={`${result.recipe_materials} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_material_list_items"}>
          <ListItemText
            primary="Materiallisten-Einträge"
            secondary={`${result.material_list_items} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_menue_materials"}>
          <ListItemText
            primary="Menüplan-Materialien"
            secondary={`${result.menue_materials} Zeilen aktualisiert`}
          />
        </ListItem>
        <ListItem divider key={"result_shopping_list_items"}>
          <ListItemText
            primary="Einkaufslisteneinträge"
            secondary={`${result.shopping_list_items} Zeilen aktualisiert`}
          />
        </ListItem>
      </List>
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Detail-Anzeige Material ====================
// =================================================================== */

type MaterialDetailListProps = {
  materialUid: Material["uid"];
  materials: Material[];
};

/**
 * Zeigt die Details eines ausgewählten Materials (UID, Name, Typ).
 */
export const MaterialDetailList = ({
  materials,
  materialUid,
}: MaterialDetailListProps) => {
  const theme = useTheme();
  const material = materials.find((material) => material.uid === materialUid);

  if (!material) {
    return null;
  }

  return (
    <List dense style={{marginBottom: theme.spacing(2)}}>
      <FormListItem
        key={material.uid + "_uid"}
        id={material.uid + "_uid"}
        value={material.uid}
        label={TEXT_UID}
        displayAsCode={true}
      />
      <FormListItem
        key={material.uid + "_name"}
        id={material.uid + "_name"}
        value={material.name}
        label={TEXT_NAME}
      />
      <FormListItem
        key={material.uid + "_type"}
        id={material.uid + "_type"}
        value={TEXT_MATERIAL_TYPE_KEY_TEXT[material.type]}
        label={TEXT_TYPE}
      />
    </List>
  );
};

export default MegeItemsPage;
