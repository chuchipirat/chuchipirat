import React from "react";

import TextField from "@mui/material/TextField";
import {
  Autocomplete,
  AutocompleteChangeReason,
  createFilterOptions,
} from "@mui/material";

import {IngredientProduct} from "../Recipe/recipe.class";
import {Product, DietProperties, createEmptyProduct} from "./product.types";
import {ProductDepartment} from "./product.types";
import {Unit} from "../Unit/unit.class";
import {Utils} from "../Shared/utils.class";
import {ADD, INGREDIENT} from "../../constants/text";
import {TextFieldSize} from "../../constants/defaultValues";

/**
 * Props fuer die Produkt-Autocomplete-Komponente.
 *
 * @param componentKey - Eindeutiger Schluessel fuer die Komponente (wird als Suffix fuer id/key verwendet).
 * @param product - Aktuell ausgewaehltes Produkt oder IngredientProduct.
 * @param products - Liste aller verfuegbaren Produkte fuer die Auswahl.
 * @param label - Optionales Label fuer das Textfeld (Standard: "Zutat").
 * @param allowCreateNewProduct - Ob die Option "Hinzufuegen" angezeigt wird (Standard: true).
 * @param size - Groesse des Textfelds (Standard: medium).
 * @param onChange - Callback bei Aenderung der Auswahl.
 */
interface ProductAutocompleteProps {
  componentKey: string;
  product: Product | IngredientProduct;
  products: Product[];
  label?: string;
  allowCreateNewProduct?: boolean;
  size?: TextFieldSize;
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue: string | Product | null,
    action: AutocompleteChangeReason,
    objectId: string,
  ) => void;
}

/**
 * Hilfstyp fuer die Sortierung der gefilterten Produkte.
 */
interface FilterHelpWithSortRank {
  uid: string;
  name: string;
  department: ProductDepartment;
  shoppingUnit: Unit["key"];
  dietProperties: DietProperties;
  usable: boolean;
  qaChecked: boolean;
  qaCheckedAt: string | null;
  sortRank?: number;
}

// Filter-Instanz auf Modul-Ebene erstellen (Performance: nicht bei jedem Render)
const productFilter = createFilterOptions<Product>();

/**
 * Autocomplete-Feld fuer die Produkt-/Zutatenauswahl.
 * Bietet Freitext-Eingabe, Filterung und optional die Moeglichkeit,
 * neue Produkte direkt aus dem Dropdown anzulegen.
 *
 * @param props - Siehe {@link ProductAutocompleteProps}.
 */
const ProductAutocomplete = ({
  componentKey,
  product,
  products,
  label = INGREDIENT,
  onChange,
  allowCreateNewProduct = true,
  size = TextFieldSize.medium,
}: ProductAutocompleteProps) => {
  return (
    <Autocomplete
      id={"product_" + componentKey}
      key={"product_" + componentKey}
      value={product.name}
      onChange={(event, newValue, reason) => {
        onChange(
          event as unknown as React.ChangeEvent<HTMLInputElement>,
          newValue,
          reason,
          "product_" + componentKey,
        );
      }}
      filterOptions={(options, params) => {
        let filtered = productFilter(options, params) as Product[];
        if (
          params.inputValue !== "" &&
          // Sicherstellen, dass kein Produkt mit gleichem Namen erfasst wird
          products.find(
            (existingProduct) =>
              existingProduct.name.toLowerCase() ===
              params.inputValue.toLowerCase(),
          ) === undefined &&
          !params.inputValue.endsWith(ADD)
        ) {
          if (allowCreateNewProduct) {
            // Hinzufuegen-Moeglichkeit auch als Produkt reinschmuggeln
            const newProduct = {
              ...createEmptyProduct(),
              name: `"${params.inputValue}" ${ADD}`,
            };
            filtered.push(newProduct);
          }
        }
        // So sortieren, dass Zutaten, die mit den gleichen Zeichen beginnen
        // vorher angezeigt werden (Salz vor Erdnuesse, gesalzen)
        let tempFiltered = filtered.map((entry) => {
          const sortRank =
            entry.name
              .substring(0, params.inputValue.length)
              .toLowerCase() === params.inputValue.toLowerCase()
              ? 1
              : 100;

          return {...entry, sortRank};
        }) as FilterHelpWithSortRank[];

        tempFiltered = Utils.sortArray({
          array: tempFiltered,
          attributeName: "sortRank",
        });
        filtered = tempFiltered.map((entry) => {
          delete entry.sortRank;
          return entry;
        });
        return filtered;
      }}
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      options={products}
      getOptionLabel={(option) => {
        if (typeof option === "string") {
          return option;
        }

        if (option.name.endsWith(ADD)) {
          const words = option.name.match('".*"');
          if (words && words.length >= 0) {
            return words[0].slice(1, -1);
          }
        }
        return option.name;
      }}
      renderOption={(props, option) => {
        // eslint-disable-next-line react/prop-types
        const {key, ...optionProps} = props;
        return (
          <li key={key} {...optionProps}>
            {option.name}
          </li>
        );
      }}
      freeSolo
      autoSelect
      autoHighlight
      renderInput={(params) => (
        <TextField {...params} label={label} size={size} />
      )}
    />
  );
};

export {ProductAutocomplete};
