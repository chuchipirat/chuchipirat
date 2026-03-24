import React from "react";
import {trackEvent} from "../Analytics/analyticsService";
import {AnalyticsEvent} from "../Analytics/analyticsEvents";

import Grid from "@mui/material/Grid";
import {
  Button,
  TextField,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Alert,
  AlertTitle,
  FormControl,
  FormHelperText,
  FormControlLabel,
  FormLabel,
  FormGroup,
  RadioGroup,
  Radio,
  ListItemButton,
  List,
  Typography,
} from "@mui/material";

import * as Sentry from "@sentry/react";

import {Product, Allergen, Diet} from "./product.types";
import {findSimilarProducts} from "./productUtils";
import {AlertMessage} from "../Shared/AlertMessage";
import {
  GIVE_PRODUCT as TEXT_GIVE_PRODUCT,
  GIVE_DEPARTMENT as TEXT_GIVE_DEPARTMENT,
  ERROR_PRODUCT_WITH_THIS_NAME_ALREADY_EXISTS as TEXT_ERROR_PRODUCT_WITH_THIS_NAME_ALREADY_EXISTS,
  PRODUCT_ADD as TEXT_PRODUCT_ADD,
  PRODUCT_EDIT as TEXT_PRODUCT_EDIT,
  PRODUCT as TEXT_PRODUCT,
  ATTENTION as TEXT_ATTENTION,
  WARNING_PRODUCT_1 as TEXT_WARNING_PRODUCT_1,
  WARNING_PRODUCT_2 as TEXT_WARNING_PRODUCT_2,
  WARNING_PRODUCT_3 as TEXT_WARNING_PRODUCT_3,
  SHOPPING_UNIT_INFO as TEXT_SHOPPING_UNIT_INFO,
  USABLE as TEXT_USABLE,
  INTOLERANCES as TEXT_INTOLERANCES,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  PRODUCT_PROPERTY as TEXT_PRODUCT_PROPERTY,
  IS_MEAT as TEXT_IS_MEAT,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  IS_VEGAN as TEXT_IS_VEGAN,
  DIALOG_INFO_DIET_PROPERTIES as TEXT_INFO_DIET_PROPERTIES,
  CANCEL as TEXT_CANCEL,
  OK as TEXT_OK,
  CREATE as TEXT_CREATE,
  GUIDELINES_NEW_PRODUCT as TEXT_GUIDELINES_NEW_PRODUCT,
  NEW_PRODUCT as TEXT_NEW_PRODUCT,
  SIMILAR_PRODUCTS as TEXT_SIMILAR_PRODUCTS,
  EXISTING_PRODUCTS as TEXT_EXISTING_PRODUCTS,
  THERE_ARE_SIMILAR_PRODUCTS as TEXT_THERE_ARE_SIMILAR_PRODUCTS,
} from "../../constants/text";
import Department from "../Department/department.class";
import {Unit, UnitDimension} from "../Unit/unit.class";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {UnitAutocomplete} from "../Unit/unitAutocomplete";

import {DepartmentAutocomplete} from "../Department/departmentAutocomplete";
import {useDatabase} from "../Database/DatabaseContext";
import {FeedType} from "../Shared/feed.class";
import {Role} from "../../constants/roles";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */
/**
 * Initialzustand für das Produkt-Formular im Dialog.
 */
export const PRODUCT_POP_UP_VALUES_INITIAL_STATE = {
  uid: "",
  name: "",
  shoppingUnit: new Unit({key: "", name: ""}),
  department: new Department(),
  dietProperties: {
    allergens: [] as Allergen[],
    diet: Diet.Meat,
  },
  usable: true,
  showNameWarning: false,
};

/**
 * Initialzustand für den Dialog mit ähnlichen Produkten.
 */
export const SIMILAR_PRODUCTS_POPUP_INITIAL_STATE = {
  similarProducts: [] as Product[],
  popUpOpen: false,
};

/**
 * Typ des Produkt-Dialogs.
 */
export enum ProductDialog {
  CREATE = "create",
  EDIT = "edit",
}


/* ===================================================================
// ===================== Pop Up Produkt hinzufügen ===================
// =================================================================== */

/**
 * Props für den Produkt-Dialog.
 *
 * @param firebase - Firebase-Instanz (nicht mehr benötigt, wird ignoriert). Veraltet.
 * @param dialogType - Art des Dialogs (CREATE oder EDIT)
 * @param productName - Vorausgefüllter Produktname
 * @param productUid - UID des zu bearbeitenden Produkts (nur EDIT)
 * @param productDietProperties - Vorausgefüllte Diät-Eigenschaften
 * @param productUsable - Vorausgefüllter Usable-Status
 * @param products - Alle bekannten Produkte (für Duplikat-Prüfung)
 * @param dialogOpen - Gibt an, ob der Dialog geöffnet ist
 * @param handleOk - Callback bei Bestätigung
 * @param handleClose - Callback beim Schliessen
 * @param handleChooseExisting - Callback bei Auswahl eines ähnlichen Produkts
 * @param selectedDepartment - Vorausgewählte Abteilung
 * @param selectedUnit - Vorausgewählte Einheit
 * @param usable - Vorausgefüllter Usable-Status (Alias)
 * @param departments - Verfügbare Abteilungen
 * @param units - Verfügbare Einheiten
 * @param authUser - Angemeldeter Benutzer
 */
interface DialogProductProps {
  dialogType: ProductDialog;
  productName: Product["name"];
  productUid: Product["uid"];
  productDietProperties: Product["dietProperties"];
  productUsable?: Product["usable"];
  products: Product[];
  dialogOpen: boolean;
  handleOk: (product: Product) => void;
  handleClose: () => void;
  handleChooseExisting: (product: Product) => void;
  selectedDepartment?: Department;
  selectedUnit?: Unit;
  usable?: boolean;
  departments: Department[];
  units: Unit[];
  authUser: AuthUser;
}

/**
 * Dialog zum Erstellen und Bearbeiten von Produkten.
 * Im CREATE-Modus wird das Produkt per Supabase eingefügt und das
 * resultierende Domain-Objekt über handleOk zurückgegeben.
 * Im EDIT-Modus werden die Änderungen an den Aufrufer zurückgegeben.
 */
const DialogProduct = ({
  dialogType,
  productName = "",
  productUid = "",
  productDietProperties,
  products = [],
  dialogOpen,
  handleOk,
  handleClose,
  handleChooseExisting,
  selectedDepartment = {} as Department,
  selectedUnit = {key: "", name: "", dimension: UnitDimension.dimensionless},
  usable = true,
  departments = [],
  units = [],
  authUser,
}: DialogProductProps) => {
  const database = useDatabase();

  const [productPopUpValues, setProductPopUpValues] = React.useState(
    PRODUCT_POP_UP_VALUES_INITIAL_STATE,
  );
  const [similarProductPopupValues, setSimilarProductPopupValues] =
    React.useState(SIMILAR_PRODUCTS_POPUP_INITIAL_STATE);

  const [validation, setValidation] = React.useState({
    name: {hasError: false, errorText: ""},
    department: {hasError: false, errorText: ""},
  });

  /* ------------------------------------------
  // Formular bei Dialog-Öffnung initialisieren
  // ------------------------------------------ */
  React.useEffect(() => {
    if (!dialogOpen) {
      return;
    }
    // Im CREATE-Modus auf ähnliche Produkte prüfen
    if (dialogType === ProductDialog.CREATE && productName) {
      const similar = findSimilarProducts({
        productName,
        existingProducts: products,
      });
      if (similar.length > 0) {
        setSimilarProductPopupValues({
          similarProducts: similar,
          popUpOpen: true,
        });
      }
    }
    setProductPopUpValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      uid: productUid,
      name: productName.trim(),
      department: selectedDepartment,
      shoppingUnit: selectedUnit,
      dietProperties: {
        allergens: productDietProperties?.allergens ?? [],
        diet: productDietProperties?.diet ?? Diet.Meat,
      },
      usable: usable ?? true,
    });
    // Abhängigkeiten bewusst auf dialogOpen beschränkt: das Formular wird nur
    // beim Öffnen/Schliessen des Dialogs neu initialisiert, nicht bei Prop-Änderungen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dialogOpen]);

  /* ------------------------------------------
  // Change Ereignis Felder
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue: string | Product | Department | Unit | boolean | null = null,
    action?: string,
    objectId?: string,
  ) => {
    let value: string | Product | Department | Unit | boolean | null;
    let field: string;

    if (event.target.id) {
      field = event.target.id.split("-")[0];
    } else {
      objectId ? (field = objectId) : (field = "");
    }

    switch (field) {
      case "unit_shoppingUnit":
        if (action !== "clear") {
          value = newValue;
        } else {
          value = "";
        }
        field = "shoppingUnit";
        break;
      case "department":
        if (action !== "clear") {
          value = newValue;
        } else {
          value = "";
        }
        break;
      case "name":
        value = event.target.value;
        break;
      case "usable":
        value = event.target.checked;
        break;
      default:
        return;
    }

    setProductPopUpValues({
      ...productPopUpValues,
      [field]: value,
      // Warnung anzeigen, falls der Name geändert wird
      showNameWarning: field === "name",
    });
  };

  const onChangeDietCheckbox = (event: React.ChangeEvent<HTMLInputElement>) => {
    let updatedAllergens = [...productPopUpValues.dietProperties.allergens];

    switch (event.target.id) {
      case "dietProperties.allergens.containsLactose":
        updatedAllergens = event.target.checked
          ? [...updatedAllergens, Allergen.Lactose]
          : updatedAllergens.filter(
              (allergen) => allergen !== Allergen.Lactose,
            );
        break;
      case "dietProperties.allergens.containsGluten":
        updatedAllergens = event.target.checked
          ? [...updatedAllergens, Allergen.Gluten]
          : updatedAllergens.filter((allergen) => allergen !== Allergen.Gluten);
        break;
    }

    setProductPopUpValues({
      ...productPopUpValues,
      dietProperties: {
        ...productPopUpValues.dietProperties,
        allergens: updatedAllergens,
      },
    });
  };

  const onChangeDietRadioButton = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    setProductPopUpValues({
      ...productPopUpValues,
      dietProperties: {
        ...productPopUpValues.dietProperties,
        diet: parseInt(event.target.value, 10),
      },
    });
  };

  /* ------------------------------------------
  // PopUp Abbrechen
  // ------------------------------------------ */
  const onCancelClick = () => {
    setProductPopUpValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
    });
    handleClose();
  };

  /* ------------------------------------------
  // PopUp Ok - schliessen
  // ------------------------------------------ */
  const onOkClick = () => {
    // Prüfung Abteilung und Name gesetzt
    let hasError = false;
    if (!productPopUpValues.name) {
      setValidation({
        ...validation,
        name: {hasError: true, errorText: TEXT_GIVE_PRODUCT},
      });
      hasError = true;
    }
    if (
      !productPopUpValues.department ||
      !Object.prototype.hasOwnProperty.call(
        productPopUpValues.department,
        "name",
      )
    ) {
      setValidation({
        ...validation,
        department: {
          hasError: true,
          errorText: TEXT_GIVE_DEPARTMENT,
        },
      });
      hasError = true;
    }
    if (
      // Nur wenn keine UID
      !productPopUpValues.uid &&
      products.find(
        (product) =>
          product.name.toLowerCase() ===
          productPopUpValues.name.toLowerCase().trim(),
      ) !== undefined
    ) {
      // Ein Produkt mit diesem Namen besteht schon. --> Abbruch
      setValidation({
        ...validation,
        name: {
          hasError: true,
          errorText: TEXT_ERROR_PRODUCT_WITH_THIS_NAME_ALREADY_EXISTS,
        },
      });
      hasError = true;
    }
    if (hasError) {
      return;
    }
    switch (dialogType) {
      case ProductDialog.CREATE:
        // Neues Produkt in Supabase einfügen
        database.products
          .insertProduct(
            {
              name: productPopUpValues.name,
              // Im Dialog gibt es kein separates Singular-Feld — Name wird übernommen
              nameSingular: productPopUpValues.name,
              department: {
                uid: productPopUpValues?.department?.uid ?? "",
                name: productPopUpValues?.department?.name ?? "",
              },
              shoppingUnit: productPopUpValues?.shoppingUnit?.key ?? "",
              dietProperties: productPopUpValues.dietProperties,
              usable: true,
            },
            authUser,
          )
          .then((result) => {
            // ProductDomain → Product konvertieren fuer den Aufrufer
            const createdProduct: Product = {
              uid: result.uid,
              name: result.name,
              department: {
                uid: result.department?.uid ?? "",
                name: result.department?.name ?? "",
              },
              shoppingUnit: result.shoppingUnit,
              dietProperties: result.dietProperties,
              usable: result.usable,
            };
            trackEvent(AnalyticsEvent.PRODUCT_CREATED);
            handleOk(createdProduct);
            setProductPopUpValues({...PRODUCT_POP_UP_VALUES_INITIAL_STATE});

            // Feed-Eintrag: Produkt erstellt
            database.feeds
              .insertFeed(
                {
                  feedType: FeedType.productCreated,
                  visibility: Role.communityLeader,
                  sourceObjectType: "product",
                  sourceObjectUid: result.uid,
                },
                authUser,
              )
              .catch((err) => Sentry.captureException(err, {extra: {context: "Feed-Eintrag fuer neues Produkt"}}));
          })
          .catch((error) => {
            Sentry.captureException(error, {extra: {context: "Produkt anlegen"}});
          });
        break;
      case ProductDialog.EDIT: {
        // PopUp Werte aufbereiten fuer aufrufende Komponente
        const editedProduct: Product = {
          uid: productPopUpValues.uid,
          name: productPopUpValues.name,
          department: productPopUpValues.department,
          shoppingUnit: productPopUpValues.shoppingUnit.key,
          usable: productPopUpValues.usable,
          dietProperties: {
            diet: productPopUpValues.dietProperties.diet,
            allergens: productPopUpValues.dietProperties.allergens.filter(
              (allergen) =>
                allergen === Allergen.Lactose || allergen === Allergen.Gluten,
            ),
          },
        };
        handleOk(editedProduct);
        setProductPopUpValues({...PRODUCT_POP_UP_VALUES_INITIAL_STATE});
        break;
      }
    }
  };

  /* ------------------------------------------
  // Dialog schliessen (via Backdrop/Escape abfangen)
  // ------------------------------------------ */
  const onClose = (_event: object, reason: string) => {
    // Nur Backdrop-Klick blockieren; ESC schliesst den Dialog
    if (reason === "backdropClick") {
      return;
    }
    handleClose();
  };

  /* ------------------------------------------
  // Similar Product PopUp - Handling
  // ------------------------------------------ */
  const onSimilarProductPopUpChooseProduct = (
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ) => {
    const productUid = event.currentTarget.id.split("_")[1];
    const product = products.find((candidate) => candidate.uid === productUid);

    if (!product) {
      return;
    }

    handleChooseExisting(product);
    setSimilarProductPopupValues(SIMILAR_PRODUCTS_POPUP_INITIAL_STATE);
    setProductPopUpValues({...PRODUCT_POP_UP_VALUES_INITIAL_STATE});
  };

  const onSimilarProductPopUpClose = () => {
    setSimilarProductPopupValues(SIMILAR_PRODUCTS_POPUP_INITIAL_STATE);
  };

  return (
    <React.Fragment>
      <Dialog
        open={dialogOpen}
        onClose={onClose}
        aria-labelledby="dialogAddProduct"
        maxWidth="sm"
      >
        <DialogTitle id="dialogAddProduct">
          {dialogType === ProductDialog.CREATE
            ? TEXT_PRODUCT_ADD
            : TEXT_PRODUCT_EDIT}
        </DialogTitle>

        <DialogContent>
          {dialogType === ProductDialog.CREATE && (
            <Alert severity="warning">
              <AlertTitle>{`${TEXT_NEW_PRODUCT}?`}</AlertTitle>
              <div>
                {TEXT_GUIDELINES_NEW_PRODUCT.line1}
                <ul>
                  <li>{TEXT_GUIDELINES_NEW_PRODUCT.line2}</li>
                  <li>{TEXT_GUIDELINES_NEW_PRODUCT.line3}</li>
                  <li>{TEXT_GUIDELINES_NEW_PRODUCT.line4}</li>
                </ul>
                {TEXT_GUIDELINES_NEW_PRODUCT.line5}
              </div>
            </Alert>
          )}
          <DialogContentText>
            {dialogType === ProductDialog.CREATE && TEXT_PRODUCT}
          </DialogContentText>
          {dialogType === ProductDialog.EDIT &&
            productPopUpValues.showNameWarning && (
              <AlertMessage
                severity="warning"
                messageTitle={TEXT_ATTENTION}
                body={
                  <React.Fragment>
                    {TEXT_WARNING_PRODUCT_1}
                    <strong>{TEXT_WARNING_PRODUCT_2}</strong>
                    {TEXT_WARNING_PRODUCT_3}
                  </React.Fragment>
                }
              />
            )}
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField
                error={validation.name.hasError}
                margin="dense"
                id="name"
                name="name"
                value={productPopUpValues.name}
                required
                fullWidth
                onChange={onChangeField}
                label={TEXT_PRODUCT}
                type="text"
                helperText={validation.name.errorText}
                autoFocus
              />
            </Grid>
            <Grid size={12}>
              <FormControl fullWidth>
                <DepartmentAutocomplete
                  department={productPopUpValues.department}
                  departments={departments}
                  disabled={false}
                  onChange={onChangeField}
                />
              </FormControl>
            </Grid>
            <Grid size={dialogType === ProductDialog.EDIT ? 6 : 12}>
              <FormControl fullWidth>
                <UnitAutocomplete
                  componentKey={"shoppingUnit"}
                  unitKey={productPopUpValues.shoppingUnit.key}
                  units={units}
                  onChange={onChangeField}
                />
                <FormHelperText>{TEXT_SHOPPING_UNIT_INFO}</FormHelperText>
              </FormControl>
            </Grid>
            {dialogType === ProductDialog.EDIT && (
              <Grid size={6}>
                <FormControlLabel
                  control={
                    <Checkbox
                      id="usable"
                      checked={productPopUpValues.usable}
                      onChange={onChangeField}
                      name="usable"
                    />
                  }
                  label={TEXT_USABLE}
                />
              </Grid>
            )}
            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth>
                <FormLabel component="legend">{TEXT_INTOLERANCES}</FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={productPopUpValues.dietProperties?.allergens?.includes(
                          Allergen.Lactose,
                        )}
                        onChange={onChangeDietCheckbox}
                        name="dietProperties.allergens.containsLactose"
                        id="dietProperties.allergens.containsLactose"
                      />
                    }
                    label={TEXT_HAS_LACTOSE}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={productPopUpValues.dietProperties?.allergens?.includes(
                          Allergen.Gluten,
                        )}
                        onChange={onChangeDietCheckbox}
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
                    value={productPopUpValues.dietProperties.diet}
                    onChange={onChangeDietRadioButton}
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
            {dialogType === ProductDialog.CREATE && (
              <Grid size={12}>
                <FormHelperText>{TEXT_INFO_DIET_PROPERTIES}</FormHelperText>
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={onCancelClick} color="primary" variant="outlined">
            {TEXT_CANCEL}
          </Button>
          <Button onClick={onOkClick} color="primary" variant="contained">
            {dialogType === ProductDialog.CREATE ? TEXT_CREATE : TEXT_OK}
          </Button>
        </DialogActions>
      </Dialog>
      <Dialog
        open={similarProductPopupValues.popUpOpen}
        aria-labelledby="similarProducts"
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle id="dialogSimilarProducts">
          {TEXT_SIMILAR_PRODUCTS}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1">
            {TEXT_THERE_ARE_SIMILAR_PRODUCTS}
          </Typography>
          <br />
          <Typography variant="h6">{TEXT_EXISTING_PRODUCTS}</Typography>
          <List dense>
            {similarProductPopupValues.similarProducts.map((product) => (
              <ListItemButton
                key={"similarProduct_" + product.uid}
                id={"similarProduct_" + product.uid}
                onClick={onSimilarProductPopUpChooseProduct}
              >
                {product.name}
              </ListItemButton>
            ))}
          </List>
        </DialogContent>
        <DialogActions>
          <Button
            onClick={onSimilarProductPopUpClose}
            color="primary"
            variant="contained"
          >
            {`${TEXT_PRODUCT} ${TEXT_CREATE}`}
          </Button>
        </DialogActions>
      </Dialog>
    </React.Fragment>
  );
};

export {DialogProduct};
