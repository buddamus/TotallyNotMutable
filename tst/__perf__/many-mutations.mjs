"use strict";

/**
 * These tests are strictly to test the entire time it takes to do a lot of updated
 */

import { measure } from "./measure.mjs";
import { produce, setAutoFreeze } from "immer";
import immutable from "immutable";
import Seamless from "seamless-immutable";

import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

const { List, Record } = immutable;

const MAX = 1000;

const baseState = [];

// produce the base state
for (let i = 0; i < MAX; i++) {
  baseState.push({
    todo: "todo_" + i,
    done: false,
    someThingCompletelyIrrelevant: [1, 2, 3, 4, 5, 6, 7, 8, 9, 0],
  });
}

console.log(`\n# ${MAX} mutations - performance\n`);

measure("immutableJS + one toJs", () => {
  // generate immutalbeJS base state
  const todoRecord = Record({
    todo: "",
    done: false,
    someThingCompletelyIrrelevant: [],
  });
  let updatedState = List(baseState.map((todo) => todoRecord(todo)));
  for (let i = 0; i < MAX; i++) {
    updatedState = updatedState.withMutations((state) => {
      state.setIn([i, "done"], true);
    });
  }
  updatedState.toJS();
});

measure("seamless-immutable", () => {
  let state = Seamless.from(baseState);

  for (let i = 0; i < MAX; i++) {
    state = state.setIn([i, "done"], true);
  }
});

measure(
  "immer - without autofreeze",
  () => {
    setAutoFreeze(false);
  },
  () => {
    let updatedState = baseState;
    for (let i = 0; i < MAX; i++) {
      updatedState = produce(baseState, (draft) => {
        draft[i].done = true;
      });
    }
  }
);

measure(
  "TotallyNotMutable",

  () => {
    const tnm = new TotallyNotMutable();
    tnm.setValue(baseState);
    for (let i = 0; i < MAX; i++) {
      tnm.mutate((state) => {
        state[i].done = true;
      });
    }
  }
);
