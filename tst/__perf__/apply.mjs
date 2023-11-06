import { measure } from "./measure.mjs";
import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

const MAX = 25;
import dataSet from "./data.json" assert { type: "json" };

const copy1 = JSON.parse(JSON.stringify(dataSet));
const copy2 = JSON.parse(JSON.stringify(dataSet));

const setup = () => {
  const tnm = new TotallyNotMutable();
  tnm.setValue(dataSet);
  return tnm;
};

measure(
  "setValue (object) " + MAX + " times",
  setup,

  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    for (let i = 0; i < MAX; i++) {
      tnm.setValue(dataSet);
    }
  }
);

measure(
  "apply (object) " + MAX + " times - without structural sharing",
  setup,
  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    for (let i = 0; i < MAX; i++) {
      //copy 1 and two will not have any shared references dude to JSON.stringify
      tnm.apply(i % 2 ? copy1 : copy2);
    }
  }
);

measure("apply (object) " + MAX + " times - with structural sharing", () => {
  const tnm = setup();
  const mutation1 = tnm.mutate((val) => (val[0].id = "mutation1"));
  const mutation2 = tnm.mutate((val) => (val[0].id = "mutation2"));
  return { tnm, mutation1, mutation2 };
}),
  /**
   *
   * @param {{tnm:TotallyNotMutable,mutation1:any,mutation2:any}} param0
   */
  ({ tnm, mutation1, mutation2 }) => {
    for (let i = 0; i < MAX; i++) {
      //copy 1 and two will not have any shared references dude to JSON.stringify
      tnm.apply(i % 2 ? mutation1 : mutation2);
    }
  };

const arr = [];
for (let i = 0; i < 5000; i++) {
  arr.push({ foo: true });
}
const copy1Array = JSON.parse(JSON.stringify(arr));
const copy2Array = JSON.parse(JSON.stringify(arr));

const setupArray = () => {
  const tnm = new TotallyNotMutable();

  tnm.setValue(arr);
  return tnm;
};

measure(
  "setValue (array) " + MAX + " times",
  setupArray,

  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    for (let i = 0; i < MAX; i++) {
      tnm.setValue(arr);
    }
  }
);

measure(
  "apply (array) " + MAX + " times - without structural sharing",
  setupArray,
  /**
   * @param {TotallyNotMutable} tnm
   */
  (tnm) => {
    for (let i = 0; i < MAX; i++) {
      //copy 1 and two will not have any shared references dude to JSON.stringify
      tnm.apply(i % 2 ? copy1Array : copy2Array);
    }
  }
);

measure("apply (array) " + MAX + " times - with structural sharing", () => {
  const tnm = setupArray();
  const mutation1 = tnm.mutate((val) => (val[0].id = "mutation1"));
  const mutation2 = tnm.mutate((val) => (val[0].id = "mutation2"));
  return { tnm, mutation1, mutation2 };
}),
  /**
   *
   * @param {{tnm:TotallyNotMutable,mutation1:any,mutation2:any}} param0
   */
  ({ tnm, mutation1, mutation2 }) => {
    for (let i = 0; i < MAX; i++) {
      //copy 1 and two will not have any shared references dude to JSON.stringify
      tnm.apply(i % 2 ? mutation1 : mutation2);
    }
  };
