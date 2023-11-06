import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";
import { measure } from "./measure.mjs";
import { produce, setUseStrictShallowCopy } from "immer";

console.log("\n# large-obj - mutate large object\n");

const MAX = 50;

function create(value, config) {
  const tnm = new TotallyNotMutable(config);
  tnm.setValue(value);
  return tnm;
}

function mutate(value, mutate, config) {
  const tnm = create(value, config);
  return tnm.mutate(mutate);
}

const baseState = Object.fromEntries(
  Array(10000)
    .fill(0)
    .map((_, i) => [i, i])
);

measure("immer - with setUseStrictShallowCopy", () => {
  setUseStrictShallowCopy(true);

  for (let i = 0; i < MAX; i++) {
    produce(baseState, (draft) => {
      draft[5000]++;
    });
  }
});

measure("immer - without setUseStrictShallowCopy", () => {
  setUseStrictShallowCopy(false);

  for (let i = 0; i < MAX; i++) {
    produce(baseState, (draft) => {
      draft[5000]++;
    });
  }
});

measure("TotallyNotMutable", () => {
  for (let i = 0; i < MAX; i++) {
    mutate(baseState, (draft) => {
      draft[5000]++;
    });
  }
});

measure("TotallyNotMutable w/autofreeze", () => {
  for (let i = 0; i < MAX; i++) {
    mutate(
      baseState,
      (draft) => {
        draft[5000]++;
      },
      { autoFreeze: true }
    );
  }
});
