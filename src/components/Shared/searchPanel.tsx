import React from "react";

import {
  TextField,
  IconButton,
  InputAdornment,
  FormControl,
} from "@mui/material";

import SearchIcon from "@mui/icons-material/Search";
import ClearIcon from "@mui/icons-material/Clear";

import * as TEXT from "../../constants/text";

/* ===================================================================
// ============================= Such Panel ==========================
// =================================================================== */
interface SearchPanelProps {
  searchString: string;
  onUpdateSearchString: (
    event: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>
  ) => void;
  onClearSearchString: () => void;
}
const SearchPanel = ({
  searchString,
  onUpdateSearchString,
  onClearSearchString,
}: SearchPanelProps) => {
  return (
    <React.Fragment>
      <FormControl variant="outlined" fullWidth>
        <TextField
          label={TEXT.SEARCH_STRING}
          id={"searchString_input"}
          type={"text"}
          value={searchString}
          fullWidth={true}
          autoComplete="off"
          onChange={onUpdateSearchString}
          slotProps={{
            input: {
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label="clear Search Term"
                    onClick={() => {
                      if (searchString) {
                        onClearSearchString();
                      }
                    }}
                    edge="end"
                    size="small"
                  >
                    {!searchString ? <SearchIcon /> : <ClearIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            },
          }}
        />
      </FormControl>
    </React.Fragment>
  );
};

export {SearchPanel};
