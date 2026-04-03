/**
 * Dialog zum Konvertieren eines Materials in ein Produkt.
 *
 * Fragt die Produkteigenschaften ab (Abteilung, Einkaufseinheit,
 * Diät, Allergene), bevor die Konvertierung via RPC ausgeführt wird.
 */
import React from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  FormControlLabel,
  FormLabel,
  FormGroup,
  RadioGroup,
  Radio,
  Checkbox,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid";

import {Material} from "./material.types";
import {Allergen, Diet, DietProperties} from "../Product/product.types";
import Department from "../Department/department.class";
import {Unit, UnitDimension} from "../Unit/unit.class";
import {DepartmentAutocomplete} from "../Department/departmentAutocomplete";
import {UnitAutocomplete} from "../Unit/unitAutocomplete";
import {useDatabase} from "../Database/DatabaseContext";
import {AutocompleteChangeReason} from "@mui/material";
import {
  CONVERT_TO_PRODUCT as TEXT_CONVERT_TO_PRODUCT,
} from "../../constants/text/materialQa";
import {
  INTOLERANCES as TEXT_INTOLERANCES,
  HAS_LACTOSE as TEXT_HAS_LACTOSE,
  HAS_GLUTEN as TEXT_HAS_GLUTEN,
  IS_MEAT as TEXT_IS_MEAT,
  IS_VEGETARIAN as TEXT_IS_VEGETARIAN,
  IS_VEGAN as TEXT_IS_VEGAN,
  PRODUCT_PROPERTY as TEXT_PRODUCT_PROPERTY,
  DEPARTMENT as TEXT_DEPARTMENT,
} from "../../constants/text";

/**
 * Props für den Konvertierungs-Dialog.
 *
 * @param open - Ob der Dialog geöffnet ist
 * @param material - Das zu konvertierende Material
 * @param onClose - Callback zum Schliessen
 * @param onConvert - Callback mit den gewählten Produkteigenschaften
 */
interface DialogConvertMaterialToProductProps {
  open: boolean;
  material: Material;
  onClose: () => void;
  onConvert: (
    material: Material,
    departmentId?: string,
    shoppingUnit?: string,
  ) => void;
}

/**
 * Dialog zur Eingabe der Produkteigenschaften vor der Material→Produkt-Konvertierung.
 */
export const DialogConvertMaterialToProduct = ({
  open,
  material,
  onClose,
  onConvert,
}: DialogConvertMaterialToProductProps) => {
  const database = useDatabase();
  const [departments, setDepartments] = React.useState<Department[]>([]);
  const [units, setUnits] = React.useState<Unit[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  const [selectedDepartment, setSelectedDepartment] =
    React.useState<Department>({uid: "", name: "", pos: 0, usable: true});
  const [selectedUnit, setSelectedUnit] = React.useState<Unit>({
    key: "",
    name: "",
    dimension: UnitDimension.dimensionless,
  });
  const [dietProperties, setDietProperties] = React.useState<DietProperties>({
    allergens: [],
    diet: Diet.Meat,
  });

  // Stammdaten laden
  React.useEffect(() => {
    if (!open) return;
    setIsLoading(true);
    Promise.all([
      database.departments.getAllDepartments(),
      database.units.getAllUnits(),
    ])
      .then(([departmentDomains, unitDomains]) => {
        setDepartments(
          departmentDomains.map((departmentDomain) => ({
            uid: departmentDomain.uid,
            name: departmentDomain.name,
            pos: departmentDomain.pos,
            usable: departmentDomain.usable,
          })),
        );
        setUnits(
          unitDomains.map((unitDomain) => ({
            key: unitDomain.key,
            name: unitDomain.name,
            dimension: unitDomain.dimension as UnitDimension,
          })),
        );
        setIsLoading(false);
      })
      .catch(() => setIsLoading(false));
  }, [open]);

  const handleDepartmentChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue?: string | Department | null,
    action?: AutocompleteChangeReason,
  ) => {
    if (action === "blur") return;
    if (newValue && typeof newValue !== "string") {
      setSelectedDepartment(newValue as Department);
    }
  };

  const handleUnitChange = (
    _event: React.ChangeEvent<HTMLInputElement>,
    newValue: Unit | null,
    action: AutocompleteChangeReason,
  ) => {
    if (action === "blur") return;
    if (newValue) {
      setSelectedUnit(newValue);
    }
  };

  const handleAllergenChange = (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const updated = {...dietProperties, allergens: [...dietProperties.allergens]};
    const allergen =
      event.target.id === "containsLactose" ? Allergen.Lactose : Allergen.Gluten;

    if (event.target.checked) {
      updated.allergens.push(allergen);
    } else {
      updated.allergens = updated.allergens.filter(
        (candidate) => candidate !== allergen,
      );
    }
    setDietProperties(updated);
  };

  const handleDietChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setDietProperties({
      ...dietProperties,
      diet: parseInt(event.target.value),
    });
  };

  const handleConvert = () => {
    onConvert(
      material,
      selectedDepartment.uid || undefined,
      selectedUnit.key || undefined,
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {TEXT_CONVERT_TO_PRODUCT}: {material.name}
      </DialogTitle>
      <DialogContent>
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Grid container spacing={2} sx={{marginTop: 1}}>
            <Grid size={12}>
              <DepartmentAutocomplete
                department={selectedDepartment}
                departments={departments}
                disabled={false}
                onChange={handleDepartmentChange}
                label={TEXT_DEPARTMENT}
              />
            </Grid>
            <Grid size={12}>
              <UnitAutocomplete
                unitKey={selectedUnit.key}
                units={units}
                onChange={handleUnitChange}
              />
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth>
                <FormLabel component="legend">{TEXT_INTOLERANCES}</FormLabel>
                <FormGroup>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dietProperties.allergens.includes(
                          Allergen.Lactose,
                        )}
                        onChange={handleAllergenChange}
                        id="containsLactose"
                      />
                    }
                    label={TEXT_HAS_LACTOSE}
                  />
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={dietProperties.allergens.includes(
                          Allergen.Gluten,
                        )}
                        onChange={handleAllergenChange}
                        id="containsGluten"
                      />
                    }
                    label={TEXT_HAS_GLUTEN}
                  />
                </FormGroup>
              </FormControl>
            </Grid>
            <Grid size={{xs: 12, sm: 6}}>
              <FormControl fullWidth>
                <FormLabel component="legend">
                  {TEXT_PRODUCT_PROPERTY}
                </FormLabel>
                <FormGroup>
                  <RadioGroup
                    aria-label="Diät"
                    value={dietProperties.diet}
                    onChange={handleDietChange}
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
          </Grid>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Abbrechen</Button>
        <Button
          variant="contained"
          color="primary"
          onClick={handleConvert}
          disabled={isLoading}
        >
          {TEXT_CONVERT_TO_PRODUCT}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
