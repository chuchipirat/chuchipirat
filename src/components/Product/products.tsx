import React from "react";
import * as Sentry from "@sentry/react";

import {
  Backdrop,
  CircularProgress,
  Container,
  Typography,
  Card,
  CardContent,
  Checkbox,
  Menu,
  MenuItem,
  ListItemIcon,
  IconButton,
  useTheme,
  Box,
  Tooltip,
  Select,
  Autocomplete,
  TextField,
  SelectChangeEvent,
} from "@mui/material";

import {
  DEPARTMENT as TEXT_DEPARTMENT,
  PRODUCTS as TEXT_PRODUCTS,
  NOTHING_WORKS_WITHOUT_US as TEXT_NOTHING_WORKS_WITHOUT_US,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  EDIT as TEXT_EDIT,
  SAVE as TEXT_SAVE,
  CANCEL as TEXT_CANCEL,
  UID as TEXT_UID,
  SHOPPING_UNIT as TEXT_SHOPPING_UNIT,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  DIET as TEXT_DIET,
  USABLE as TEXT_USABLE,
  FROM as TEXT_FROM,
  NAME as TEXT_NAME,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  CHOOSE_MATERIAL_TYPE as TEXT_CHOOSE_MATERIAL_TYPE,
  MATERIAL_TYPE as TEXT_MATERIAL_TYPE,
  OPEN as TEXT_OPEN,
  DIET_TYPES as TEXT_DIET_TYPES,
  SHOW_ALL_PRODUCTS as TEXT_SHOW_ALL_PRODUCTS,
  SHOW_ONLY_NEWEST_PRODUCTS as TEXT_SHOW_ONLY_NEWEST_PRODUCTS,
  CONVERT_TO_MATERIAL as TEXT_CONVERT_TO_MATERIAL,
} from "../../constants/text";
import {
  QA_CHECKED as TEXT_QA_CHECKED,
  QA_ISSUES as TEXT_QA_ISSUES,
  FIND_DUPLICATES as TEXT_FIND_DUPLICATES,
  MANAGE_SYNONYMS as TEXT_MANAGE_SYNONYMS,
  DELETE_PRODUCT as TEXT_DELETE_PRODUCT,
  DELETE_PRODUCT_CONFIRM as TEXT_DELETE_PRODUCT_CONFIRM,
  PRODUCT_IN_USE_WARNING as TEXT_PRODUCT_IN_USE_WARNING,
  PRODUCT_NOT_IN_USE as TEXT_PRODUCT_NOT_IN_USE,
} from "../../constants/text/productQa";
import {Role as Roles} from "../../constants/roles";

import {PageTitle} from "../Shared/pageTitle";
import {ButtonRow} from "../Shared/buttonRow";
import {DialogProduct, ProductDialog} from "./dialogProduct";
import {AlertMessage} from "../Shared/AlertMessage";

import {
  Edit as EditIcon,
  MoreVert as MoreVertIcon,
  Cached as CachedIcon,
  Warning as WarningIcon,
  FindReplace as FindReplaceIcon,
  Translate as TranslateIcon,
  CheckCircleOutline as CheckCircleOutlineIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";

import {CustomSnackbar} from "../Shared/customSnackbar";
import {useCustomStyles} from "../../constants/styles";

import {Product, Allergen, Diet, createEmptyDietProperty} from "./product.types";
import {Unit, UnitDimension} from "../Unit/unit.class";
import Department from "../Department/department.class";

import AuthUser from "../Firebase/Authentication/authUser.class";
import {MaterialType} from "../Material/material.types";
import {
  DialogType,
  SingleTextInputResult,
  useCustomDialog,
} from "../Shared/customDialogContext";
import {useAuthUser} from "../Session/authUserContext";
import {useDatabase} from "../Database/DatabaseContext";
import {WhereUsedEntry} from "../Database/Repository/AdminOperationsRepository";
import {
  DataGrid,
  GridColDef,
  GridRowSelectionModel,
} from "@mui/x-data-grid";
import {deDE} from "@mui/x-data-grid/locales";

import {useProductsQa, QaFilterStatus, ProductIssue} from "./useProductsQa";
import {ProductsQaFilterBar} from "./productsQaFilterBar";
import {ProductsQaBulkActions} from "./productsQaBulkActions";
import {DialogMergeProducts} from "./dialogMergeProducts";
import {DialogSynonymPairs} from "./dialogSynonymPairs";
import {detectProductIssues} from "./productQaUtils";
import {ReducerActions} from "./useProductsQa";

const PRODUCT_POPUP_VALUES = {
  productName: "",
  productUid: "",
  department: {name: "", uid: ""},
  shoppingUnit: {key: "", name: "", dimension: UnitDimension.dimensionless},
  usable: false,
  popUpOpen: false,
  dietProperties: createEmptyDietProperty(),
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Hauptseite für die Produkt-/Zutaten-Verwaltung mit QA-Funktionen.
 * Verwendet den useProductsQa-Hook für Zustandsverwaltung und
 * ermöglicht Inline-Bearbeitung, Bulk-Aktionen, Duplikaterkennung
 * und QA-Tracking.
 */
const ProductsPage = () => {
  const database = useDatabase();
  const authUser = useAuthUser();
  const classes = useCustomStyles();
  const {customDialog} = useCustomDialog();

  const hook = useProductsQa();
  const {state, editMode} = hook;

  // Merge-Dialog State
  const [mergeDialogOpen, setMergeDialogOpen] = React.useState(false);
  const [mergeSourceUid, setMergeSourceUid] = React.useState("");
  const [mergeTargetUid, setMergeTargetUid] = React.useState("");

  // Synonym-Dialog State
  const [synonymDialogOpen, setSynonymDialogOpen] = React.useState(false);

  // Issue-Detection: Flags bei Produktänderungen neu berechnen
  React.useEffect(() => {
    if (state.products.length > 0) {
      const issues = detectProductIssues(state.products);
      hook.dispatch({
        type: ReducerActions.ISSUE_FLAGS_LOADED,
        payload: issues,
      });
    }
  }, [state.products]);

  if (!authUser) {
    return null;
  }

  /* ------------------------------------------
  // Konvertierung zu Material (Dialog-Logik bleibt hier)
  // ------------------------------------------ */
  const handleConvertProductToMaterial = async (product: Product) => {
    const userInput = (await customDialog({
      dialogType: DialogType.SelectOptions,
      title: TEXT_MATERIAL_TYPE,
      text: TEXT_CHOOSE_MATERIAL_TYPE,
      singleTextInputProperties: {
        initialValue: "",
        textInputLabel: TEXT_NAME,
      },
      options: [
        {key: MaterialType.usage, text: TEXT_MATERIAL_TYPE_USAGE},
        {key: MaterialType.consumable, text: TEXT_MATERIAL_TYPE_CONSUMABLE},
      ],
    })) as SingleTextInputResult;

    if (userInput.valid) {
      const materialTypeMap: Record<number, string> = {
        [MaterialType.consumable]: "consumable",
        [MaterialType.usage]: "usage",
      };
      const materialType =
        materialTypeMap[parseInt(userInput.input)] ?? "consumable";

      database.adminOps
        .convertProductToMaterial(product.uid, materialType)
        .then(() => {
          hook.onConvertProductToMaterial(product);
        });
    }
  };

  /* ------------------------------------------
  // Produkt löschen (mit Where-Used-Prüfung)
  // ------------------------------------------ */
  const handleDeleteProduct = async (product: Product) => {
    try {
      const references = await database.adminOps.whereUsed(
        product.uid,
        "product",
      );

      // Dialog-Text zusammenbauen
      let dialogText: string | JSX.Element;
      if (references.length > 0) {
        // Referenzen nach Tabelle gruppieren
        const grouped = new Map<string, WhereUsedEntry[]>();
        for (const entry of references) {
          const existing = grouped.get(entry.table_name) ?? [];
          existing.push(entry);
          grouped.set(entry.table_name, existing);
        }

        // Menschenlesbare Labels für die Tabellennamen
        const tableLabels: Record<string, string> = {
          recipe_ingredients: "Rezepte (Zutaten)",
          recipe_materials: "Rezepte (Material)",
          event_shopping_list_items: "Einkaufslisten",
          event_material_list_items: "Materiallisten",
          event_menue_products: "Menüpläne (Produkte)",
          event_menue_materials: "Menüpläne (Material)",
          event_menue_recipes: "Menüpläne (Rezepte)",
          unit_conversion_products: "Einheitenumrechnung",
        };

        dialogText = (
          <React.Fragment>
            <Typography
              variant="body2"
              color="warning.main"
              gutterBottom
              sx={{fontWeight: "bold"}}
            >
              {TEXT_PRODUCT_IN_USE_WARNING}
            </Typography>
            {Array.from(grouped.entries()).map(
              ([tableName, tableEntries]) => (
                <Box key={tableName} sx={{marginBottom: 1}}>
                  <Typography variant="subtitle2">
                    {tableLabels[tableName] ?? tableName} (
                    {tableEntries.length})
                  </Typography>
                  <Box
                    component="ul"
                    sx={{paddingLeft: 2, margin: 0, marginTop: 0.5}}
                  >
                    {tableEntries.map((entry, index) => (
                      <Typography
                        component="li"
                        variant="body2"
                        color="text.secondary"
                        key={`${tableName}-${entry.record_id}-${index}`}
                      >
                        {entry.context}
                      </Typography>
                    ))}
                  </Box>
                </Box>
              ),
            )}
          </React.Fragment>
        );
      } else {
        dialogText = (
          <Typography variant="body2" color="text.secondary">
            {TEXT_PRODUCT_NOT_IN_USE}
          </Typography>
        );
      }

      const confirmed = await customDialog({
        dialogType: DialogType.Confirm,
        title: TEXT_DELETE_PRODUCT_CONFIRM(product.name),
        text: dialogText,
      });

      if (confirmed) {
        await database.products.deleteProduct(product.uid);
        hook.onDeleteProduct(product);
      }
    } catch (error) {
      Sentry.captureException(error, {
        extra: {context: "Produkt löschen", productUid: product.uid},
      });
      hook.dispatch({
        type: ReducerActions.GENERIC_ERROR,
        payload: error as Error,
      });
    }
  };

  /* ------------------------------------------
  // Merge-Dialog öffnen
  // ------------------------------------------ */
  const openMergeDialog = (sourceUid: string, targetUid: string) => {
    setMergeSourceUid(sourceUid);
    setMergeTargetUid(targetUid);
    setMergeDialogOpen(true);
  };

  const openMergeFromSelection = () => {
    if (state.selectedProductUids.length === 2) {
      openMergeDialog(
        state.selectedProductUids[0],
        state.selectedProductUids[1],
      );
    }
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle
        title={TEXT_PRODUCTS}
        subTitle={TEXT_NOTHING_WORKS_WITHOUT_US}
      />
      <ProductsButtonRow
        editMode={editMode}
        onEdit={hook.onEditClick}
        onSave={hook.onSave}
        onCancel={hook.onCancelClick}
        onLoadNewestProducts={hook.loadNewestProducts}
        onFindDuplicates={hook.onFindDuplicates}
        onManageSynonyms={() => {
          hook.onLoadSynonyms();
          setSynonymDialogOpen(true);
        }}
        showLoadNewestProducts={state.newestProductUids.length === 0}
        authUser={authUser}
      />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="xl">
        <Backdrop sx={classes.backdrop} open={state.isLoading.overall}>
          <CircularProgress color="inherit" />
        </Backdrop>

        {state.error && (
          <AlertMessage
            error={state.error}
            severity="error"
            messageTitle={TEXT_ALERT_TITLE_UUPS}
          />
        )}

        {/* Bulk-Aktionen Toolbar */}
        {editMode && state.selectedProductUids.length > 0 && (
          <ProductsQaBulkActions
            selectedCount={state.selectedProductUids.length}
            departments={state.departments}
            onBulkDepartmentChange={hook.onBulkDepartmentChange}
            onBulkDietChange={hook.onBulkDietChange}
            onBulkQaCheck={hook.onBulkQaCheck}
            onMerge={openMergeFromSelection}
            canMerge={state.selectedProductUids.length === 2}
          />
        )}

        <ProductsTable
          editMode={editMode}
          products={state.products}
          departments={state.departments}
          units={state.units}
          newestProductUids={state.newestProductUids}
          issueFlags={state.issueFlags}
          onProductChange={hook.onProductChange}
          onQaToggle={hook.onQaToggle}
          onConvertProductToMaterial={handleConvertProductToMaterial}
          onDeleteProduct={handleDeleteProduct}
          onSelectionChange={hook.onSelectionChange}
          selectedProductUids={state.selectedProductUids}
          authUser={authUser}
          similarProducts={state.similarProducts}
          onOpenMergeDialog={openMergeDialog}
          onClearDuplicates={hook.onClearDuplicates}
          onDismissDuplicate={hook.onDismissDuplicate}
        />
        <CustomSnackbar
          message={state.snackbar.message}
          severity={state.snackbar.severity}
          snackbarOpen={state.snackbar.open}
          handleClose={hook.handleSnackbarClose}
        />
      </Container>

      {/* Merge-Dialog */}
      {mergeDialogOpen && (
        <DialogMergeProducts
          open={mergeDialogOpen}
          onClose={() => setMergeDialogOpen(false)}
          products={state.products}
          sourceProductUid={mergeSourceUid}
          targetProductUid={mergeTargetUid}
          onMerge={hook.onMergeProducts}
        />
      )}

      {/* Synonym-Dialog */}
      {synonymDialogOpen && (
        <DialogSynonymPairs
          open={synonymDialogOpen}
          onClose={() => setSynonymDialogOpen(false)}
          synonymPairs={state.synonymPairs}
          onReload={hook.onLoadSynonyms}
        />
      )}
    </React.Fragment>
  );
};

/* ===================================================================
// ============================ Buttons ==============================
// =================================================================== */
/**
 * Props für die Schaltflächen-Zeile der Produkt-Seite.
 */
interface ProductsButtonRowProps {
  editMode: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onLoadNewestProducts: () => void;
  onFindDuplicates: () => void;
  onManageSynonyms: () => void;
  showLoadNewestProducts: boolean;
  authUser: AuthUser;
}

/**
 * Schaltflächen-Zeile für die Produkt-Seite.
 * Zeigt je nach Modus Edit/Save/Cancel-Buttons, Neueste-Produkte-Toggle,
 * Duplikaterkennung und Synonym-Verwaltung.
 */
const ProductsButtonRow = ({
  editMode,
  onEdit,
  onCancel,
  onSave,
  onLoadNewestProducts,
  onFindDuplicates,
  onManageSynonyms,
  showLoadNewestProducts,
  authUser,
}: ProductsButtonRowProps) => {
  const isAdmin = authUser.roles.includes(Roles.admin);
  return (
    <ButtonRow
      key="action_buttons"
      buttons={[
        {
          id: "edit",
          hero: true,
          visible:
            !editMode &&
            (authUser.roles.includes(Roles.communityLeader) || isAdmin),
          label: TEXT_EDIT,
          variant: "contained",
          color: "primary",
          onClick: onEdit,
        },
        {
          id: "findDuplicates",
          hero: true,
          visible: isAdmin && !editMode,
          label: TEXT_FIND_DUPLICATES,
          variant: "outlined",
          color: "primary",
          onClick: onFindDuplicates,
        },
        {
          id: "manageSynonyms",
          hero: true,
          visible: isAdmin && !editMode,
          label: TEXT_MANAGE_SYNONYMS,
          variant: "outlined",
          color: "primary",
          onClick: onManageSynonyms,
        },
        {
          id: "newestProducts",
          hero: true,
          visible: showLoadNewestProducts && !editMode,
          label: TEXT_SHOW_ONLY_NEWEST_PRODUCTS,
          variant: "outlined",
          color: "primary",
          onClick: onLoadNewestProducts,
        },
        {
          id: "showAll",
          hero: true,
          visible: !showLoadNewestProducts && !editMode,
          label: TEXT_SHOW_ALL_PRODUCTS,
          variant: "outlined",
          color: "primary",
          onClick: onLoadNewestProducts,
        },
        {
          id: "save",
          hero: true,
          visible: editMode,
          label: TEXT_SAVE,
          variant: "contained",
          color: "primary",
          onClick: onSave,
        },
        {
          id: "cancel",
          hero: true,
          visible: editMode,
          label: TEXT_CANCEL,
          variant: "outlined",
          color: "primary",
          onClick: onCancel,
        },
      ]}
    />
  );
};

/* ===================================================================
// =========================== Produkte Panel ========================
// =================================================================== */

/**
 * Props für die Produkte-Tabelle.
 */
interface ProductsTableProps {
  products: Product[];
  departments: Department[];
  units: Unit[];
  newestProductUids: string[];
  issueFlags: ProductIssue[];
  editMode: boolean;
  onProductChange: (product: Product) => void;
  onQaToggle: (uid: string, checked: boolean) => void;
  onConvertProductToMaterial: (product: Product) => void;
  onDeleteProduct: (product: Product) => void;
  onSelectionChange: (uids: string[]) => void;
  selectedProductUids: string[];
  authUser: AuthUser;
  similarProducts: {
    product_a_id: string;
    product_a_name: string;
    product_b_id: string;
    product_b_name: string;
    similarity: number;
    match_type: string;
  }[];
  onOpenMergeDialog: (sourceUid: string, targetUid: string) => void;
  onClearDuplicates: () => void;
  onDismissDuplicate: (productAId: string, productBId: string) => void;
}

/**
 * UI-Zeile für die Produkte-Tabelle.
 */
interface ProductLineUi {
  uid: Product["uid"];
  name: Product["name"];
  departmentName: Department["name"];
  departmentUid: string;
  shoppingUnit: string;
  containsLactose: boolean;
  containsGluten: boolean;
  diet: Diet;
  usable: boolean;
  qaChecked: boolean;
  issueCount: number;
  issueTexts: string;
}

/**
 * Tabellen-Komponente für die Produkt-Verwaltung mit QA-Erweiterungen.
 * Unterstützt Inline-Bearbeitung aller Felder, Multi-Select,
 * QA-Tracking und Duplikaterkennung.
 */
const ProductsTable = ({
  products,
  departments,
  units,
  newestProductUids,
  issueFlags,
  editMode,
  onProductChange,
  onQaToggle,
  onConvertProductToMaterial: onConvertProductToMaterialSuper,
  onDeleteProduct: onDeleteProductSuper,
  onSelectionChange,
  selectedProductUids,
  authUser,
  similarProducts,
  onOpenMergeDialog,
  onClearDuplicates,
  onDismissDuplicate,
}: ProductsTableProps) => {
  const [searchString, setSearchString] = React.useState("");
  const [qaFilter, setQaFilter] = React.useState<QaFilterStatus>("all");
  const [departmentFilter, setDepartmentFilter] = React.useState("");
  const [showIssuesOnly, setShowIssuesOnly] = React.useState(false);
  const [productPopUpValues, setProductPopUpValues] =
    React.useState(PRODUCT_POPUP_VALUES);
  const [contextMenuAnchorElement, setContextMenuAnchorElement] =
    React.useState<HTMLElement | null>(null);
  const [contextMenuProductUid, setContextMenuProductUid] =
    React.useState("");
  const [paginationModel, setPaginationModel] = React.useState({
    page: 0,
    pageSize: 100,
  });

  const classes = useCustomStyles();
  const theme = useTheme();

  // Issue-Flags als Map für schnellen Zugriff
  const issueFlagMap = React.useMemo(() => {
    const map = new Map<string, ProductIssue>();
    issueFlags.forEach((issue) => map.set(issue.productUid, issue));
    return map;
  }, [issueFlags]);

  /* ------------------------------------------
  // Daten für UI aufbereiten
  // ------------------------------------------ */
  const prepareProductsListForUi = (
    productList: Product[],
  ): ProductLineUi[] => {
    return productList.map((product) => {
      const issueFlag = issueFlagMap.get(product.uid);
      return {
        uid: product.uid,
        name: product.name,
        departmentName: product.department.name,
        departmentUid: product.department.uid,
        shoppingUnit: product.shoppingUnit,
        containsLactose: product.dietProperties?.allergens?.includes(
          Allergen.Lactose,
        ),
        containsGluten: product.dietProperties?.allergens?.includes(
          Allergen.Gluten,
        ),
        diet: product.dietProperties.diet,
        usable: product.usable,
        qaChecked: product.qaChecked,
        issueCount: issueFlag?.issues.length ?? 0,
        issueTexts: issueFlag?.issues.join(", ") ?? "",
      };
    });
  };

  /* ------------------------------------------
  // Gefilterte Produkte
  // ------------------------------------------ */
  const filteredProducts = React.useMemo(() => {
    let result = products;

    // Textsuche
    if (searchString) {
      const lower = searchString.toLowerCase();
      result = result.filter(
        (product) =>
          product.name.toLowerCase().includes(lower) ||
          product.department?.name?.toLowerCase().includes(lower) ||
          product.shoppingUnit?.toLowerCase().includes(lower),
      );
    }

    // Neueste Produkte
    if (newestProductUids.length > 0) {
      result = result.filter((product) =>
        newestProductUids.includes(product.uid),
      );
    }

    // QA-Filter
    if (qaFilter === "checked") {
      result = result.filter((product) => product.qaChecked);
    } else if (qaFilter === "unchecked") {
      result = result.filter((product) => !product.qaChecked);
    }

    // Abteilungs-Filter
    if (departmentFilter) {
      result = result.filter(
        (product) => product.department.uid === departmentFilter,
      );
    }

    // Nur Produkte mit Problemen
    if (showIssuesOnly) {
      const issueUids = new Set(issueFlags.map((issue) => issue.productUid));
      result = result.filter((product) => issueUids.has(product.uid));
    }

    return result;
  }, [
    products,
    searchString,
    newestProductUids,
    qaFilter,
    departmentFilter,
    showIssuesOnly,
    issueFlags,
  ]);

  const filteredProductsUi = React.useMemo(
    () => prepareProductsListForUi(filteredProducts),
    [filteredProducts, editMode, issueFlagMap],
  );

  /* ------------------------------------------
  // DataGrid Spalten
  // ------------------------------------------ */
  const dataGridColumns: GridColDef[] = React.useMemo(
    () => [
      {
        field: "open",
        headerName: TEXT_OPEN,
        sortable: false,
        width: 60,
        renderCell: (params) => {
          const onClick = () => openPopUp(params.id as string);
          return (
            <IconButton
              aria-label="Produkt öffnen"
              sx={{margin: theme.spacing(1)}}
              size="small"
              disabled={!editMode}
              onClick={onClick}
            >
              <EditIcon fontSize="inherit" />
            </IconButton>
          );
        },
      },
      {
        field: "uid",
        headerName: TEXT_UID,
        editable: false,
        width: 200,
        cellClassName: () => `super-app ${classes.typographyCode}`,
      },
      {
        field: "name",
        headerName: TEXT_NAME,
        editable: false,
        width: 200,
        renderCell: (params) => {
          if (!editMode) return params.value;
          return (
            <TextField
              variant="standard"
              size="small"
              fullWidth
              value={params.value as string}
              onChange={(event) => {
                const product = products.find(
                  (candidate) => candidate.uid === params.id,
                );
                if (product) {
                  onProductChange({...product, name: event.target.value});
                }
              }}
              InputProps={{disableUnderline: true}}
              sx={{fontSize: "0.875rem"}}
            />
          );
        },
      },
      {
        field: "departmentName",
        headerName: TEXT_DEPARTMENT,
        editable: false,
        width: 200,
        renderCell: (params) => {
          if (!editMode || departments.length === 0) return params.value;
          return (
            <Autocomplete
              size="small"
              fullWidth
              options={departments}
              getOptionLabel={(option) => option.name}
              value={
                departments.find(
                  (department) =>
                    department.uid === (params.row as ProductLineUi).departmentUid,
                ) ?? undefined
              }
              onChange={(_event, newValue) => {
                const product = products.find(
                  (candidate) => candidate.uid === params.id,
                );
                if (product && newValue) {
                  onProductChange({
                    ...product,
                    department: {uid: newValue.uid, name: newValue.name},
                  });
                }
              }}
              renderInput={(inputParams) => (
                <TextField
                  {...inputParams}
                  variant="standard"
                  InputProps={{
                    ...inputParams.InputProps,
                    disableUnderline: true,
                  }}
                />
              )}
              disableClearable
              sx={{fontSize: "0.875rem"}}
            />
          );
        },
      },
      {
        field: "shoppingUnit",
        headerName: TEXT_SHOPPING_UNIT,
        editable: false,
        width: 150,
        renderCell: (params) => {
          if (!editMode || units.length === 0) return params.value;
          return (
            <Autocomplete
              size="small"
              fullWidth
              options={units}
              getOptionLabel={(option) =>
                option.name ? `${option.name} (${option.key})` : ""
              }
              value={
                units.find(
                  (unit) => unit.key === (params.value as string),
                ) ?? units.find((unit) => unit.key === "") ?? null
              }
              onChange={(_event, newValue) => {
                const product = products.find(
                  (candidate) => candidate.uid === params.id,
                );
                if (product) {
                  onProductChange({
                    ...product,
                    shoppingUnit: newValue?.key ?? "",
                  });
                }
              }}
              renderInput={(inputParams) => (
                <TextField
                  {...inputParams}
                  variant="standard"
                  InputProps={{
                    ...inputParams.InputProps,
                    disableUnderline: true,
                  }}
                />
              )}
              sx={{fontSize: "0.875rem"}}
            />
          );
        },
      },
      {
        field: "containsLactose",
        headerName: TEXT_HAS_LACTOSE,
        editable: false,
        width: 100,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_" + Allergen.Lactose + "_" + params.id}
            name={"checkbox_" + Allergen.Lactose + "_" + params.id}
          />
        ),
      },
      {
        field: "containsGluten",
        headerName: TEXT_HAS_GLUTEN,
        editable: false,
        width: 100,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_" + Allergen.Gluten + "_" + params.id}
            name={"checkbox_" + Allergen.Gluten + "_" + params.id}
          />
        ),
      },
      {
        field: "diet",
        headerName: TEXT_DIET,
        editable: false,
        width: 150,
        renderCell: (params) => {
          if (!editMode) {
            return TEXT_DIET_TYPES[params.value as number];
          }
          return (
            <Select
              size="small"
              fullWidth
              variant="standard"
              value={params.value as number}
              onChange={(event: SelectChangeEvent<number>) => {
                const product = products.find(
                  (candidate) => candidate.uid === params.id,
                );
                if (product) {
                  onProductChange({
                    ...product,
                    dietProperties: {
                      ...product.dietProperties,
                      diet: event.target.value as Diet,
                    },
                  });
                }
              }}
              disableUnderline
            >
              <MenuItem value={Diet.Meat}>{TEXT_DIET_TYPES[Diet.Meat]}</MenuItem>
              <MenuItem value={Diet.Vegetarian}>
                {TEXT_DIET_TYPES[Diet.Vegetarian]}
              </MenuItem>
              <MenuItem value={Diet.Vegan}>{TEXT_DIET_TYPES[Diet.Vegan]}</MenuItem>
            </Select>
          );
        },
      },
      {
        field: "usable",
        headerName: TEXT_USABLE,
        editable: false,
        width: 80,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={handleCheckboxChange}
            key={"checkbox_usable_" + params.id}
            name={"checkbox_usable_" + params.id}
          />
        ),
      },
      {
        field: "qaChecked",
        headerName: TEXT_QA_CHECKED,
        editable: false,
        width: 80,
        renderCell: (params) => (
          <Checkbox
            checked={params.value as boolean}
            disabled={!editMode}
            onChange={(event) =>
              onQaToggle(params.id as string, event.target.checked)
            }
          />
        ),
      },
      {
        field: "issueCount",
        headerName: TEXT_QA_ISSUES,
        editable: false,
        width: 80,
        renderCell: (params) => {
          const count = params.value as number;
          if (count === 0) return null;
          return (
            <Tooltip
              title={(params.row as ProductLineUi).issueTexts}
              arrow
            >
              <Box
                sx={{
                  display: "flex",
                  alignItems: "center",
                  gap: 0.5,
                  color: "warning.main",
                }}
              >
                <WarningIcon fontSize="small" />
                <Typography variant="body2">{count}</Typography>
              </Box>
            </Tooltip>
          );
        },
      },
      {
        field: "context",
        headerName: "",
        editable: false,
        width: 60,
        renderCell: (params) => {
          const onClick = (event: React.MouseEvent<HTMLElement>) =>
            openContextMenu(event, params.id as string);
          return (
            <IconButton
              aria-label="Kontextmenü"
              sx={{margin: theme.spacing(1)}}
              size="small"
              disabled={!editMode}
              onClick={onClick}
            >
              <MoreVertIcon fontSize="inherit" />
            </IconButton>
          );
        },
      },
    ],
    [editMode, theme, departments, units, products, issueFlagMap],
  );

  /* ------------------------------------------
  // Suche
  // ------------------------------------------ */
  const clearSearchString = () => setSearchString("");
  const updateSearchString = (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>,
  ) => setSearchString(event.target.value);

  /* ------------------------------------------
  // Checkboxen-Edit (immutabel)
  // ------------------------------------------ */
  const handleCheckboxChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const parts = event.target.name.split("_");
    const product = products.find(
      (candidate) => candidate.uid === parts[2],
    );
    if (!product) return;

    if (parts[1] === "usable") {
      onProductChange({...product, usable: event.target.checked});
    } else {
      const allergen = parseInt(parts[1]) as Allergen;
      const current = product.dietProperties.allergens;
      const updated = event.target.checked
        ? [...current, allergen]
        : current.filter((candidate) => candidate !== allergen);
      onProductChange({
        ...product,
        dietProperties: {...product.dietProperties, allergens: updated},
      });
    }
  };

  /* ------------------------------------------
  // Selection
  // ------------------------------------------ */
  const handleSelectionChange = (selectionModel: GridRowSelectionModel) => {
    onSelectionChange(selectionModel as string[]);
  };

  /* ------------------------------------------
  // Context-Menü
  // ------------------------------------------ */
  const openContextMenu = (
    event: React.MouseEvent<HTMLElement>,
    productUid: Product["uid"],
  ) => {
    setContextMenuAnchorElement(event.currentTarget);
    setContextMenuProductUid(productUid);
  };
  const closeContextMenu = () => {
    setContextMenuAnchorElement(null);
    setContextMenuProductUid("");
  };
  const onConvertProductToMaterial = () => {
    const product = products.find(
      (candidate) => candidate.uid === contextMenuProductUid,
    );
    if (!product) return;
    onConvertProductToMaterialSuper(product);
    closeContextMenu();
  };
  const onDeleteProduct = () => {
    const product = products.find(
      (candidate) => candidate.uid === contextMenuProductUid,
    );
    if (!product) return;
    closeContextMenu();
    onDeleteProductSuper(product);
  };

  /* ------------------------------------------
  // PopUp
  // ------------------------------------------ */
  const openPopUp = (productUid: string) => {
    const product = products.find(
      (candidate) => candidate.uid === productUid,
    ) as Product;
    if (!product) return;

    setProductPopUpValues({
      productUid: product.uid,
      productName: product.name,
      department: {
        uid: product.department.uid,
        name: product.department.name,
      },
      shoppingUnit: {
        key: product.shoppingUnit,
        name: "",
        dimension: UnitDimension.dimensionless,
      },
      dietProperties: product.dietProperties,
      usable: product.usable,
      popUpOpen: true,
    });
  };
  const onPopUpClose = () => setProductPopUpValues(PRODUCT_POPUP_VALUES);
  const onPopUpOk = (changedProduct: Product) => {
    onProductChange({
      ...changedProduct,
      shoppingUnit: changedProduct.shoppingUnit || "",
    });
    setProductPopUpValues(PRODUCT_POPUP_VALUES);
  };
  const onPopUpChooseExisting = () => {
    // Intentionally empty — im EDIT-Modus nicht verwendet
  };

  // Eindeutige Abteilungen für den Filter (aus den aktuellen Produkten)
  const availableDepartments = React.useMemo(() => {
    const deptMap = new Map<string, string>();
    products.forEach((product) => {
      if (product.department.uid && product.department.name) {
        deptMap.set(product.department.uid, product.department.name);
      }
    });
    return Array.from(deptMap.entries())
      .map(([uid, name]) => ({uid, name}))
      .sort((entryA, entryB) => entryA.name.localeCompare(entryB.name));
  }, [products]);

  return (
    <React.Fragment>
      {/* Erweiterte Filterleiste */}
      <ProductsQaFilterBar
        searchString={searchString}
        onUpdateSearchString={updateSearchString}
        onClearSearchString={clearSearchString}
        qaFilter={qaFilter}
        onQaFilterChange={setQaFilter}
        departmentFilter={departmentFilter}
        onDepartmentFilterChange={setDepartmentFilter}
        availableDepartments={availableDepartments}
        showIssuesOnly={showIssuesOnly}
        onShowIssuesOnlyChange={setShowIssuesOnly}
        totalCount={products.length}
        filteredCount={filteredProducts.length}
      />

      {/* Duplikate-Panel */}
      {similarProducts.length > 0 && (
        <DuplicatesPanel
          similarProducts={similarProducts}
          onOpenMergeDialog={onOpenMergeDialog}
          onClearDuplicates={onClearDuplicates}
          onDismissDuplicate={onDismissDuplicate}
        />
      )}

      {/* Höhe füllt den Viewport abzüglich AppBar (64px) und etwas Platz für Filter/Padding */}
      <Box sx={{height: "calc(100vh - 200px)", width: "100%"}}>
        <DataGrid
          rows={filteredProductsUi}
          columns={dataGridColumns}
          columnVisibilityModel={{uid: false}}
          getRowId={(row) => row.uid}
          pagination
          checkboxSelection={editMode}
          rowSelectionModel={selectedProductUids}
          onRowSelectionModelChange={handleSelectionChange}
          localeText={deDE.components.MuiDataGrid.defaultProps.localeText}
          getRowClassName={(params) => {
            if (params.row?.disabled) {
              return `super-app ${classes.dataGridDisabled}`;
            }
            return `super-app-theme`;
          }}
          paginationModel={paginationModel}
          onPaginationModelChange={setPaginationModel}
          pageSizeOptions={[20, 50, 100]}
        />
      </Box>

      <Menu
        open={Boolean(contextMenuAnchorElement)}
        keepMounted
        anchorEl={contextMenuAnchorElement}
        onClose={closeContextMenu}
      >
        <MenuItem onClick={onConvertProductToMaterial}>
          <ListItemIcon>
            <CachedIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_CONVERT_TO_MATERIAL}
          </Typography>
        </MenuItem>
        <MenuItem onClick={onDeleteProduct}>
          <ListItemIcon>
            <DeleteIcon />
          </ListItemIcon>
          <Typography variant="inherit" noWrap>
            {TEXT_DELETE_PRODUCT}
          </Typography>
        </MenuItem>
      </Menu>
      <DialogProduct
        dialogType={ProductDialog.EDIT}
        productUid={productPopUpValues.productUid}
        productName={productPopUpValues.productName}
        productDietProperties={productPopUpValues.dietProperties}
        productUsable={productPopUpValues.usable}
        products={products}
        dialogOpen={productPopUpValues.popUpOpen}
        handleOk={onPopUpOk}
        handleClose={onPopUpClose}
        handleChooseExisting={onPopUpChooseExisting}
        selectedDepartment={
          departments.find(
            (department) =>
              department.uid === productPopUpValues.department.uid,
          )!
        }
        selectedUnit={productPopUpValues.shoppingUnit}
        usable={productPopUpValues.usable}
        departments={departments}
        units={units}
        authUser={authUser}
      />
    </React.Fragment>
  );
};

/* ===================================================================
// ===================== Duplikate-Panel =============================
// =================================================================== */
/**
 * Props für das Duplikate-Panel.
 */
interface DuplicatesPanelProps {
  similarProducts: {
    product_a_id: string;
    product_a_name: string;
    product_b_id: string;
    product_b_name: string;
    similarity: number;
    match_type: string;
  }[];
  onOpenMergeDialog: (sourceUid: string, targetUid: string) => void;
  onClearDuplicates: () => void;
  onDismissDuplicate: (productAId: string, productBId: string) => void;
}

/**
 * Panel zur Anzeige erkannter Duplikate mit Merge- und Bestätigungs-Button pro Paar.
 */
const DuplicatesPanel = ({
  similarProducts,
  onOpenMergeDialog,
  onClearDuplicates,
  onDismissDuplicate,
}: DuplicatesPanelProps) => {
  return (
    <Card sx={{marginBottom: 2, backgroundColor: "action.hover"}}>
      <CardContent>
        <Box
          sx={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 1,
          }}
        >
          <Typography variant="h6">
            <FindReplaceIcon
              sx={{verticalAlign: "middle", marginRight: 1}}
            />
            {similarProducts.length} ähnliche Paare gefunden
          </Typography>
          <IconButton onClick={onClearDuplicates} size="small">
            ✕
          </IconButton>
        </Box>
        <Box
          sx={{
            maxHeight: 300,
            overflow: "auto",
          }}
        >
          {similarProducts.map((pair) => (
            <Box
              key={`${pair.product_a_id}-${pair.product_b_id}`}
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: 1,
                borderBottom: "1px solid",
                borderColor: "divider",
              }}
            >
              <Box sx={{flex: 1}}>
                <Typography variant="body2">
                  <strong>{pair.product_a_name}</strong> ↔{" "}
                  <strong>{pair.product_b_name}</strong>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {pair.match_type === "synonym"
                    ? "Synonym-Treffer"
                    : `Ähnlichkeit: ${(pair.similarity * 100).toFixed(0)}%`}
                </Typography>
              </Box>
              <Box sx={{display: "flex", gap: 0.5}}>
                <Tooltip title="Zusammenführen" arrow>
                  <IconButton
                    size="small"
                    color="primary"
                    onClick={() =>
                      onOpenMergeDialog(pair.product_a_id, pair.product_b_id)
                    }
                  >
                    <CachedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Kein Duplikat — nicht mehr anzeigen" arrow>
                  <IconButton
                    size="small"
                    color="success"
                    onClick={() =>
                      onDismissDuplicate(pair.product_a_id, pair.product_b_id)
                    }
                  >
                    <CheckCircleOutlineIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>
          ))}
        </Box>
      </CardContent>
    </Card>
  );
};

export {ProductsPage};
