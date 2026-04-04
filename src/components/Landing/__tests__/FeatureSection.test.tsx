import React from "react";
import {render, screen, act} from "@testing-library/react";
import "@testing-library/jest-dom";
import {ThemeProvider, createTheme} from "@mui/material/styles";
import MenuBookIcon from "@mui/icons-material/MenuBook";
import Diversity3Icon from "@mui/icons-material/Diversity3";

import {FeatureSection} from "../FeatureSection";
import type {LandingFeature} from "../landingFeatures";

// IntersectionObserver-Mock: observe() löst Callback aus (nach Konstruktor-Return)
type IntersectionCallback = (entries: Partial<IntersectionObserverEntry>[]) => void;

beforeEach(() => {
  global.IntersectionObserver = jest.fn((callback: IntersectionCallback) => {
    const instance = {
      observe: jest.fn((target: Element) => {
        // Callback nach Konstruktor-Return auslösen
        callback([{isIntersecting: true, target}]);
      }),
      unobserve: jest.fn(),
      disconnect: jest.fn(),
      root: null,
      rootMargin: "",
      thresholds: [],
      takeRecords: jest.fn(),
    };
    return instance;
  }) as unknown as typeof IntersectionObserver;
});


const theme = createTheme();

const featureWithImage: LandingFeature = {
  id: "recipes",
  icon: MenuBookIcon,
  title: "Entdecke neue Rezepte",
  description: "Finde inspirierende Rezepte",
  imagePath: "/images/landing/recipes.png",
  slideDirection: "left",
};

const featureWithoutImage: LandingFeature = {
  id: "social",
  icon: Diversity3Icon,
  title: "Gemeinsam kochen",
  description: "Teile deine Abenteuer",
  slideDirection: "left",
};

const renderFeature = (feature: LandingFeature, index = 0) => {
  let result: ReturnType<typeof render>;
  act(() => {
    result = render(
      <ThemeProvider theme={theme}>
        <FeatureSection feature={feature} index={index} />
      </ThemeProvider>,
    );
  });
  return result!;
};

describe("FeatureSection", () => {
  test("zeigt Titel und Beschreibung an", () => {
    renderFeature(featureWithImage);
    // Elemente sind im DOM auch wenn durch Fade/Slide noch nicht vollständig sichtbar
    expect(screen.getByText("Entdecke neue Rezepte", {exact: true})).toBeInTheDocument();
    expect(screen.getByText("Finde inspirierende Rezepte", {exact: true})).toBeInTheDocument();
  });

  test("zeigt ImageCard wenn imageKey vorhanden", () => {
    renderFeature(featureWithImage);
    const image = screen.getByAltText("Entdecke neue Rezepte");
    expect(image).toBeInTheDocument();
  });

  test("rendert ohne visuelle Spalte wenn weder imagePath noch animationComponent", () => {
    renderFeature(featureWithoutImage);
    // Titel wird angezeigt, aber kein Bild
    expect(screen.getByText("Gemeinsam kochen", {exact: true})).toBeInTheDocument();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  test("akzeptiert Feature-Props und rendert korrekt", () => {
    renderFeature(featureWithImage, 1);
    expect(
      screen.getByRole("heading", {level: 3, hidden: true}),
    ).toHaveTextContent("Entdecke neue Rezepte");
  });
});
