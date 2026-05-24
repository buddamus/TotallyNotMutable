import { measure } from "./measure.mjs";
import { produce, setUseStrictShallowCopy } from "immer";
import Immutable from "immutable";
import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

console.log("\n# large-obj - mutate large object\n");

const MAX = 50;

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

measure("immutableJS", () => {
  for (let i = 0; i < MAX; i++) {
    const map = Immutable.Map(baseState);
    map.set("5000", map.get("5000") + 1);
  }
});

measure("immutableJS + toJs at end", () => {
  let result;
  for (let i = 0; i < MAX; i++) {
    const map = Immutable.Map(baseState);
    result = map.set("5000", map.get("5000") + 1);
  }
  //toJS() only when you actually need the plain value back - once, at the end
  result.toJS();
});

measure("TotallyNotMutable", () => {
  for (let i = 0; i < MAX; i++) {
    const tnm = new TotallyNotMutable();
    tnm.setValue(baseState);
    tnm.mutate((draft) => {
      draft[5000]++;
    });
  }
});

measure("TotallyNotMutable w/autofreeze", () => {
  for (let i = 0; i < MAX; i++) {
    const tnm = new TotallyNotMutable(undefined, { autoFreeze: true });
    tnm.setValue(baseState);
    tnm.mutate((draft) => {
      draft[5000]++;
    });
  }
});
