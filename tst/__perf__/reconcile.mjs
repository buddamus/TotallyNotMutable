import { measure } from "./measure.mjs";
import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

const MAX = 100;
import dataSet from "./data.json" with { type: "json" };

const copy1 = JSON.parse(JSON.stringify(dataSet));
const copy2 = JSON.parse(JSON.stringify(dataSet));

const setup = () => {
  const tnm = new TotallyNotMutable();
  tnm.setValue(dataSet);
  return tnm;
};

measure(
  "setValue " + MAX + " times",
  setup,

  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    tnm.setValue(dataSet);
    for (let i = 0; i < MAX; i++) {
      tnm.setValue(dataSet);
    }
  }
);

measure(
  "reconcile " + MAX + " times - without structural sharing",
  setup,
  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    for (let i = 0; i < MAX; i++) {
      //copy 1 and two will not have any shared references dude to JSON.stringify
      tnm.reconcile(i % 2 ? copy1 : copy2);
    }
  }
);

measure(
  "reconcile " + MAX + " times - with structural sharing",
  () => {
    const tnm = setup();
    const mutation1 = tnm.mutate((val) => (val[0].id = "mutation1"));
    const mutation2 = tnm.mutate((val) => (val[0].id = "mutation2"));
    return { tnm, mutation1, mutation2 };
  },
  ({ tnm, mutation1, mutation2 }) => {
    for (let i = 0; i < MAX; i++) {
      //mutation1 and mutation2 share all but one field, so reconcile() only
      //re-processes what changed - this is the case it is built for
      tnm.reconcile(i % 2 ? mutation1 : mutation2);
    }
  }
);

const reconcileMutateSetup = () => {
  const tnm = setup();
  const v1 = tnm.mutate((val) => (val[0].id = "v1"));
  const v2 = tnm.mutate((val) => (val[0].id = "v2"));
  return { tnm, v1, v2 };
};

//mutate after every reconcile - the pattern where the eager proxy diff should pay off
measure(
  "reconcile -> mutate " + MAX + " times",
  reconcileMutateSetup,
  ({ tnm, v1, v2 }) => {
    for (let i = 0; i < MAX; i++) {
      tnm.reconcile(i % 2 ? v1 : v2);
      tnm.mutate((val) => (val[0].id = "edit" + i));
    }
  }
);

//navigate several versions, then a single edit - the pattern where dropping the
//proxy and rebuilding lazily on the next mutate should win
measure(
  "reconcile x10 -> mutate " + MAX + " times",
  reconcileMutateSetup,
  ({ tnm, v1, v2 }) => {
    for (let i = 0; i < MAX; i++) {
      for (let j = 0; j < 10; j++) tnm.reconcile(j % 2 ? v1 : v2);
      tnm.mutate((val) => (val[0].id = "edit" + i));
    }
  }
);
