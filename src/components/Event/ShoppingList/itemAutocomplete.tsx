import React from "react";
import TextField from "@mui/material/TextField";
import {
  Autocomplete,
  AutocompleteChangeReason,
  createFilterOptions,
} from "@mui/material";

import {Material, MaterialType, createEmptyMaterial} from "../../Material/material.types";
import {Utils} from "../../Shared/utils.class";

import {ITEM, ADD, ITEM_CANT_BE_CHANGED} from "../../../constants/text";
import {Product} from "../../Product/product.types";
import {ItemType} from "./shoppingList.class";
import {TextFieldSize} from "../../../constants/defaultValues";

/**
 * Props fuer {@link ItemAutocomplete}.
 *
 * Diese Komponente kombiniert Produkte und Material in einem einzigen Autocomplete-Feld.
 * Je nach Konfiguration kann der User:
 * - einen bestehenden Eintrag auswaehlen (Standard), und/oder
 * - einen neuen Eintrag via "Hinzufuegen" (ADD) anstossen, und/oder
 * - beliebigen Freitext übernehmen (ohne Creation-Flow) via {@link ItemAutocompleteProps.allowFreeText}.
 */
export interface ItemAutocompleteProps {
  /**
   * Eindeutiger Key zur Unterscheidung mehrerer Instanzen in derselben View.
   * Wird für React key/id sowie als objectId im onChange verwendet.
   */
  componentKey: string;
  /**
   * Aktueller Wert des Feldes.
   *
   * - {@link MaterialItem} / {@link ProductItem}: wenn ein bestehender Eintrag selektiert ist
   * - string: wenn Freitext erlaubt ist und der User einen eigenen Text übernommen hat
   * - null: kein Wert
   */

  item: MaterialItem | ProductItem | string | null;
  /**
   * Verfuegbare Material-Einträge für die Auswahl.
   * Werden intern in {@link MaterialItem} erweitert (mit itemType).
   */
  materials: Material[];

  /**
   * Verfügbare Produkt-Einträge für die Auswahl.
   * Werden intern in {@link ProductItem} erweitert (mit itemType).
   */
  products: Product[];

  /**
   * Wenn true, ist das Feld deaktiviert (read-only).
   */
  disabled: boolean;

  /**
   * Callback bei Wert-Änderung.
   *
   * @param event - ChangeEvent (von Autocomplete auf TextField gemappt)
   * @param newValue - Neuer Wert:
   *   - {@link MaterialItem} / {@link ProductItem} bei Auswahl
   *   - string bei Freitext (allowFreeText=true)
   *   - null wenn geloescht
   * @param action - Grund/Action von MUI Autocomplete (selectOption, clear, blur, createOption, ...)
   * @param objectId - Eindeutige Id der Komponente ("item_" + componentKey)
   */
  onChange: (
    event: React.ChangeEvent<HTMLInputElement>,
    newValue: string | MaterialItem | ProductItem | null,
    action: import("@mui/material").AutocompleteChangeReason,
    objectId: string,
  ) => void;

  /**
   * Fehleranzeige für das Feld.
   *
   * - isError: true -> Feld ist rot markiert
   * - errorText: wird als helperText angezeigt
   */
  error: {isError: boolean; errorText: string};

  /**
   * Legacy-Feature:
   * Wenn true, wird in der Dropdown-Liste eine zusaetzliche Option angezeigt, um
   * einen neuen Eintrag anzulegen (z. B. '"ABC" Hinzufügen').
   *
   * Default: true
   *
   * Hinweis: Wenn {@link ItemAutocompleteProps.allowFreeText} true ist,
   * wird dieses Verhalten bewusst unterdrückt, damit kein Creation-Flow getriggert wird.
   */
  allowCreateNewItem?: boolean;

  /**
   * Wenn true, kann der User beliebigen Freitext eingeben, auch wenn kein Eintrag existiert.
   * Der Text wird übernommen, ohne dass der Creation-Process getriggert wird.
   *
   * Typisches Verhalten:
   * - Enter oder Auswahl eines bestehenden Eintrags -> onChange mit Item oder string
   * - Blur/Tab aus dem Feld -> Freitext wird ebenfalls committed (onChange action="blur")
   *
   * Default: false (bestehende Nutzung bleibt unveraendert)
   */
  allowFreeText?: boolean;

  /**
   * Groesse des TextField Inputs.
   */
  size: TextFieldSize;
}
interface filterHelpWithSortRank {
  uid: string;
  name: string;
  type: MaterialType;
  sortRank?: number;
  usable: boolean;
  itemType: ItemType;
}

export interface ProductItem extends Product {
  itemType: ItemType;
}

export interface MaterialItem extends Material {
  itemType: ItemType;
}

type Item = ProductItem | MaterialItem;

/**
 * Autocomplete Feld fuer Produkte und Material (kombiniert).
 *
 * Features:
 * - Kombinierte Liste aus Produkten + Material
 * - Case-insensitive Matching für Strings
 * - Optionale Sortierung der Vorschläge nach "startsWith" (bessere UX)
 * - Optionaler Create-Flow via "ADD"
 * - Optionaler Freitext-Modus ohne Creation-Flow
 *
 * Wichtige Hinweise:
 * - Sortiert und transformiert intern die übergebenen Listen in ein gemeinsames Options-Array.
 * - Im Freitext-Modus wird beim Verlassen des Feldes (blur) der aktuelle Input committed,
 *   damit der User nicht zwingend Enter drücken muss.
 *
 * @param props - Siehe {@link ItemAutocompleteProps}
 * @returns React Element (MUI Autocomplete)
 */
const ItemAutocomplete: React.FC<ItemAutocompleteProps> = ({
  componentKey,
  item,
  materials,
  products,
  disabled,
  error,
  allowCreateNewItem = true,
  allowFreeText = false,
  onChange,
  size = TextFieldSize.medium,
}: ItemAutocompleteProps) => {
  // ignoreAccents deaktivieren: MUI's Default (true) entfernt Umlaute vor dem Vergleich,
  // d.h. "ä"→"a", "ö"→"o", "ü"→"u". Damit matcht z.B. "ä" auf alle Einträge mit "a"
  // im Namen — z.B. "Spätzlisieb". Im Deutschen sind Umlaute eigenständige Buchstaben.
  const filter = createFilterOptions<Item>({
    ignoreAccents: false,
    stringify: (option) => option.name,
  });
  const [items, setItems] = React.useState<Item[]>([]);

  const [inputValue, setInputValue] = React.useState<string>(
    typeof item === "string" ? item : (item?.name ?? ""),
  );

  // Merkt sich den Namen des zuletzt per Dropdown ausgewählten Eintrags,
  // damit onBlur die Auswahl nicht ein zweites Mal verarbeitet.
  const lastSelectedNameRef = React.useRef<string>("");

  // Items sauber initialisieren/aktualisieren
  React.useEffect(() => {
    if (materials.length === 0 || products.length === 0) return;

    const tempProducts: ProductItem[] = products.map((product) => ({
      ...product,
      itemType: ItemType.food,
    }));

    const tempMaterials: MaterialItem[] = materials.map((material) => ({
      ...material,
      itemType: ItemType.material,
    }));

    const tempItems = [...tempProducts, ...tempMaterials];
    Utils.sortArray({array: tempItems, attributeName: "name"});

    setItems(tempItems);
  }, [materials, products]);

  React.useEffect(() => {
    setInputValue(typeof item === "string" ? item : (item?.name ?? ""));
  }, [item]);

  const objectId = "item_" + componentKey;

  return (
    <Autocomplete
      key={objectId}
      id={objectId}
      options={items}
      disabled={disabled}
      fullWidth
      // Freitext ist immer technisch erlaubt, aber wir committen ihn nur,
      // wenn allowFreeText=true (via blur/onChange)
      freeSolo
      // In Freitext-Modus NICHT autoSelect, sonst wird beim Tab/Blur evtl. ein Vorschlag genommen
      autoSelect={!allowFreeText}
      autoHighlight
      // value kann Item | string | null sein
      value={item}
      inputValue={inputValue}
      onInputChange={(_, newInputValue) => {
        setInputValue(newInputValue);
      }}
      isOptionEqualToValue={(option, value) => {
        if (typeof value === "string") {
          return option.name === value;
        }
        return option.name === value?.name;
      }}
      getOptionLabel={(option) => {
        if (typeof option === "string") return option;

        // Nur für den Create-Flow relevant (wenn er aktiv ist)
        if (!allowFreeText && option.name.endsWith(ADD)) {
          const words = option.name.match('".*"');
          if (words && words.length >= 0) {
            return words[0].slice(1, -1);
          }
        }
        return option.name;
      }}
      onChange={(event, newValue, action) => {
        // Bei Auswahl aus der Liste merken, damit onBlur nicht doppelt feuert
        if (
          action === "selectOption" &&
          newValue &&
          typeof newValue !== "string"
        ) {
          lastSelectedNameRef.current = newValue.name;
        }

        onChange(
          event as unknown as React.ChangeEvent<HTMLInputElement>,
          newValue as any,
          action,
          objectId,
        );
      }}
      // Wenn der User nur tippt und raus-tabt: Text übernehmen (ohne Creation)
      onBlur={(event) => {
        if (!allowFreeText) return;

        const text = inputValue?.trim();
        if (text === "") {
          lastSelectedNameRef.current = "";
          onChange(
            event as unknown as React.ChangeEvent<HTMLInputElement>,
            null,
            "blur",
            objectId,
          );
          return;
        }

        // Auswahl wurde bereits via onChange("selectOption") verarbeitet —
        // onBlur soll nicht ein zweites Mal feuern.
        if (
          lastSelectedNameRef.current &&
          lastSelectedNameRef.current.toLowerCase() === text.toLowerCase()
        ) {
          lastSelectedNameRef.current = "";
          return;
        }
        lastSelectedNameRef.current = "";

        // Wenn exakt ein bestehender Eintrag passt, optional den nehmen
        const existing = items.find(
          (it) => it.name.toLowerCase() === text.toLowerCase(),
        );

        onChange(
          event as unknown as React.ChangeEvent<HTMLInputElement>,
          existing ?? text,
          "blur",
          objectId,
        );
      }}
      filterOptions={(options, params) => {
        let filtered = filter(options, params) as Item[];

        // NEU: Im Freitext-Modus KEINE "ADD" Option mehr reinschmuggeln,
        // damit nie ein Creation-Flow "aus Versehen" passiert.
        if (allowFreeText) {
          return filtered;
        }

        if (
          params.inputValue !== "" &&
          items.find(
            (it) => it.name.toLowerCase() === params.inputValue.toLowerCase(),
          ) === undefined &&
          !params.inputValue.endsWith(ADD)
        ) {
          if (allowCreateNewItem) {
            const newMaterial: MaterialItem = {
              ...createEmptyMaterial(),
              itemType: ItemType.material,
              name: `"${params.inputValue}" ${ADD}`,
            };
            filtered.push(newMaterial);
          }
        }

        // SortRank Logik behalten
        let tempFiltered = filtered.map((entry) => {
          const startsWith =
            entry.name.substring(0, params.inputValue.length).toLowerCase() ===
            params.inputValue.toLowerCase();

          return {...entry, sortRank: startsWith ? 1 : 100};
        }) as filterHelpWithSortRank[];

        tempFiltered = Utils.sortArray({
          array: tempFiltered,
          attributeName: "sortRank",
        });

        filtered = tempFiltered.map((entry) => {
          delete entry.sortRank;
          return entry as Item;
        });

        return filtered;
      }}
      renderOption={(props, option) => {
        const {key, ...optionProps} = props;
        return (
          <li key={key} {...optionProps}>
            {option.name}
          </li>
        );
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={ITEM}
          error={error.isError}
          size={size}
          helperText={
            error.isError
              ? error.errorText
              : disabled
                ? ITEM_CANT_BE_CHANGED
                : ""
          }
        />
      )}
    />
  );
};
export {ItemAutocomplete};
