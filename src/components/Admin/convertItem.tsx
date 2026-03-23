/**
 * ConvertItemPage — Admin-Seite zum Konvertieren von Produkten in Materialien
 * und umgekehrt.
 *
 * Zwei Tabs: Produkt → Material und Material → Produkt. Ruft die
 * Postgres-RPCs über das AdminOperationsRepository auf.
 */
import React from "react";
import * as Sentry from "@sentry/browser";

import {
  Product,
  Allergen,
  Diet,
  DietProperties,
} from "../Product/product.types";
import {Material, MaterialType} from "../Material/material.types";
import Department from "../Department/department.class";
import {Unit, UnitDimension} from "../Unit/unit.class";

import {PageTitle} from "../Shared/pageTitle";
import {SYSTEM_BREADCRUMB} from "./system";
import {AlertMessage} from "../Shared/AlertMessage";
import {ProductAutocomplete} from "../Product/productAutocomplete";
import {MaterialAutocomplete} from "../Material/materialAutocomplete";
import {DepartmentAutocomplete} from "../Department/departmentAutocomplete";
import {UnitAutocomplete} from "../Unit/unitAutocomplete";
import {MaterialDetailList, ProductDetailList} from "./mergeItems";
import {useCustomStyles} from "../../constants/styles";
import {useDatabase} from "../Database/DatabaseContext";

import {
  CONVERT_ITEM as TEXT_CONVERT_ITEM,
  ALERT_TITLE_UUPS as TEXT_ALERT_TITLE_UUPS,
  PRODUCT as TEXT_PRODUCT,
  MATERIAL as TEXT_MATERIAL,
  LOG as TEXT_LOG,
  MERGE_PRODUCT_SELECTION as TEXT_MERGE_PRODUCT_SELECTION,
  MERGE_MATERIAL_SELECTION as TEXT_MERGE_MATERIAL_SELECTION,
  CONVERT_ITEM_EXPLANATION as TEXT_CONVERT_ITEM_EXPLANATION,
  CHANGED_DOCUMENTS as TEXT_CHANGED_DOCUMENTS,
  MATERIAL_TYPE_CONSUMABLE as TEXT_MATERIAL_TYPE_CONSUMABLE,
  MATERIAL_TYPE_USAGE as TEXT_MATERIAL_TYPE_USAGE,
  MATERIAL_TYPE as TEXT_MATERIAL_TYPE,
  PRODUCT_PROPERTY as TEXT_PRODUCT_PROPERTY,
  INTOLERANCES as TEXT_INTOLERANCES,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  IS_MEAT as TEXT_IS_MEAT,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  IS_VEGAN as TEXT_IS_VEGAN,
} from "../../constants/text";
import {
  Backdrop,
  Button,
  Card,
  CardContent,
  CircularProgress,
  Container,
  FormControl,
  FormControlLabel,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListSubheader,
  Radio,
  RadioGroup,
  Typography,
  Tab,
  Tabs,
  useTheme,
  FormLabel,
  FormGroup,
  Checkbox,
  AutocompleteChangeReason,
} from "@mui/material";

import Grid from "@mui/material/Grid";

import {
  ConvertProductToMaterialResult,
  ConvertMaterialToProductResult,
} from "../Database/Repository/AdminOperationsRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/** Zuordnung numerischer MaterialType-Wert → DB-ENUM-String für das RPC. */
const MATERIAL_TYPE_TO_DB: Record<number, string> = {
  0: "none",
  1: "consumable",
  2: "usage",
};

enum ReducerActions {
  PRODUCTS_FETCH_INIT = "PRODUCTS_FETCH_INIT",
  PRODUCTS_FETCH_SUCCESS = "PRODUCTS_FETCH_SUCCESS",
  PRODUCT_CONVERT_START = "PRODUCT_CONVERT_START",
  PRODUCT_CONVERT_FINISHED = "PRODUCT_CONVERT_FINISHED",
  PRODUCTS_CHANGE_PRODUCT = "PRODUCTS_CHANGE_PRODUCT",
  CHANGE_MATERIAL_TYPE = "CHANGE_MATERIAL_TYPE",
  MATERIALS_FETCH_INIT = "MATERIALS_FETCH_INIT",
  MATERIALS_FETCH_SUCCESS = "MATERIALS_FETCH_SUCCESS",
  MATERIALS_CONVERT_START = "MATERIALS_CONVERT_START",
  MATERIALS_CONVERT_FINISHED = "MATERIALS_CONVERT_FINISHED",
  MATERIALS_CHANGE_MATERIAL = "MATERIALS_CHANGE_MATERIAL",
  MATERIAL_CHANGE_PRODUCT_PROPERTY = "MATERIAL_CHANGE_PRODUCT_PROPERTY",
  GENERIC_ERROR = "GENERIC_ERROR",
}

enum TabValue {
  products,
  materials,
}

/** Konvertierungsprotokoll für die Anzeige nach einer Produkt→Material Konvertierung. */
type ProductToMaterialProtocol = {
  kind: "productToMaterial";
  productName: string;
  result: ConvertProductToMaterialResult;
};

/** Konvertierungsprotokoll für die Anzeige nach einer Material→Produkt Konvertierung. */
type MaterialToProductProtocol = {
  kind: "materialToProduct";
  materialName: string;
  result: ConvertMaterialToProductResult;
};

type ConvertProtocol = ProductToMaterialProtocol | MaterialToProductProtocol;

/* ------------------------------------------
// Diskriminierte Union für Reducer-Aktionen
// ------------------------------------------ */
type DispatchAction =
  | {type: ReducerActions.PRODUCTS_FETCH_INIT}
  | {type: ReducerActions.PRODUCTS_FETCH_SUCCESS; payload: Product[]}
  | {type: ReducerActions.PRODUCT_CONVERT_START}
  | {
      type: ReducerActions.PRODUCT_CONVERT_FINISHED;
      payload: ProductToMaterialProtocol;
    }
  | {
      type: ReducerActions.PRODUCTS_CHANGE_PRODUCT;
      payload: {value: Product | null};
    }
  | {type: ReducerActions.CHANGE_MATERIAL_TYPE; payload: {value: MaterialType}}
  | {type: ReducerActions.MATERIALS_FETCH_INIT}
  | {
      type: ReducerActions.MATERIALS_FETCH_SUCCESS;
      payload: {
        units: Unit[];
        materials: Material[];
        departments: Department[];
      };
    }
  | {type: ReducerActions.MATERIALS_CONVERT_START}
  | {
      type: ReducerActions.MATERIALS_CONVERT_FINISHED;
      payload: MaterialToProductProtocol;
    }
  | {
      type: ReducerActions.MATERIALS_CHANGE_MATERIAL;
      payload: {value: Material | null};
    }
  | {
      type: ReducerActions.MATERIAL_CHANGE_PRODUCT_PROPERTY;
      payload: {key: string; value: unknown};
    }
  | {type: ReducerActions.GENERIC_ERROR; payload: Error};

type State = {
  products: Product[];
  materials: Material[];
  departments: Department[];
  units: Unit[];
  product: {uid: string; name: string};
  material: {uid: string; name: string};
  materialProperty: {type: MaterialType};
  productProperty: {
    department: Department;
    unit: Unit;
    dietProperties: DietProperties;
  };
  convertProtocol: ConvertProtocol | null;
  isLoading: boolean;
  isConverting: boolean;
  error: Error | null;
};

const initialState: State = {
  products: [],
  materials: [],
  departments: [],
  units: [],
  product: {uid: "", name: ""},
  material: {uid: "", name: ""},
  materialProperty: {type: MaterialType.none},
  productProperty: {
    department: {uid: "", name: "", pos: 0, usable: true},
    unit: {key: "", name: "", dimension: UnitDimension.dimensionless},
    dietProperties: {allergens: [], diet: Diet.Meat},
  },
  convertProtocol: null,
  isLoading: false,
  isConverting: false,
  error: null,
};

const convertItemReducer = (state: State, action: DispatchAction): State => {
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
        units: action.payload.units,
        materials: action.payload.materials,
        departments: action.payload.departments,
      };
    case ReducerActions.PRODUCTS_CHANGE_PRODUCT: {
      const selectedProduct = action.payload.value;
      return {
        ...state,
        product: selectedProduct
          ? {uid: selectedProduct.uid, name: selectedProduct.name}
          : {uid: "", name: ""},
        error: null,
      };
    }
    case ReducerActions.MATERIALS_CHANGE_MATERIAL: {
      const selectedMaterial = action.payload.value;
      return {
        ...state,
        material: selectedMaterial
          ? {uid: selectedMaterial.uid, name: selectedMaterial.name}
          : {uid: "", name: ""},
        error: null,
      };
    }
    case ReducerActions.CHANGE_MATERIAL_TYPE:
      return {
        ...state,
        materialProperty: {
          type: action.payload.value,
        },
      };
    case ReducerActions.MATERIAL_CHANGE_PRODUCT_PROPERTY:
      return {
        ...state,
        productProperty: {
          ...state.productProperty,
          [action.payload.key as string]: action.payload.value,
        },
      };
    case ReducerActions.PRODUCT_CONVERT_START:
    case ReducerActions.MATERIALS_CONVERT_START:
      return {...state, isConverting: true};
    case ReducerActions.PRODUCT_CONVERT_FINISHED: {
      // Konvertiertes Produkt aus der Liste entfernen
      const filteredProducts = state.products.filter(
        (product) => product.uid !== state.product.uid
      );
      return {
        ...state,
        convertProtocol: action.payload,
        products: filteredProducts,
        isConverting: false,
        error: null,
      };
    }
    case ReducerActions.MATERIALS_CONVERT_FINISHED: {
      // Konvertiertes Material aus der Liste entfernen
      const filteredMaterials = state.materials.filter(
        (material) => material.uid !== state.material.uid
      );
      return {
        ...state,
        convertProtocol: action.payload,
        materials: filteredMaterials,
        isConverting: false,
        error: null,
      };
    }
    case ReducerActions.GENERIC_ERROR:
      return {
        ...state,
        isConverting: false,
        isLoading: false,
        error: action.payload,
      };
    default:
      throw new Error(`Unbekannter ActionType im convertItemReducer`);
  }
};

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/**
 * Admin-Seite zum Konvertieren von Produkten in Materialien und umgekehrt.
 *
 * Bietet zwei Tabs: Produkt→Material (mit Materialtyp-Auswahl) und
 * Material→Produkt (mit Abteilungs-, Einheits- und Diät-Auswahl).
 * Die Konvertierung erfolgt atomar über Postgres-RPC-Funktionen.
 */
const ConvertItemPage = () => {
  const database = useDatabase();
  const classes = useCustomStyles();
  const theme = useTheme();

  const [state, dispatch] = React.useReducer(convertItemReducer, initialState);
  const [tabValue, setTabValue] = React.useState(TabValue.products);

  /* ------------------------------------------
  // Produkte aus der DB laden
  // ------------------------------------------ */
  React.useEffect(() => {
    dispatch({type: ReducerActions.PRODUCTS_FETCH_INIT});

    database.products
      .getAllProducts({onlyUsable: true})
      .then((result) => {
        // Domain-Objekte auf die Klassenstruktur mappen, da Autocomplete
        // Product-Instanzen erwartet
        const products = result.map((productDomain) => {
          const product: Product = {
            uid: productDomain.uid,
            name: productDomain.name,
            department: {
              uid: productDomain.department.uid,
              name: productDomain.department.name,
            },
            shoppingUnit: productDomain.shoppingUnit,
            dietProperties: {
              allergens: productDomain.dietProperties.allergens,
              diet: productDomain.dietProperties.diet,
            },
            usable: productDomain.usable,
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
  }, [database]);

  /* ------------------------------------------
  // Materialien, Abteilungen und Einheiten laden (beim Tab-Wechsel)
  // ------------------------------------------ */
  React.useEffect(() => {
    const fetchMasterdata = async () => {
      if (tabValue === TabValue.materials && state.units.length === 0) {
        dispatch({type: ReducerActions.MATERIALS_FETCH_INIT});

        try {
          const [materialDomains, departmentDomains, unitDomains] =
            await Promise.all([
              database.materials.getAllMaterials(),
              database.departments.getAllDepartments(),
              database.units.getAllUnits(),
            ]);

          const materials = materialDomains;

          const departments: Department[] = departmentDomains.map(
            (departmentDomain) => ({
              uid: departmentDomain.uid,
              name: departmentDomain.name,
              pos: departmentDomain.pos,
              usable: departmentDomain.usable,
            })
          );

          const units: Unit[] = unitDomains.map((unitDomain) => ({
            key: unitDomain.key,
            name: unitDomain.name,
            dimension: unitDomain.dimension as UnitDimension,
          }));

          dispatch({
            type: ReducerActions.MATERIALS_FETCH_SUCCESS,
            payload: {units, materials, departments},
          });
        } catch (error) {
          Sentry.captureException(error);
          dispatch({
            type: ReducerActions.GENERIC_ERROR,
            payload: error as Error,
          });
        }
      }
    };

    fetchMasterdata();
  }, [tabValue, database, state.units.length]);

  /* ------------------------------------------
  // Änderung der Produkt-Auswahl
  // ------------------------------------------ */
  const onChangeProductSelection = (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Product | null,
    action?: AutocompleteChangeReason
  ) => {
    if (action === "blur") return;
    dispatch({
      type: ReducerActions.PRODUCTS_CHANGE_PRODUCT,
      payload: {value: (newValue as Product) ?? null},
    });
  };

  /* ------------------------------------------
  // Änderung der Material-/Abteilungs-/Einheits-Auswahl
  // ------------------------------------------ */
  const onChangeAutocompleteSelection = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material | Department | Unit | null,
    action?: AutocompleteChangeReason
  ) => {
    if (action === "blur") return;

    let field = "";
    if (event.target.id) {
      field = event.target.id.split("-")[0];
    }

    if (field === "material") {
      dispatch({
        type: ReducerActions.MATERIALS_CHANGE_MATERIAL,
        payload: {value: (newValue as Material) ?? null},
      });
    } else {
      dispatch({
        type: ReducerActions.MATERIAL_CHANGE_PRODUCT_PROPERTY,
        payload: {
          key: event.target.id.split("-")[0],
          value: newValue,
        },
      });
    }
  };

  /* ------------------------------------------
  // Produkt → Material konvertieren
  // ------------------------------------------ */
  const onConvertProductToMaterial = async () => {
    dispatch({type: ReducerActions.PRODUCT_CONVERT_START});

    try {
      const materialTypeDbValue =
        MATERIAL_TYPE_TO_DB[state.materialProperty.type] ?? "consumable";
      const result = await database.adminOps.convertProductToMaterial(
        state.product.uid,
        materialTypeDbValue
      );

      dispatch({
        type: ReducerActions.PRODUCT_CONVERT_FINISHED,
        payload: {
          kind: "productToMaterial",
          productName: state.product.name,
          result,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Material → Produkt konvertieren
  // ------------------------------------------ */
  const onConvertMaterial = async () => {
    dispatch({type: ReducerActions.MATERIALS_CONVERT_START});

    try {
      const result = await database.adminOps.convertMaterialToProduct(
        state.material.uid,
        state.productProperty.department.uid || undefined,
        state.productProperty.unit.key || undefined
      );

      dispatch({
        type: ReducerActions.MATERIALS_CONVERT_FINISHED,
        payload: {
          kind: "materialToProduct",
          materialName: state.material.name,
          result,
        },
      });
    } catch (error) {
      Sentry.captureException(error);
      dispatch({type: ReducerActions.GENERIC_ERROR, payload: error as Error});
    }
  };

  /* ------------------------------------------
  // Materialtyp-Auswahl ändern
  // ------------------------------------------ */
  const onChangeMaterialType = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    dispatch({
      type: ReducerActions.CHANGE_MATERIAL_TYPE,
      payload: {
        value: parseInt(
          (event.target as HTMLInputElement).value
        ) as MaterialType,
      },
    });
  };

  /* ------------------------------------------
  // Allergene ändern
  // ------------------------------------------ */
  const onChangeAllergens = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dietProperties = {...state.productProperty.dietProperties};
    // Allergene-Array kopieren, um Mutation zu vermeiden
    dietProperties.allergens = [...dietProperties.allergens];

    switch (event.target.id) {
      case "dietProperties.allergens.containsLactose":
        if (event.target.checked) {
          dietProperties.allergens.push(Allergen.Lactose);
        } else {
          dietProperties.allergens = dietProperties.allergens.filter(
            (allergen) => allergen !== Allergen.Lactose
          );
        }
        break;
      case "dietProperties.allergens.containsGluten":
        if (event.target.checked) {
          dietProperties.allergens.push(Allergen.Gluten);
        } else {
          dietProperties.allergens = dietProperties.allergens.filter(
            (allergen) => allergen !== Allergen.Gluten
          );
        }
        break;
    }
    dispatch({
      type: ReducerActions.MATERIAL_CHANGE_PRODUCT_PROPERTY,
      payload: {key: "dietProperties", value: dietProperties},
    });
  };

  /* ------------------------------------------
  // Diät-Eigenschaft ändern
  // ------------------------------------------ */
  const onChangeDiet = (event: React.ChangeEvent<HTMLInputElement>) => {
    const dietProperties = {...state.productProperty.dietProperties};
    dietProperties.diet = parseInt(event.target.value);
    dispatch({
      type: ReducerActions.MATERIAL_CHANGE_PRODUCT_PROPERTY,
      payload: {key: "dietProperties", value: dietProperties},
    });
  };

  /* ------------------------------------------
  // Tab-Handler
  // ------------------------------------------ */
  const handleTabChange = (_event: React.SyntheticEvent, newValue: number) => {
    setTabValue(newValue);
  };

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_CONVERT_ITEM} breadcrumbs={[SYSTEM_BREADCRUMB]} />
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
          value={tabValue}
          onChange={handleTabChange}
          centered
          style={{marginBottom: theme.spacing(2)}}
        >
          <Tab label={TEXT_PRODUCT} />
          <Tab label={TEXT_MATERIAL} />
        </Tabs>

        {tabValue === TabValue.products ? (
          <PanelConvertProductToMaterial
            product={state.product}
            products={state.products}
            materialProperty={state.materialProperty}
            isConverting={state.isConverting}
            convertProtocol={
              state.convertProtocol?.kind === "productToMaterial"
                ? state.convertProtocol
                : null
            }
            onChangeProductSelection={onChangeProductSelection}
            onConvertProduct={onConvertProductToMaterial}
            onChangeMaterialType={onChangeMaterialType}
          />
        ) : (
          <PanelConvertMaterialToProduct
            material={state.material}
            materials={state.materials}
            departments={state.departments}
            units={state.units}
            productProperty={state.productProperty}
            isConverting={state.isConverting}
            convertProtocol={
              state.convertProtocol?.kind === "materialToProduct"
                ? state.convertProtocol
                : null
            }
            onChangeAutocompleteSelection={onChangeAutocompleteSelection}
            onConvertMaterial={onConvertMaterial}
            onChangeAllergens={onChangeAllergens}
            onChangeDiet={onChangeDiet}
          />
        )}
      </Container>
    </React.Fragment>
  );
};

/* ===================================================================
// ====================== Convert Product Card =======================
// =================================================================== */

type PanelConvertProductToMaterialProps = {
  product: State["product"];
  products: State["products"];
  materialProperty: State["materialProperty"];
  isConverting: boolean;
  convertProtocol: ProductToMaterialProtocol | null;
  onChangeProductSelection: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Product | null,
    action?: AutocompleteChangeReason,
    objectId?: string
  ) => void;
  onConvertProduct: () => void;
  onChangeMaterialType: (event: React.ChangeEvent<HTMLInputElement>) => void;
};

/**
 * Panel für die Konvertierung eines Produkts in ein Material.
 *
 * Zeigt Produkt-Auswahl, Materialtyp-Selektor, Konvertier-Button
 * und nach erfolgreicher Konvertierung das Ergebnisprotokoll.
 */
const PanelConvertProductToMaterial = ({
  product,
  products,
  materialProperty,
  isConverting,
  convertProtocol,
  onChangeProductSelection,
  onConvertProduct,
  onChangeMaterialType,
}: PanelConvertProductToMaterialProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Typography gutterBottom={true} variant="h5" component="h2">
          {TEXT_MERGE_PRODUCT_SELECTION}
        </Typography>
        <Typography gutterBottom={true}>
          {TEXT_CONVERT_ITEM_EXPLANATION(TEXT_PRODUCT, TEXT_MATERIAL)}
        </Typography>
        <br />
        <ProductAutocomplete
          componentKey={"product"}
          product={product}
          products={products}
          onChange={onChangeProductSelection}
          label={TEXT_PRODUCT}
          allowCreateNewProduct={false}
        />
        <ProductDetailList productUid={product.uid} products={products} />
        <br />
        <Typography variant="subtitle1">{TEXT_MATERIAL_TYPE}</Typography>
        <FormControl component="fieldset">
          <RadioGroup
            aria-label="materialtyp"
            name="materialtype"
            id="materialtype"
            value={materialProperty.type}
            onChange={onChangeMaterialType}
            row
          >
            <FormControlLabel
              value={MaterialType.consumable}
              control={<Radio required />}
              label={TEXT_MATERIAL_TYPE_CONSUMABLE}
              id="materialtype"
            />
            <FormControlLabel
              value={MaterialType.usage}
              control={<Radio required />}
              label={TEXT_MATERIAL_TYPE_USAGE}
              id="materialtype"
            />
          </RadioGroup>
        </FormControl>
        {isConverting && (
          <React.Fragment>
            <br />
            <LinearProgress />
          </React.Fragment>
        )}
        <Button
          fullWidth
          disabled={
            product?.uid === "" || materialProperty.type === MaterialType.none
          }
          variant="contained"
          color="primary"
          sx={classes.submit}
          onClick={onConvertProduct}
        >
          {TEXT_CONVERT_ITEM}
        </Button>
        {convertProtocol !== null && (
          <React.Fragment>
            <br />
            <Grid size={12}>
              <List
                subheader={
                  <ListSubheader component="div" id="subheader-log-result">
                    {TEXT_LOG}
                  </ListSubheader>
                }
              >
                <ListItem divider key={"listItem_product"}>
                  <ListItemText
                    primary={`${TEXT_PRODUCT}: ${convertProtocol.productName}`}
                  />
                </ListItem>
              </List>
              <br />
            </Grid>
            <Grid size={12}>
              <List
                subheader={
                  <ListSubheader component="div" id="subheader-convert-result">
                    {TEXT_CHANGED_DOCUMENTS}
                  </ListSubheader>
                }
              >
                <ListItem divider key={"listItem_newMaterial"}>
                  <ListItemText
                    primary={`Neues Material ID`}
                    secondary={convertProtocol.result.new_material_id}
                  />
                </ListItem>
                <ListItem divider key={"listItem_recipeIngredients"}>
                  <ListItemText
                    primary={`Rezeptzutaten verschoben`}
                    secondary={convertProtocol.result.recipe_ingredients}
                  />
                </ListItem>
                <ListItem divider key={"listItem_shoppingListItems"}>
                  <ListItemText
                    primary={`Einkaufslisteneinträge aktualisiert`}
                    secondary={convertProtocol.result.shopping_list_items}
                  />
                </ListItem>
                <ListItem divider key={"listItem_menueItems"}>
                  <ListItemText
                    primary={`Menüplan-Einträge verschoben`}
                    secondary={convertProtocol.result.menue_items}
                  />
                </ListItem>
              </List>
            </Grid>
          </React.Fragment>
        )}{" "}
      </CardContent>
    </Card>
  );
};

/* ===================================================================
// ===================== Convert Material Card =======================
// =================================================================== */

type PanelConvertMaterialToProductProps = {
  material: State["material"];
  materials: State["materials"];
  departments: State["departments"];
  units: State["units"];
  productProperty: State["productProperty"];
  isConverting: boolean;
  convertProtocol: MaterialToProductProtocol | null;
  onChangeAutocompleteSelection: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Material | Department | Unit | null,
    action?: AutocompleteChangeReason,
    objectId?: string
  ) => void;
  onChangeAllergens: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onChangeDiet: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onConvertMaterial: () => void;
};

/**
 * Panel für die Konvertierung eines Materials in ein Produkt.
 *
 * Zeigt Material-Auswahl, Abteilungs- und Einheitsselektor,
 * Diäteigenschaften-Formular und nach erfolgreicher Konvertierung
 * das Ergebnisprotokoll.
 */
const PanelConvertMaterialToProduct = ({
  material,
  materials,
  departments,
  units,
  productProperty,
  isConverting,
  convertProtocol,
  onChangeAllergens,
  onChangeDiet,
  onChangeAutocompleteSelection,
  onConvertMaterial,
}: PanelConvertMaterialToProductProps) => {
  const classes = useCustomStyles();

  return (
    <Card sx={classes.card} key={"cardInfo"}>
      <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
        <Grid container spacing={2}>
          <Grid size={12}>
            <Typography gutterBottom={true} variant="h5" component="h2">
              {TEXT_MERGE_MATERIAL_SELECTION}
            </Typography>

            <Typography gutterBottom={true}>
              {TEXT_CONVERT_ITEM_EXPLANATION(TEXT_MATERIAL, TEXT_PRODUCT)}
            </Typography>
          </Grid>
          <Grid size={12}>
            <MaterialAutocomplete
              material={material}
              materials={materials}
              allowCreateNewMaterial={false}
              onChange={onChangeAutocompleteSelection}
              disabled={false}
            />
          </Grid>
          <Grid size={12}>
            <MaterialDetailList
              materialUid={material.uid}
              materials={materials}
            />
          </Grid>
          <br />
          <Grid size={12}>
            <DepartmentAutocomplete
              department={productProperty.department}
              departments={departments}
              disabled={false}
              onChange={onChangeAutocompleteSelection}
            />
          </Grid>
          <Grid size={12}>
            <UnitAutocomplete
              unitKey={productProperty.unit.key}
              units={units}
              onChange={onChangeAutocompleteSelection}
            />
          </Grid>
          <br />
          <Grid size={{xs: 12, sm: 6}}>
            <FormControl fullWidth>
              <FormLabel component="legend">{TEXT_INTOLERANCES}</FormLabel>
              <FormGroup>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productProperty.dietProperties?.allergens?.includes(
                        Allergen.Lactose
                      )}
                      onChange={onChangeAllergens}
                      name="dietProperties.allergens.containsLactose"
                      id="dietProperties.allergens.containsLactose"
                    />
                  }
                  label={TEXT_HAS_LACTOSE}
                />
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={productProperty.dietProperties?.allergens?.includes(
                        Allergen.Gluten
                      )}
                      onChange={onChangeAllergens}
                      name="dietProperties.allergens.containsGluten"
                      id="dietProperties.allergens.containsGluten"
                    />
                  }
                  label={TEXT_HAS_GLUTEN}
                />
              </FormGroup>
            </FormControl>
          </Grid>
          <Grid size={{xs: 12, sm: 6}}>
            <FormControl fullWidth>
              <FormGroup>
                <FormLabel component="legend">
                  {TEXT_PRODUCT_PROPERTY}
                </FormLabel>
                <RadioGroup
                  aria-label="Diät"
                  name={"radioGroup_Diet"}
                  key={"radioGroup_Diet"}
                  value={productProperty.dietProperties.diet}
                  onChange={onChangeDiet}
                >
                  <FormControlLabel
                    value={Diet.Meat}
                    control={<Radio size="small" />}
                    label={TEXT_IS_MEAT}
                  />
                  <FormControlLabel
                    value={Diet.Vegetarian}
                    control={<Radio size="small" />}
                    label={TEXT_IS_VEGETARIAN}
                  />
                  <FormControlLabel
                    value={Diet.Vegan}
                    control={<Radio size="small" />}
                    label={TEXT_IS_VEGAN}
                  />
                </RadioGroup>
              </FormGroup>
            </FormControl>
          </Grid>
          {isConverting && (
            <React.Fragment>
              <br />
              <LinearProgress />
            </React.Fragment>
          )}
          <Button
            fullWidth
            disabled={
              material?.uid === "" || productProperty.department.uid === ""
            }
            variant="contained"
            color="primary"
            sx={classes.submit}
            onClick={onConvertMaterial}
          >
            {TEXT_CONVERT_ITEM}
          </Button>
          {convertProtocol !== null && (
            <React.Fragment>
              <br />
              <Grid size={12}>
                <List
                  subheader={
                    <ListSubheader component="div" id="subheader-log-result">
                      {TEXT_LOG}
                    </ListSubheader>
                  }
                >
                  <ListItem divider key={"listItem_material"}>
                    <ListItemText
                      primary={`${TEXT_MATERIAL}: ${convertProtocol.materialName}`}
                    />
                  </ListItem>
                </List>
                <br />
              </Grid>
              <Grid size={12}>
                <List
                  subheader={
                    <ListSubheader
                      component="div"
                      id="subheader-convert-result"
                    >
                      {TEXT_CHANGED_DOCUMENTS}
                    </ListSubheader>
                  }
                >
                  <ListItem divider key={"listItem_newProduct"}>
                    <ListItemText
                      primary={`Neues Produkt ID`}
                      secondary={convertProtocol.result.new_product_id}
                    />
                  </ListItem>
                  <ListItem divider key={"listItem_recipeMaterials"}>
                    <ListItemText
                      primary={`Rezeptmaterialien verschoben`}
                      secondary={convertProtocol.result.recipe_materials}
                    />
                  </ListItem>
                  <ListItem divider key={"listItem_materialListItems"}>
                    <ListItemText
                      primary={`Materiallisten-Einträge aktualisiert`}
                      secondary={convertProtocol.result.material_list_items}
                    />
                  </ListItem>
                  <ListItem divider key={"listItem_shoppingListItems"}>
                    <ListItemText
                      primary={`Einkaufslisteneinträge aktualisiert`}
                      secondary={convertProtocol.result.shopping_list_items}
                    />
                  </ListItem>
                  <ListItem divider key={"listItem_menueItems"}>
                    <ListItemText
                      primary={`Menüplan-Einträge verschoben`}
                      secondary={convertProtocol.result.menue_items}
                    />
                  </ListItem>
                </List>
              </Grid>
            </React.Fragment>
          )}
        </Grid>
      </CardContent>
    </Card>
  );
};

export default ConvertItemPage;
