"use strict";

import { measure } from "./measure.mjs";
import { produce, setAutoFreeze } from "immer";
import cloneDeep from "lodash.clonedeep";
import immutable from "immutable";
const { fromJS } = immutable;
import Seamless from "seamless-immutable";
import deepFreeze from "deep-freeze";
import { TotallyNotMutable, mutate } from "../../build/TotallyNotMutable.js";

console.log("\n# add-data - loading large set of data\n");

import dataSet from "./data.json" assert { type: "json" };
import {
  getTotallyInitialState,
  getTotallyInitialStateAutofreeze,
} from "./todo.mjs";

const baseState = {
  data: null,
};
const immutableJsBaseState = fromJS(baseState);
const seamlessBaseState = Seamless.from(baseState);

const MAX = 10000;

measure(
  "just mutate",
  () => ({ draft: cloneDeep(baseState) }),
  ({ draft }) => {
    draft.data = dataSet;
  }
);

measure(
  "just mutate, freeze",
  () => ({ draft: cloneDeep(baseState) }),
  ({ draft }) => {
    draft.data = dataSet;
    deepFreeze(draft);
  }
);

measure("handcrafted reducer (no freeze)", () => {
  const nextState = {
    ...baseState,
    data: dataSet,
  };
});

measure("handcrafted reducer (with freeze)", () => {
  const nextState = deepFreeze({
    ...baseState,
    data: dataSet,
  });
});

measure("immutableJS", () => {
  let state = immutableJsBaseState.withMutations((state) => {
    state.setIn(["data"], fromJS(dataSet));
  });
});

measure("immutableJS + toJS", () => {
  let state = immutableJsBaseState
    .withMutations((state) => {
      state.setIn(["data"], fromJS(dataSet));
    })
    .toJS();
});

measure("immutableJS read big data set", () => {
  fromJS(dataSet).withMutations(() => {});
});

measure("seamless-immutable", () => {
  seamlessBaseState.set("data", dataSet);
});

measure("seamless-immutable + asMutable", () => {
  seamlessBaseState.set("data", dataSet).asMutable({ deep: true });
});

measure("seamless-immutable read big data set", () => {
  Seamless.from(dataSet);
});

measure("immer - without autofreeze", () => {
  setAutoFreeze(false);
  produce(baseState, (draft) => {
    draft.data = dataSet;
  });
});

measure("immer - with autofreeze", () => {
  setAutoFreeze(true);
  produce(baseState, (draft) => {
    draft.data = dataSet;
  });
});

measure("immer - without autofreeze * " + MAX, () => {
  setAutoFreeze(false);

  produce(baseState, (draft) => {
    for (let i = 0; i < MAX; i++) draft.data = dataSet;
  });
});

measure("immer - with autofreeze * " + MAX, () => {
  setAutoFreeze(true);
  produce(baseState, (draft) => {
    for (let i = 0; i < MAX; i++) draft.data = dataSet;
  });
});

measure("immer - read big data set", () => {
  setAutoFreeze(false);
  produce(dataSet, () => {});
});

measure(
  "TotallyNotMutable - without autofreeze",
  () => getTotallyInitialState(baseState),
  /**
   *
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    tnm.mutate((draft) => {
      draft.data = dataSet;
    });
  }
);

measure(
  "TotallyNotMutable - with autofreeze",
  () => getTotallyInitialStateAutofreeze(baseState),
  /**
   *
   * @param {TotallyNotMutable} tnm
   */ (tnm) => {
    tnm.mutate((draft) => {
      draft.data = dataSet;
    });
  }
);

measure(
  "TotallyNotMutable - without autofreeze * " + MAX,
  () => getTotallyInitialState(baseState),
  /**
   *
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    tnm.mutate((draft) => {
      for (let i = 0; i < MAX; i++) draft.data = dataSet;
    });
  }
);

measure(
  "TotallyNotMutable - with autofreeze * " + MAX,
  () => getTotallyInitialStateAutofreeze(baseState),
  /**
   *
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    tnm.mutate((draft) => {
      for (let i = 0; i < MAX; i++) draft.data = dataSet;
    });
  }
);

measure("TotallyNotMutable - read big data set", () => {
  mutate(dataSet, () => {});
});
