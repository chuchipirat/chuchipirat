/**
 * Dialog zum Hinzufügen oder Bearbeiten von Produkten und Materialien
 * innerhalb des Menüplans.
 *
 * Ermöglicht die Auswahl eines Produkts oder Materials, die Eingabe
 * von Menge und Einheit sowie die Wahl des Planungsmodus
 * (Gesamt oder pro Portion).
 */
import React, {useState} from "react";

import {
  Button,
  ToggleButton,
  ToggleButtonGroup,
  TextField,
  Typography,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  useTheme,
} from "@mui/material";
import Grid from "@mui/material/Grid";
import {AutocompleteChangeReason} from "@mui/material/Autocomplete";

import {
  GoodsType,
  GoodsPlanMode,
  MenuplanProduct,
  MenuplanMaterial,
} from "./menuplan.types";
import type {DialogGoodsValues, OnAddGoodToMenuProps} from "./menuplan.page.types";

import Unit from "../../Unit/unit.class";
import UnitAutocomplete from "../../Unit/unitAutocomplete";
import Product from "../../Product/product.class";
import ProductAutocomplete from "../../Product/productAutocomplete";
import DialogProduct, {
  PRODUCT_POP_UP_VALUES_INITIAL_STATE,
  ProductDialog,
} from "../../Product/dialogProduct";
import Material from "../../Material/material.class";
import MaterialAutocomplete from "../../Material/materialAutocomplete";
import DialogMaterial, {
  MATERIAL_POP_UP_VALUES_INITIAL_STATE,
  MaterialDialog,
} from "../../Material/dialogMaterial";
import Department from "../../Department/department.class";
import Firebase from "../../Firebase/firebase.class";
import AuthUser from "../../Firebase/Authentication/authUser.class";

import {
  MATERIAL as TEXT_MATERIAL,
  PRODUCTS as TEXT_PRODUCTS,
  PRODUCT as TEXT_PRODUCT,
  CANCEL as TEXT_CANCEL,
  OK as TEXT_OK,
  TOTAL as TEXT_TOTAL,
  PER_PORTION as TEXT_PER_PORTION,
  QUANTITY as TEXT_QUANTITY,
  ADD as TEXT_ADD,
  EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT as TEXT_EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT,
  EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL as TEXT_EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL,
  EXPLANATION_DIALOG_GOODS_OPTION_TOTAL as TEXT_EXPLANATION_DIALOG_GOODS_OPTION_TOTAL,
  EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION as TEXT_EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION,
  QUANTITY_MUST_BE_POSITIVE as TEXT_QUANTITY_MUST_BE_POSITIVE,
  QUANTITY_TOO_LARGE as TEXT_QUANTITY_TOO_LARGE,
} from "../../../constants/text";

/**
 * Props für den DialogGoods-Komponenten.
 *
 * @param open - Ob der Dialog geöffnet ist.
 * @param goodsType - Art der Ware (Produkt oder Material).
 * @param units - Liste verfügbarer Einheiten.
 * @param products - Liste verfügbarer Produkte.
 * @param materials - Liste verfügbarer Materialien.
 * @param productToUpdate - Zu bearbeitendes Produkt (oder null).
 * @param materialToUpdate - Zu bearbeitendes Material (oder null).
 * @param departments - Liste der Abteilungen.
 * @param authUser - Authentifizierter Benutzer.
 * @param onCancel - Callback beim Abbrechen.
 * @param onOk - Callback beim Bestätigen.
 * @param onMaterialCreate - Callback wenn ein neues Material erstellt wird.
 * @param onProductCreate - Callback wenn ein neues Produkt erstellt wird.
 * @param firebase - Firebase-Instanz.
 */
interface DialogGoodsProps {
  open: boolean;
  goodsType: GoodsType;
  units: Unit[];
  products: Product[];
  materials: Material[];
  productToUpdate: MenuplanProduct | null;
  materialToUpdate: MenuplanMaterial | null;
  departments: Department[];
  authUser: AuthUser;
  onCancel: () => void;
  onOk: ({
    planMode,
    quantity,
    unit,
    product,
    material,
  }: OnAddGoodToMenuProps) => void;
  onMaterialCreate: (material: Material) => void;
  onProductCreate: (product: Product) => void;
  firebase: Firebase;
}

/**
 * Initialer Zustand für die Dialog-Werte.
 */
const DIALOG_VALUES_INITIAL_STATE = {
  planMode: GoodsPlanMode.TOTAL,
  quantity: 0,
  unit: "",
  product: null,
  material: null,
  // Die Werte werden erst mit dem useState gesetzt. Dann darf der Dialog nicht
  // bereits geöffnet seind, darum wird der Zustand auch über den useState gesteuert
  // ansonsten wäre der Autocomplete jeweils leer
  dialogOpen: false,
};

/**
 * Dialog-Komponente zum Hinzufügen oder Bearbeiten von Produkten/Materialien
 * im Menüplan. Unterstützt die Planungsmodi «Gesamt» und «Pro Portion»,
 * sowie das Anlegen neuer Produkte/Materialien direkt aus dem Dialog heraus.
 *
 * @param props - {@link DialogGoodsProps}
 * @returns React-Element mit dem Waren-Dialog.
 */
export const DialogGoods = ({
  open,
  goodsType,
  units,
  products,
  materials,
  productToUpdate,
  materialToUpdate,
  departments,
  firebase,
  authUser,
  onCancel: onCancelSuper,
  onOk: onOkSuper,
  onMaterialCreate: onMaterialCreateSuper,
  onProductCreate: onProductCreateSuper,
}: DialogGoodsProps) => {
  const theme = useTheme();
  const [dialogValues, setDialogValues] = useState<DialogGoodsValues>(
    DIALOG_VALUES_INITIAL_STATE,
  );
  const [materialAddPopupValues, setMaterialAddPopupValues] = useState({
    ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  const [productAddPopupValues, setProductAddPopupValues] = useState({
    ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
    ...{popUpOpen: false},
  });
  // Falls initialer Wert kommt diesen übernehmen

  if (
    goodsType == GoodsType.PRODUCT &&
    productToUpdate !== null &&
    !dialogValues.product
  ) {
    const product = products.find(
      (product) => product.uid == productToUpdate.productUid,
    );

    if (product) {
      setDialogValues({
        ...dialogValues,
        planMode: productToUpdate.planMode,
        quantity: productToUpdate.quantity,
        unit: productToUpdate.unit,
        product: product,
        dialogOpen: open,
      });
    }
  } else if (
    goodsType == GoodsType.MATERIAL &&
    materialToUpdate !== null &&
    !dialogValues.material
  ) {
    const material = materials.find(
      (material) => material.uid == materialToUpdate.materialUid,
    );
    if (material) {
      setDialogValues({
        ...dialogValues,
        planMode: materialToUpdate.planMode,
        quantity: materialToUpdate.quantity,
        unit: materialToUpdate.unit,
        material: material,
        dialogOpen: open,
      });
    }
  } else if (open === true && dialogValues.dialogOpen === false) {
    // Item wird neu hinzugefügt, einfach den Dialog öffnen
    setDialogValues({...dialogValues, dialogOpen: true});
  }
  /* ------------------------------------------
  // Typ der Einplanung
  // ------------------------------------------ */
  const onTypeChange = (
    event: React.MouseEvent<HTMLElement>,
    newValue: string | null,
  ) => {
    if (newValue === null) {
      // Ein Button muss immer aktiv sein
      return;
    }

    setDialogValues({
      ...dialogValues,
      planMode: newValue as unknown as GoodsPlanMode,
    });
  };
  /* ------------------------------------------
  // Feld-Änderung
  // ------------------------------------------ */
  const onChangeField = (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Unit | Product | Material | null,
    action?: AutocompleteChangeReason,
    objectId?: string,
  ) => {
    let material: Material;
    let product: Product;

    if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("material")
    ) {
      // Prüfen ob neues Material angelegt wird
      material = newValue as Material;
      if (typeof material === "object" && material?.name.endsWith(TEXT_ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const materialName = material.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setMaterialAddPopupValues({
          ...materialAddPopupValues,
          name: materialName,
          popUpOpen: true,
        });
        return;
      } else {
        if (typeof newValue === "string") {
          material = materials.find((mat) => mat.name == newValue)!;
        }
        if (material) {
          setDialogValues({
            ...dialogValues,
            material: material ? material : null,
          });
        }
        return;
      }
    } else if (
      (action === "selectOption" || action === "blur") &&
      objectId?.startsWith("product")
    ) {
      // Prüfen ob neues Produkt angelegt wird
      product = newValue as Product;
      if (typeof product === "object" && product.name.endsWith(TEXT_ADD)) {
        // Begriff Hinzufügen und Anführzungszeichen entfernen
        const productName = product.name.match('".*"')![0].slice(1, -1);

        // Neues Produkt. PopUp Anzeigen und nicht weiter
        setProductAddPopupValues({
          ...productAddPopupValues,
          name: productName,
          popUpOpen: true,
        });
        return;
      } else {
        if (typeof newValue === "string") {
          product = products.find((prd) => prd.name == newValue)!;
        }
        if (product) {
          setDialogValues({
            ...dialogValues,
            product: product ? product : null,
          });
        }
        return;
      }
    } else if (action === "clear" && objectId?.startsWith("material")) {
      setDialogValues({
        ...dialogValues,
        material: null,
      });
      return;
    } else if (action === "clear" && objectId?.startsWith("product")) {
      setDialogValues({
        ...dialogValues,
        product: null,
      });
      return;
    }

    if (objectId == "product_" || objectId == "material_") {
      setDialogValues({
        ...dialogValues,
        [objectId.slice(0, -1)]: newValue,
      });
    } else if (objectId == "unit_" || objectId == "unit") {
      const newUnit = newValue as Unit;

      setDialogValues({
        ...dialogValues,
        unit: newUnit?.key ? newUnit.key : "",
      });
    } else {
      if (isNaN(parseFloat(event.target.value))) {
        setDialogValues({
          ...dialogValues,
          [event.target.id]: event.target.value,
        });
      } else {
        setDialogValues({
          ...dialogValues,
          [event.target.id]: parseFloat(event.target.value),
        });
      }
    }
  };
  /* ------------------------------------------
  // Pop-Up Handler Material/Produkt
  // ------------------------------------------ */
  const onMaterialCreate = (material: Material) => {
    setDialogValues({...dialogValues, material: material});
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });

    onMaterialCreateSuper(material);
  };
  const onProductCreate = (product: Product) => {
    setDialogValues({...dialogValues, product: product});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
    onProductCreateSuper(product);
  };
  const onProductChooseExisting = (product: Product) => {
    setDialogValues({...dialogValues, product: product});
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseDialogMaterial = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  const onCloseDialogProduct = () => {
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      popUpOpen: false,
    });
  };
  /**
   * Prüft die Mengeneingabe auf Gültigkeit.
   *
   * @returns Fehlermeldung oder leerer String bei gültiger Eingabe.
   */
  const getQuantityError = (): string => {
    const q = dialogValues.quantity;
    if (isNaN(q) || q <= 0) return TEXT_QUANTITY_MUST_BE_POSITIVE;
    if (q > 99999) return TEXT_QUANTITY_TOO_LARGE;
    return "";
  };
  const quantityError = getQuantityError();

  const onOk = () => {
    // Eingabevalidierung: ungültige Mengen abfangen
    if (quantityError) return;

    onOkSuper({
      planMode: dialogValues.planMode,
      quantity: dialogValues.quantity,
      unit: dialogValues.unit,
      product: dialogValues.product,
      material: dialogValues.material,
    });
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });

    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
  };
  const onCancel = () => {
    setMaterialAddPopupValues({
      ...MATERIAL_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });
    setProductAddPopupValues({
      ...PRODUCT_POP_UP_VALUES_INITIAL_STATE,
      ...{popUpOpen: false},
    });

    setDialogValues(DIALOG_VALUES_INITIAL_STATE);
    onCancelSuper();
  };
  return (
    <React.Fragment>
      <Dialog
        aria-labelledby="Dialog Goods"
        open={dialogValues.dialogOpen}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>
          {goodsType === GoodsType.MATERIAL ? TEXT_MATERIAL : TEXT_PRODUCTS}
        </DialogTitle>
        <DialogContent>
          <Typography>
            {goodsType == GoodsType.MATERIAL
              ? TEXT_EXPLANATION_DIALOG_GOODS_TYPE_MATERIAL
              : TEXT_EXPLANATION_DIALOG_GOODS_TYPE_PRODUCT}
          </Typography>
          <br />
          <ToggleButtonGroup
            value={dialogValues.planMode}
            color="primary"
            exclusive
            onChange={onTypeChange}
            style={{marginBottom: theme.spacing(2), width: "100%"}}
          >
            <ToggleButton
              value={GoodsPlanMode.TOTAL}
              aria-label={TEXT_TOTAL}
              style={{width: "100%"}}
            >
              {TEXT_TOTAL}
            </ToggleButton>
            <ToggleButton
              value={GoodsPlanMode.PER_PORTION}
              aria-label={TEXT_PER_PORTION}
              style={{width: "100%"}}
            >
              {TEXT_PER_PORTION}
            </ToggleButton>
          </ToggleButtonGroup>
          <Typography variant="body2" color="textSecondary">
            {dialogValues.planMode == GoodsPlanMode.TOTAL
              ? TEXT_EXPLANATION_DIALOG_GOODS_OPTION_TOTAL(
                  goodsType == GoodsType.MATERIAL
                    ? TEXT_MATERIAL
                    : TEXT_PRODUCTS,
                )
              : TEXT_EXPLANATION_DIALOG_GOODS_OPTION_PER_PORTION}
          </Typography>
          <br />
          <Grid container spacing={2}>
            <Grid size={12}>
              {goodsType === GoodsType.PRODUCT ? (
                <ProductAutocomplete
                  componentKey={""}
                  product={
                    dialogValues.product ? dialogValues.product : new Product()
                  }
                  products={products}
                  onChange={onChangeField}
                  label={TEXT_PRODUCT}
                />
              ) : (
                <MaterialAutocomplete
                  componentKey={""}
                  disabled={false}
                  material={
                    dialogValues.material
                      ? dialogValues.material
                      : ({} as Material)
                  }
                  materials={materials}
                  onChange={onChangeField}
                />
              )}
            </Grid>

            <Grid size={goodsType === GoodsType.PRODUCT ? 6 : 12}>
              <TextField
                key={"quantity"}
                id={"quantity"}
                value={
                  Number.isNaN(dialogValues.quantity) ||
                  dialogValues.quantity === 0
                    ? ""
                    : dialogValues.quantity
                }
                label={TEXT_QUANTITY}
                type="number"
                inputProps={{min: 0}}
                onChange={onChangeField}
                error={
                  dialogValues.quantity !== 0 && quantityError !== ""
                }
                helperText={
                  dialogValues.quantity !== 0 ? quantityError : ""
                }
                fullWidth
              />
            </Grid>
            {goodsType === GoodsType.PRODUCT && (
              <Grid size={6}>
                <UnitAutocomplete
                  componentKey={""}
                  unitKey={dialogValues.unit}
                  units={units}
                  onChange={onChangeField}
                />
              </Grid>
            )}
          </Grid>
        </DialogContent>
        <DialogActions>
          {/* schliessen */}
          <Button onClick={onCancel} color="primary" variant="outlined">
            {TEXT_CANCEL}
          </Button>
          <Button
            onClick={onOk}
            disabled={
              (!dialogValues.material?.uid && !dialogValues.product?.uid) ||
              quantityError !== ""
            }
            color="primary"
            variant="contained"
          >
            {TEXT_OK}
          </Button>
        </DialogActions>
      </Dialog>
      {/* Dialog um neues Material anzulegen */}
      <DialogMaterial
        materialName={materialAddPopupValues.name}
        materialUid={materialAddPopupValues.uid}
        materialType={materialAddPopupValues.type}
        materialUsable={materialAddPopupValues.usable}
        materials={materials}
        dialogType={MaterialDialog.CREATE}
        dialogOpen={materialAddPopupValues.popUpOpen}
        handleOk={onMaterialCreate}
        handleClose={onCloseDialogMaterial}
        authUser={authUser}
      />
      <DialogProduct
        productName={productAddPopupValues.name}
        productUid={productAddPopupValues.uid}
        productDietProperties={productAddPopupValues.dietProperties}
        usable={productAddPopupValues.usable}
        dialogType={ProductDialog.CREATE}
        dialogOpen={productAddPopupValues.popUpOpen}
        handleOk={onProductCreate}
        handleClose={onCloseDialogProduct}
        handleChooseExisting={onProductChooseExisting}
        products={products}
        units={units}
        departments={departments}
        authUser={authUser}
      />
    </React.Fragment>
  );
};
