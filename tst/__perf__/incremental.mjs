"use strict";
import { measure } from "./measure.mjs";
import { produce, setAutoFreeze } from "immer";
import cloneDeep from "lodash.clonedeep";
import Immutable from "immutable";
import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

console.log("\n# incremental - lot of small incremental changes\n");

function createTestObject() {
  return {
    a: 1,
    b: "Some data here",
  };
}

const MAX = 1000;
const baseState = {
  ids: [],
  map: Object.create(null),
};

measure(
  "just mutate",
  () => cloneDeep(baseState),
  (draft) => {
    for (let i = 0; i < MAX; i++) {
      draft.ids.push(i);
      draft.map[i] = createTestObject();
    }
  }
);

measure(
  "handcrafted reducer",
  () => cloneDeep(baseState),
  (state) => {
    for (let i = 0; i < MAX; i++) {
      state = {
        ids: [...state.ids, i],
        map: {
          ...state.map,
          [i]: createTestObject(),
        },
      };
    }
  }
);

measure(
  "immutableJS",
  () => cloneDeep(baseState),
  (state) => {
    state = Immutable.fromJS(state);

    for (let i = 0; i < MAX; i++) {
      state = state.updateIn(["ids"], (arr) => arr.push(i));
      state = state.updateIn(["map"], (arr) =>
        arr.set(i, Immutable.Map(createTestObject()))
      );
    }
  }
);

measure(
  "immutableJS - single withMutations",
  () => cloneDeep(baseState),
  (state) => {
    state = Immutable.fromJS(state);
    state.withMutations((state) => {
      for (let i = 0; i < MAX; i++) {
        state.updateIn(["ids"], (arr) => arr.push(i));
        state.updateIn(["map"], (arr) =>
          arr.set(i, Immutable.Map(createTestObject()))
        );
      }
    });
  }
);

measure(
  "immer - multiple produces",
  () => {
    setAutoFreeze(false);
    return cloneDeep(baseState);
  },
  (state) => {
    for (let i = 0; i < MAX; i++) {
      state = produce(state, (draft) => {
        draft.ids.push(i);
        draft.map[i] = createTestObject();
      });
    }
  }
);

measure(
  "immer - single produce",
  () => {
    setAutoFreeze(false);
    return cloneDeep(baseState);
  },
  (state) => {
    produce(state, (draft) => {
      for (let i = 0; i < MAX; i++) {
        draft.ids.push(i);
        draft.map[i] = createTestObject();
      }
    });
  }
);

measure(
  "TotallyNotMutable - multiple mutates",
  () => {
    return cloneDeep(baseState);
  },
  (state) => {
    const tnm = new TotallyNotMutable();
    state = tnm.setValue(state);
    for (let i = 0; i < MAX; i++) {
      state = tnm.mutate((draft) => {
        draft.ids.push(i);
        draft.map[i] = createTestObject();
      });
    }
  }
);

measure(
  "TotallyNotMutable - single mutate",
  () => {
    return cloneDeep(baseState);
  },
  (state) => {
    const tnm = new TotallyNotMutable();
    state = tnm.setValue(state);
    state = tnm.mutate((draft) => {
      for (let i = 0; i < MAX; i++) {
        draft.ids.push(i);
        draft.map[i] = createTestObject();
      }
    });
  }
);
