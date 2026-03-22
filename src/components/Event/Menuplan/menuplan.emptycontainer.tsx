import React, {useEffect, useRef, useState} from "react";
import {Container, Button} from "@mui/material";
import {dropTargetForElements} from "@atlaskit/pragmatic-drag-and-drop/element/adapter";
import {combine} from "@atlaskit/pragmatic-drag-and-drop/combine";
import invariant from "tiny-invariant";
import useCustomStyles from "../../../constants/styles";
import {Meal} from "./menuplan.types";

const emptyContainerKey = Symbol("empty-container");

export type TEmptyContainerData = {
  [emptyContainerKey]: true;
  mealUid: Meal["uid"];
};

export function isEmptyContainerData(
  data: Record<string | symbol, unknown>
): data is TEmptyContainerData {
  return data[emptyContainerKey] === true;
}

function getEmptyContainerData({
  mealUid,
}: {
  mealUid: Meal["uid"];
}): TEmptyContainerData {
  return {
    [emptyContainerKey]: true,
    mealUid,
  };
}

type StateType = "idle" | "draggedOver";
const idleState: StateType = "idle";
const draggedOverState: StateType = "draggedOver";
interface EmptyMealContainerProps {
  mealUid: Meal["uid"];
  buttonText: string;
  onCreateMenu: (mealUid: Meal["uid"]) => void;
}

export const EmptyMealContainer = ({
  mealUid,
  buttonText,
  onCreateMenu,
}: EmptyMealContainerProps) => {
  const classes = useCustomStyles();
  const ref = useRef<HTMLDivElement>(null);
  const [stateType, setStateType] = useState(idleState as StateType);

  useEffect(() => {
    const element = ref.current;
    invariant(element);

    const data = getEmptyContainerData({mealUid});

    return combine(
      dropTargetForElements({
        element,
        getData: () => data,
        onDragEnter: () => setStateType(draggedOverState),
        onDragLeave: () => setStateType(idleState),
        onDrop: () => setStateType(idleState),
      })
    );
  }, [mealUid]);

  return (
    <Container
      ref={ref}
      sx={classes.emptyMealBox[stateType]}
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
      }}
    >
      <Container sx={classes.centerCenter} style={{display: "flex"}}>
        <Button onClick={() => onCreateMenu(mealUid)}>{buttonText}</Button>
      </Container>
    </Container>
  );
};
