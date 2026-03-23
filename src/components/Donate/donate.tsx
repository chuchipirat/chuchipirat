import React from "react";

import {
  Container,
  Stack,
  Card,
  CardContent,
  Typography,
  Box,
} from "@mui/material";

import {
  DONATE as TEXT_DONATE,
  THANK_YOU_1000 as TEXT_THANK_YOU_1000,
  WHY_DONATE as TEXT_WHY_DONATE,
  NEED_A_RECEIPT as TEXT_NEED_A_RECEIPT,
  PLEASE_DONATE as TEXT_PLEASE_DONATE,
} from "../../constants/text";

import {useCustomStyles} from "../../constants/styles";

import {PageTitle} from "../Shared/pageTitle";
import {useAuthUser} from "../Session/authUserContext";
import AuthUser from "../Firebase/Authentication/authUser.class";
import {TwintButton} from "../Shared/TwintButton";
import {ImageRepository} from "../../constants/imageRepository";

/* ===================================================================
// ======================== globale Funktionen =======================
// =================================================================== */

/* ===================================================================
// =============================== Page ==============================
// =================================================================== */

/* ===================================================================
// =============================== Base ==============================
// =================================================================== */
const DonatePage = () => {
  const authUser = useAuthUser();
  const classes = useCustomStyles();

  if (!authUser) {
    return null;
  }

  return (
    <React.Fragment>
      {/*===== HEADER ===== */}
      <PageTitle title={TEXT_DONATE} subTitle={TEXT_THANK_YOU_1000} />
      {/* ===== BODY ===== */}
      <Container sx={classes.container} component="main" maxWidth="sm">
        <Card sx={classes.card} key={"cardInfo"}>
          <CardContent sx={classes.cardContent} key={"cardContentInfo"}>
            <Stack
              spacing={2}
              sx={{
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Typography>
                <strong>{TEXT_PLEASE_DONATE}</strong>
                <br />
                {TEXT_WHY_DONATE}
                <br />
                {TEXT_NEED_A_RECEIPT}
                <br />
                <br />
                {TEXT_THANK_YOU_1000}
              </Typography>
              <Box
                component="img"
                src={
                  ImageRepository.getEnvironmentRelatedPicture().TWINT_QR_CODE
                }
                sx={classes.cardMediaQrCode}
                style={{maxWidth: "100%", height: "auto"}}
              />
              <TwintButton />
            </Stack>
          </CardContent>
        </Card>
      </Container>
    </React.Fragment>
  );
};

export default DonatePage;
