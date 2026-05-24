import { TotallyNotMutable } from "../../build/TotallyNotMutable.js";

//Shared, side-effect-free helpers so importing them doesn't trigger another
//perf file's top-level benchmarks (which is why todo.mjs used to print twice).

const tnm = new TotallyNotMutable();
const tnmAutoFreeze = new TotallyNotMutable(undefined, { autoFreeze: true });

export const getTotallyInitialState = (value) => {
  tnm.setValue(value);
  return tnm;
};

export const getTotallyInitialStateAutofreeze = (value) => {
  tnmAutoFreeze.setValue(value);
  return tnmAutoFreeze;
};
