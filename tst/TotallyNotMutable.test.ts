import { TotallyNotMutable } from "../src/TotallyNotMutable";

//do each test with auto freeze on/off
[true, false].forEach((autoFreeze) => {
  function create<T>(value: T) {
    const tnm = new TotallyNotMutable<T>({ autoFreeze });
    tnm.setValue(value);
    return tnm;
  }

  function mutate<T>(value: T, mutate: (value: T) => void): T {
    const tnm = create(value);
    return tnm.mutate(mutate);
  }

  describe("TotallyNotMutable autofreeze:" + autoFreeze, () => {
    // describe("apply", () => {
    //   it("simple object", () => {
    //     const init = { foo: true, bar: false, obj: { hello: "hello" } };
    //     const tnm = create(init);
    //     const newValue = { ...init, bar: true };
    //     let updatedValue = tnm.apply(newValue);
    //     expect(updatedValue === newValue).toEqual(true);
    //     updatedValue = tnm.mutate((value) => {
    //       value.foo = false;
    //     });
    //     expect(updatedValue === newValue).toEqual(false);
    //     expect(updatedValue).toEqual({
    //       foo: false,
    //       bar: true,
    //       obj: { hello: "hello" },
    //     });
    //     expect(updatedValue.obj === init.obj).toEqual(true);
    //   });

    //   it("nested object", () => {
    //     const init = {
    //       foo: true,
    //       bar: false,
    //       obj1: {
    //         foo: true,
    //         bar: false,
    //         obj2: { foo: true, bar: false, obj3: { foo: true, bar: false } },
    //       },
    //       obj2: {
    //         foo: true,
    //         bar: false,
    //       },
    //     };
    //     const tnm = create(init);
    //     const secondValue = tnm.mutate((val) => (val.obj1.obj2.foo = false));
    //     expect(secondValue === init).toEqual(false);
    //     expect(secondValue.obj1.obj2.obj3 === init.obj1.obj2.obj3).toEqual(
    //       true
    //     );
    //     expect(secondValue.obj2 === init.obj2).toEqual(true);
    //     const appliedValue = tnm.apply(init);
    //     expect(appliedValue === init).toEqual(true);
    //     const lastValue = tnm.mutate((val) => (val.obj1.obj2.obj3.foo = false));
    //     expect(appliedValue === lastValue).toEqual(false);
    //     expect(appliedValue.obj2 === lastValue.obj2).toEqual(true);
    //   });

    //   it("Map", () => {
    //     const mapMalues = [
    //       ["test", "value"],
    //       ["hello", "world"],
    //       ["foo", "bar"],
    //     ] as const;

    //     const init = new Map<string, string>(mapMalues);

    //     const tnm = create(init);

    //     const mutatedValue = tnm.mutate((val) => {
    //       val.set("test", "newval");
    //       val.delete("foo");
    //       val.set("newkey", "yayy");
    //     });

    //     const appliedValue = tnm.apply(init);

    //     expect(mutatedValue === init).toEqual(false);
    //     expect(appliedValue === init).toEqual(true);
    //     const finalValue = tnm.mutate((val) => {
    //       val.set("final", "final");
    //     });

    //     expect(finalValue).toEqual(new Map([...mapMalues, ["final", "final"]]));
    //   });

    //   it("plain object", () => {
    //     const arr: Record<string, { foo: string }> = {
    //       a: { foo: "initial" },
    //       b: { foo: "initial" },
    //       c: { foo: "initial" },
    //     };

    //     const tnm = create(arr);
    //     const mutatedValue = tnm.mutate((val) => {
    //       delete val.b;
    //     });
    //     expect(mutatedValue).toEqual({
    //       a: { foo: "initial" },
    //       c: { foo: "initial" },
    //     });
    //   });

    //   it("array", () => {
    //     const arr: { foo: string }[] = [
    //       { foo: "initial" },
    //       { foo: "initial" },
    //       { foo: "initial" },
    //     ];

    //     const tnm = create(arr);

    //     const mutatedValue = tnm.mutate((val) => {
    //       val.splice(1, 1);
    //     });

    //     expect(mutatedValue).toEqual([{ foo: "initial" }, { foo: "initial" }]);

    //     const appliedValue = tnm.apply(arr);
    //     expect(appliedValue).toEqual([
    //       { foo: "initial" },
    //       { foo: "initial" },
    //       { foo: "initial" },
    //     ]);

    //     expect(mutatedValue === arr).toEqual(false);
    //     expect(appliedValue === arr).toEqual(true);

    //     console.log("MUTATING AGAIN..");
    //     const finalValue = tnm.mutate((val) => {
    //       console.log({ val });
    //       val.splice(1, 1);
    //       console.log({ val });
    //       val[0].foo = "mutated again";
    //     });

    //     expect(finalValue).toEqual([
    //       { foo: "mutated again" },
    //       { foo: "initial" },
    //     ]);
    //   });
    // });

    describe("array object", () => {
      it("change at index", () => {
        const init = [
          { b: true },
          { b: true },
          { b: true },
          { b: true },
          { b: true },
        ];

        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });

        tnm.setValue(init);

        const ensureInitCorrect = () => {
          expect(init).toEqual([
            { b: true },
            { b: true },
            { b: true },
            { b: true },
            { b: true },
          ]);
        };

        ensureInitCorrect();

        const result1 = tnm.mutate((val) => {
          val[2].b = false;
        });

        const ensureResult1Correct = () => {
          expect(result1).toEqual([
            { b: true },
            { b: true },
            { b: false },
            { b: true },
            { b: true },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        const result2 = tnm.mutate((val) => {
          val.push({ b: false });
        });

        const ensureResult2Correct = () => {
          expect(result2).toEqual([
            { b: true },
            { b: true },
            { b: false },
            { b: true },
            { b: true },
            { b: false },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        ensureResult2Correct();

        const result3 = tnm.mutate((val) => {
          val[5].b = true;
        });
        const ensureResult3Correct = () => {
          expect(result3).toEqual([
            { b: true },
            { b: true },
            { b: false },
            { b: true },
            { b: true },
            { b: true },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        ensureResult2Correct();
        ensureResult3Correct();

        const result4 = tnm.mutate((val) => {
          val.splice(2, 1, { b: false }, { b: false });
        });

        const ensureResult4Correct = () => {
          expect(result4).toEqual([
            { b: true },
            { b: true },
            { b: false },
            { b: false },
            { b: true },
            { b: true },
            { b: true },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        ensureResult2Correct();
        ensureResult3Correct();
        ensureResult4Correct();

        const result5 = tnm.mutate((val) => {
          val.push({ b: false });
        });

        const ensureResult5Correct = () => {
          expect(result5).toEqual([
            { b: true },
            { b: true },
            { b: false },
            { b: false },
            { b: true },
            { b: true },
            { b: true },
            { b: false },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        ensureResult2Correct();
        ensureResult3Correct();
        ensureResult4Correct();
        ensureResult5Correct();
        const result6 = tnm.mutate((val) => {
          val[0].b = false;
          val[1].b = false;
          val[2].b = false;
          val[3].b = false;
          val[4].b = false;
          val[5].b = true;
        });

        const ensureResult6Correct = () => {
          expect(result6).toEqual([
            { b: false },
            { b: false },
            { b: false },
            { b: false },
            { b: false },
            { b: true },
            { b: true },
            { b: false },
          ]);
        };

        ensureInitCorrect();
        ensureResult1Correct();
        ensureResult2Correct();
        ensureResult3Correct();
        ensureResult4Correct();
        ensureResult5Correct();
        ensureResult6Correct();
      });

      it("change at index", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const result = mutate(init, (val) => {
          val[2] = "updated";
        });
        expect(init).toEqual(["1", "2", "3", "4", "5"]);
        expect(result).toEqual(["1", "2", "updated", "4", "5"]);
      });

      it("push", () => {
        const init: string[] = [];
        const result = mutate(init, (val) => {
          val.push("test");
        });
        expect(result).toEqual(["test"]);
      });

      it("few nested pushes", () => {
        const init: Record<string, number>[][] = [[{ test: 1 }]];
        const result = mutate(init, (val) => {
          val[0].push({ test: 1 });
        });
        const result2 = mutate(result, (val) => {
          val[0][val[0].length - 1].test = 5;
        });
        expect(init === result).toEqual(false);
        expect(init === result2).toEqual(false);
        expect(result === result2).toEqual(false);
        expect(init[0] === result[0]).toEqual(false);
        expect(init[0] === result2[0]).toEqual(false);
        expect(result[0] === result2[0]).toEqual(false);
        expect(init).toEqual([[{ test: 1 }]]);
        expect(result).toEqual([[{ test: 1 }, { test: 1 }]]);
        expect(result2).toEqual([[{ test: 1 }, { test: 5 }]]);
      });

      it("arr.length = 0 (clearing)", () => {
        const init: string[] = ["val2", "val2"];

        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });
        tnm.setValue(init);
        const result = tnm.mutate((val) => {
          val.length = 0;
        });
        expect(result).toEqual([]);
      });

      it("pop", () => {
        const init: string[] = ["val1"];
        const result = mutate(init, (val) => {
          val.pop();
        });
        expect(init).toEqual(["val1"]);
        expect(result).toEqual([]);
      });

      it("splice", () => {
        const init: string[] = ["val1", "val2", "val3"];
        const result = mutate(init, (val) => {
          val.splice(1, 1);
        });
        expect(init).toEqual(["val1", "val2", "val3"]);
        expect(result).toEqual(["val1", "val3"]);
      });

      it("copyWithin", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const result = mutate(init, (val) => {
          val.copyWithin(0, 2, 4);
        });
        expect(init).toEqual(["1", "2", "3", "4", "5"]);
        expect(result).toEqual(["3", "4", "3", "4", "5"]);
      });

      it("fill", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const result = mutate(init, (val) => {
          val.fill("x", 2, 3);
          val.fill("x", 4);
        });
        expect(init).toEqual(["1", "2", "3", "4", "5"]);
        expect(result).toEqual(["1", "2", "x", "4", "x"]);
      });

      it("reverse", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const result = mutate(init, (val) => {
          val.reverse();
        });
        expect(init).toEqual(["1", "2", "3", "4", "5"]);
        expect(result).toEqual(["5", "4", "3", "2", "1"]);
      });

      it("shift", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const result = mutate(init, (val) => {
          val.shift();
        });
        expect(init).toEqual(["1", "2", "3", "4", "5"]);
        expect(result).toEqual(["2", "3", "4", "5"]);
      });

      it("sort", () => {
        const init: number[] = [2, 4, 1, 5, 3];
        const result = mutate(init, (val) => {
          val.sort((a, b) => a - b);
        });
        expect(init).toEqual([2, 4, 1, 5, 3]);
        expect(result).toEqual([1, 2, 3, 4, 5]);
      });

      it("unshift", () => {
        const init: number[] = [1, 2, 3, 4, 5];
        const result = mutate(init, (val) => {
          val.unshift(10, 9, 8);
        });
        expect(init).toEqual([1, 2, 3, 4, 5]);
        expect(result).toEqual([10, 9, 8, 1, 2, 3, 4, 5]);
      });
    });

    describe("Date() object", () => {
      it("setUTCHours", () => {
        const init = new Date(0);
        expect(init.getUTCHours()).toEqual(0);
        const result = mutate(init, (val) => {
          val.setUTCHours(12);
        });
        expect(result === init).toEqual(false);
        expect(result.getUTCHours()).toEqual(12);
      });
    });

    describe("Map() object", () => {
      it("set", () => {
        const init = new Map<string, string>();
        init.set("test", "value");

        const result = mutate(init, (val) => {
          val.set("newkey", "newval");
          val.set("test", "newval");
        });
        expect(result === init).toEqual(false);
        expect(result.get("newkey")).toEqual("newval");
        expect(result.get("test")).toEqual("newval");
        expect(init.get("test")).toEqual("value");
      });

      it("delete", () => {
        const init = new Map<string, string>();
        init.set("test", "value");
        init.set("test2", "value");

        const result = mutate(init, (val) => {
          val.delete("test2");
        });
        expect(result === init).toEqual(false);
        expect(result.get("test")).toEqual("value");
        expect(result.get("test2")).toEqual(undefined);
        expect(init.get("test2")).toEqual("value");
      });

      it("clear", () => {
        const init = new Map<string, string>();
        init.set("test", "value");

        const result = mutate(init, (val) => {
          val.clear();
        });
        expect(result === init).toEqual(false);
        expect(init.get("test")).toEqual("value");
        expect(result.size).toEqual(0);
      });
    });

    describe("Set() object", () => {
      it("set", () => {
        const init = new Set<string>(["test"]);
        const result = mutate(init, (val) => {
          val.add("newkey");
        });
        expect(result === init).toEqual(false);
        expect(init.has("newkey")).toEqual(false);
        expect(result.has("newkey")).toEqual(true);
      });

      it("clear", () => {
        const init = new Set<string>(["test"]);

        const result = mutate(init, (val) => {
          val.clear();
        });
        expect(result === init).toEqual(false);
        expect(init.has("test")).toEqual(true);
        expect(result.size).toEqual(0);
      });
    });

    describe("nested array", () => {
      it("push", () => {
        const init = { arr: [] as string[] };
        const result = mutate(init, (val) => {
          val.arr.push("test");
        });
        expect(result).toEqual({
          arr: ["test"],
        });
      });
    });

    describe("basic object", () => {
      it("set", () => {
        const init = { bool: true, s: "hello" };
        const result = mutate(init, (val) => {
          val.bool = false;
          val.s = "updated";
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual({ bool: true, s: "hello" });
        expect(result).toEqual({ bool: false, s: "updated" });
      });

      it("delete", () => {
        const init: { bool: boolean; s?: string } = { bool: true, s: "hello" };
        const result = mutate(init, (val) => {
          val.bool = false;
          delete val["s"];
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual({ bool: true, s: "hello" });
        expect(result).toEqual({ bool: false });
      });

      it("defineProperty", () => {
        const init: { bool: boolean; s?: string } = { bool: true };
        const result = mutate(init, (val) => {
          val.bool = false;
          Object.defineProperty(val, "s", { value: "hello" });
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual({ bool: true });
        expect(result).toEqual({ bool: false, s: "hello" });
      });
    });

    describe("funky", () => {
      it("set then mutate, reset back to original value then mutate", () => {
        const init: { bool: boolean; s?: string } = { bool: true };
        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });
        tnm.setValue(init);
        tnm.mutate((val) => {
          val.bool = false;
        });
        expect(tnm.getValue()).toEqual({ bool: false });
        const result = tnm.mutate((val) => {
          val.s = "hello";
        });
        expect(result).toEqual({ bool: false, s: "hello" });

        //do the same thing again
        tnm.setValue(init);
        expect(tnm.getValue()).toEqual(init);
        tnm.mutate((val) => {
          val.bool = false;
        });
        expect(tnm.getValue()).toEqual({ bool: false });
        const result2 = tnm.mutate((val) => {
          val.s = "hello";
        });
        expect(result2).toEqual({ bool: false, s: "hello" });
      });

      it("set multiple array indexes to the same object value then update the object afterwards #1", () => {
        const init: { test: boolean }[] = [];
        const result = mutate(init, (val) => {
          //create a value
          const sameVal: (typeof init)[number] = { test: true };
          //apply the same value in mutliple places
          val.push(sameVal);
          val.push(sameVal);

          //update the object in memory
          sameVal.test = false;
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual([]);
        expect(result).toEqual([{ test: false }, { test: false }]);
      });
      //THIS TEST SHOWS A BUG IN THE CODE, WILL BE FIXED IN AN UPCOMING VERSION
      it.skip("set multiple array indexes to the same object value then update the object afterwards #2", () => {
        const init: { test: boolean }[] = [];
        const result = mutate(init, (val) => {
          //create a value
          const sameVal: (typeof init)[number] = { test: true };
          //apply the same value in mutliple places
          val.push(sameVal);
          val.push(sameVal);

          //update the first item in the array (which should point to the same object as the second element)
          val[0].test = false;
          val.push(sameVal);
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual([]);
        expect(result).toEqual([
          { test: false },
          { test: false },
          { test: false },
        ]);
      });

      it("set multiple array indexes to the same object value then update the object afterwards #3", () => {
        const init: { test: boolean }[] = [];
        const sameVal: (typeof init)[number] = { test: true };
        const result = mutate(init, (val) => {
          //create a value

          //apply the same value in mutliple places
          val.push(sameVal);
          val.push(sameVal);
        });

        try {
          //update the object in memory (this will error if autofreeze in on)
          sameVal.test = false;
          expect(autoFreeze).toEqual(false);
          expect(result === init).toEqual(false);
          expect(init).toEqual([]);
          expect(result).toEqual([{ test: false }, { test: false }]);
        } catch (e) {
          expect(autoFreeze).toEqual(true);
        }
      });
    });

    describe("multiple mutations", () => {
      it("mutate twice - push", () => {
        const init = { key1: [] as string[], key2: { test: "test" } };
        const result = mutate(init, (val) => {
          val.key1.push("test");
        });

        const result2 = mutate(result, (val) => {
          val.key1.push("test");
        });
        expect(result === result2).toEqual(false);
        expect(result).toEqual({ key1: ["test"], key2: { test: "test" } });
        expect(result2).toEqual({
          key1: ["test", "test"],
          key2: { test: "test" },
        });
        //ensure structural sharing for untouched keys
        expect(result.key2 === result2.key2).toEqual(true);
      });

      it("mutate three times", () => {
        const init = {
          s: "hello",
          arr: [1, 2, 3],
          o: { a: "a", b: "b", c: "c" },
          untouchedObject: { foo: "bar" },
        };
        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });

        //set initial value
        const val1 = tnm.setValue(init);
        const ensureVal1Correct = () => {
          expect(val1).toEqual({
            s: "hello",
            arr: [1, 2, 3],
            o: { a: "a", b: "b", c: "c" },
            untouchedObject: { foo: "bar" },
          });
          expect(val1.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val1 === init).toEqual(true);
        };

        ensureVal1Correct();

        //mutate
        const val2 = tnm.mutate((draft) => {
          draft.arr.push(4);
          draft.s = "bye";
          draft.o.a = "updated a";
        });
        const ensureVal2Correct = () => {
          expect(val2).toEqual({
            s: "bye",
            arr: [1, 2, 3, 4],
            o: { a: "updated a", b: "b", c: "c" },
            untouchedObject: { foo: "bar" },
          });
          expect(val2.untouchedObject === init.untouchedObject).toEqual(true);
        };

        ensureVal1Correct();
        ensureVal2Correct();

        const val3 = tnm.mutate((draft) => {
          draft.arr.push(5);
          draft.s = "bye bye bye";
          draft.o.a = "updated a again";
        });

        const ensureVal3Correct = () => {
          expect(val3).toEqual({
            s: "bye bye bye",
            arr: [1, 2, 3, 4, 5],
            o: { a: "updated a again", b: "b", c: "c" },
            untouchedObject: { foo: "bar" },
          });
          expect(val3.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val3 === init).toEqual(false);
        };

        ensureVal1Correct();
        ensureVal2Correct();
        ensureVal3Correct();
      });

      it("mutate three times: set array -> push array -> replace array -> push array", () => {
        const init = {
          arr: [1, 2, 3],
          untouchedObject: { foo: "bar" },
        };
        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });

        //set initial value
        const val1 = tnm.setValue(init);
        const ensureVal1Correct = () => {
          expect(val1).toEqual({
            arr: [1, 2, 3],
            untouchedObject: { foo: "bar" },
          });
          expect(val1.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val1 === init).toEqual(true);
        };

        ensureVal1Correct();

        //mutate
        const val2 = tnm.mutate((draft) => {
          draft.arr.push(4);
        });
        const ensureVal2Correct = () => {
          expect(val2).toEqual({
            arr: [1, 2, 3, 4],
            untouchedObject: { foo: "bar" },
          });
          expect(val2.untouchedObject === init.untouchedObject).toEqual(true);
        };
        ensureVal1Correct();
        ensureVal2Correct();

        const val3 = tnm.mutate((draft) => {
          draft.arr = [10, 10, 10];
          draft.arr = [10, 10, 10];
        });

        const ensureVal3Correct = () => {
          expect(val3).toEqual({
            arr: [10, 10, 10],
            untouchedObject: { foo: "bar" },
          });
          expect(val3.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val3 === init).toEqual(false);
        };

        ensureVal1Correct();
        ensureVal2Correct();
        ensureVal3Correct();

        const val4 = tnm.mutate((draft) => {
          draft.arr.push(11);
        });

        const ensureVal4Correct = () => {
          expect(val4).toEqual({
            arr: [10, 10, 10, 11],
            untouchedObject: { foo: "bar" },
          });
          expect(val4.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val4 === init).toEqual(false);
        };

        ensureVal1Correct();
        ensureVal2Correct();
        ensureVal3Correct();
        ensureVal4Correct();
      });

      it("write a test that updates a child node then updates the parent afterwards", () => {
        const init = {
          o1: {
            foo: "bar",
            o2: {
              foo: "bar",
              o3: { foo: "bar" },
            },
          },
          untouchedObject: { foo: "bar" },
        };
        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });

        //set initial value
        const val1 = tnm.setValue(init);
        const ensureVal1Correct = () => {
          expect(val1).toEqual({
            o1: {
              foo: "bar",
              o2: {
                foo: "bar",
                o3: { foo: "bar" },
              },
            },
            untouchedObject: { foo: "bar" },
          });
          expect(val1.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val1 === init).toEqual(true);
        };

        const val2 = tnm.mutate((val) => {
          val.o1.o2.o3 = { foo: "update 1" };
          val.o1.o2 = { foo: "update 2", o3: { foo: "update 2" } };
        });

        const ensureVal2Correct = () => {
          expect(val2).toEqual({
            o1: {
              foo: "bar",
              o2: {
                foo: "update 2",
                o3: { foo: "update 2" },
              },
            },
            untouchedObject: { foo: "bar" },
          });
          expect(val2.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val2 === init).toEqual(false);
        };

        ensureVal1Correct();
        ensureVal2Correct();
      });

      it("write a test that updates a child node then updates the parent ARRAY afterwards", () => {
        const init = {
          o1: {
            foo: "bar",
            o2: {
              foo: "bar",
              arr: ["foo", "bar"],
            },
          },
          untouchedObject: { foo: "bar" },
        };
        const tnm = new TotallyNotMutable<typeof init>({ autoFreeze });

        //set initial value
        const val1 = tnm.setValue(init);
        const ensureVal1Correct = () => {
          expect(val1).toEqual({
            o1: {
              foo: "bar",
              o2: {
                foo: "bar",
                arr: ["foo", "bar"],
              },
            },
            untouchedObject: { foo: "bar" },
          });
          expect(val1.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val1 === init).toEqual(true);
        };

        const val2 = tnm.mutate((val) => {
          val.o1.o2.arr = ["update 1"];
          val.o1.o2 = { foo: "update 2", arr: ["update 2"] };
        });

        const ensureVal2Correct = () => {
          expect(val2).toEqual({
            o1: {
              foo: "bar",
              o2: {
                foo: "update 2",
                arr: ["update 2"],
              },
            },
            untouchedObject: { foo: "bar" },
          });
          expect(val2.untouchedObject === init.untouchedObject).toEqual(true);
          expect(val2 === init).toEqual(false);
        };

        ensureVal1Correct();
        ensureVal2Correct();
      });
    });

    describe("untouched object references remain intact (triple equal checks)", () => {
      it("top level key change", () => {
        const init = { key1: [] as string[], key2: { test: "test" } };
        const result = mutate(init, (val) => {
          val.key1.push("test");
        });
        expect(init === result).toEqual(false);
        //since key2 was not touched, it should use the same object
        expect(init.key2 === result.key2).toEqual(true);
      });

      it("nested key change", () => {
        const init = {
          key1: { arr: [] as string[], untouchedKey: {} },
          key2: { test: "test" },
        };
        const result = mutate(init, (val) => {
          val.key1.arr.push("test");
        });

        //different refs
        expect(init === result).toEqual(false);
        expect(init.key1 === result.key1).toEqual(false);
        expect(init.key1.arr === result.key1.arr).toEqual(false);

        //same refs
        expect(init.key1.untouchedKey === result.key1.untouchedKey).toEqual(
          true
        );
        expect(init.key2 === result.key2).toEqual(true);
      });
    });
  });
});
