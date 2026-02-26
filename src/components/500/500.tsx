import React from "react";
import {
  PAGE_TITLE_500 as TEXT_PAGE_TITLE_500,
  PAGE_TEXT_1_500 as TEXT_PAGE_TEXT_1_500,
  PAGE_TEXT_2_500 as TEXT_PAGE_TEXT_2_500,
  PAGE_TEXT_3_500 as TEXT_PAGE_TEXT_3_500,
} from "../../constants/text";
import Typography from "@mui/material/Typography";
import {Box, Container, Stack} from "@mui/material";

import {ImageRepository} from "../../constants/imageRepository";
/* ===================================================================
// =============================== Page ==============================
// =================================================================== */
const ErrorInfo = () => {
  return (
    <React.Fragment>
      <Container component="main" maxWidth="sm">
        <Stack spacing={4} alignItems="center" justifyContent="center">
          <Box
            component="img"
            src={ImageRepository.getEnvironmentRelatedPicture().LANDING_LOGO}
            width="35em"
            alt="Logo"
          />

          <Typography variant="h2" color="textSecondary" align="center">
            {TEXT_PAGE_TITLE_500}
          </Typography>
          <br />
          <Typography align="center">{TEXT_PAGE_TEXT_1_500}</Typography>
          <br />
          <Typography align="center">{TEXT_PAGE_TEXT_2_500}</Typography>
          <br />
          <Typography align="center">{TEXT_PAGE_TEXT_3_500}</Typography>
        </Stack>
      </Container>
    </React.Fragment>
  );
};
export default ErrorInfo;
