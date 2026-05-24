import { TotallyNotMutable } from "../src/TotallyNotMutable";

//do each test with auto freeze on/off
[true, false].forEach((autoFreeze) => {
  function create<T extends object>(value: T) {
    const tnm = new TotallyNotMutable<T>(undefined, { autoFreeze });
    tnm.setValue(value);
    return tnm;
  }

  function mutate<T extends object>(value: T, mutate: (value: T) => void): T {
    const tnm = create(value);
    return tnm.mutate(mutate);
  }

  describe("TotallyNotMutable autofreeze:" + autoFreeze, () => {
    describe("reconcile", () => {
      it("simple object", () => {
        const init = { foo: true, bar: false, obj: { hello: "hello" } };
        const tnm = create(init);
        const newValue = { ...init, bar: true };
        let updatedValue = tnm.reconcile(newValue);
        expect(updatedValue === newValue).toEqual(true);
        updatedValue = tnm.mutate((value) => {
          value.foo = false;
        });
        expect(updatedValue === newValue).toEqual(false);
        expect(updatedValue).toEqual({
          foo: false,
          bar: true,
          obj: { hello: "hello" },
        });
        expect(updatedValue.obj === init.obj).toEqual(true);
      });

      it("nested object", () => {
        const init = {
          foo: true,
          bar: false,
          obj1: {
            foo: true,
            bar: false,
            obj2: { foo: true, bar: false, obj3: { foo: true, bar: false } },
          },
          obj2: {
            foo: true,
            bar: false,
          },
        };
        const tnm = create(init);
        const secondValue = tnm.mutate((val) => (val.obj1.obj2.foo = false));
        expect(secondValue === init).toEqual(false);
        expect(secondValue.obj1.obj2.obj3 === init.obj1.obj2.obj3).toEqual(
          true
        );
        expect(secondValue.obj2 === init.obj2).toEqual(true);
        const reconciledValue = tnm.reconcile(init);
        expect(reconciledValue === init).toEqual(true);
        const lastValue = tnm.mutate((val) => (val.obj1.obj2.obj3.foo = false));
        expect(reconciledValue === lastValue).toEqual(false);
        expect(reconciledValue.obj2 === lastValue.obj2).toEqual(true);
      });

      it("freezes the result when autoFreeze is on (matches setValue)", () => {
        const tnm = create({ a: [1, 2] });
        const applied = tnm.reconcile({ a: [1, 2, 3] });
        expect(Object.isFrozen(applied)).toEqual(autoFreeze);
        expect(Object.isFrozen(applied.a)).toEqual(autoFreeze);
      });

      it("as the first call (no prior value) falls back to setValue", () => {
        const tnm = new TotallyNotMutable<{ a: number }>(undefined, { autoFreeze });
        const init = { a: 1 };
        const applied = tnm.reconcile(init);
        expect(applied === init).toEqual(true);
        expect(tnm.getValue()).toEqual({ a: 1 });

        //the proxy is usable afterwards
        const next = tnm.mutate((v) => {
          v.a = 2;
        });
        expect(next).toEqual({ a: 2 });
      });

      describe("type changes at a key", () => {
        it("replaces an object value with a primitive", () => {
          const tnm = create<{ x: any }>({ x: { a: 1 } });
          const applied = tnm.reconcile({ x: 5 });
          expect(applied).toEqual({ x: 5 });
          const next = tnm.mutate((v) => {
            v.x = 6;
          });
          expect(next).toEqual({ x: 6 });
        });

        it("replaces a primitive with an object (later mutate sees a draft)", () => {
          const tnm = create<{ x: any }>({ x: 5 });
          const applied = tnm.reconcile({ x: { a: 1 } });
          expect(applied).toEqual({ x: { a: 1 } });
          const next = tnm.mutate((v) => {
            v.x.a = 2;
          });
          expect(next).toEqual({ x: { a: 2 } });
        });

        it("replaces an array with an object", () => {
          const tnm = create<{ x: any }>({ x: [1, 2, 3] });
          const applied = tnm.reconcile({ x: { a: 1 } });
          expect(applied).toEqual({ x: { a: 1 } });
        });
      });

      // Contract for every type below:
      //  - getValue() after reconcile() deep-equals the reconciled value
      //  - the inputs are never mutated
      //  - a subsequent mutate() sees a correct draft (reads included)
      //  - untouched branches keep their reference (structural sharing)
      describe("arrays", () => {
        it("shrinks a nested array (later mutate must see correct length)", () => {
          const init = { arr: [1, 2, 3, 4], keep: { x: 1 } };
          const tnm = create(init);

          const applied = tnm.reconcile({ arr: [1, 2], keep: init.keep });
          expect(applied).toEqual({ arr: [1, 2], keep: { x: 1 } });
          expect(tnm.getValue()).toEqual({ arr: [1, 2], keep: { x: 1 } });

          // reading the draft must reflect the applied (length-2) array
          const next = tnm.mutate((v) => v.arr.push(v.arr.length));
          expect(next.arr).toEqual([1, 2, 2]);

          // input never mutated
          expect(init.arr).toEqual([1, 2, 3, 4]);
        });

        it("grows a nested array (later mutate must see correct length)", () => {
          const init = { arr: [1, 2] };
          const tnm = create(init);

          tnm.reconcile({ arr: [1, 2, 3, 4] });
          const next = tnm.mutate((v) => v.arr.push(v.arr.length));
          expect(next.arr).toEqual([1, 2, 3, 4, 4]);
        });

        it("revert via reconcile preserves structural sharing of siblings", () => {
          const init = { a: [1, 2], b: { keep: true } };
          const tnm = create(init);

          tnm.mutate((v) => v.a.push(3));
          const reverted = tnm.reconcile(init);
          expect(reverted).toEqual({ a: [1, 2], b: { keep: true } });

          const v3 = tnm.mutate((v) => v.a.push(9));
          expect(v3.a).toEqual([1, 2, 9]);
          // b was untouched across reconcile+mutate -> shared reference
          expect(v3.b === init.b).toEqual(true);
        });
      });

      describe("Map", () => {
        it("applies added / removed / changed entries", () => {
          const init = new Map<string, number>([
            ["a", 1],
            ["b", 2],
          ]);
          const tnm = create(init);

          // removed "b", added "c", changed "a"
          const next = new Map<string, number>([
            ["a", 9],
            ["c", 3],
          ]);
          const applied = tnm.reconcile(next);
          expect(applied).toEqual(next);
          expect(tnm.getValue()).toEqual(
            new Map([
              ["a", 9],
              ["c", 3],
            ])
          );

          const v3 = tnm.mutate((m) => m.set("d", 4));
          expect(v3.get("a")).toEqual(9);
          expect(v3.get("b")).toBeUndefined();
          expect(v3.get("c")).toEqual(3);
          expect(v3.get("d")).toEqual(4);
          expect(v3.size).toEqual(3);

          // input untouched
          expect(init.get("a")).toEqual(1);
          expect(init.has("c")).toEqual(false);
        });

        it("shares untouched object values across reconcile", () => {
          const shared = { v: 1 };
          const init = new Map<string, { v: number }>([
            ["a", { v: 0 }],
            ["b", shared],
          ]);
          const tnm = create(init);

          tnm.mutate((m) => m.set("a", { v: 100 }));
          const reverted = tnm.reconcile(init);
          expect(reverted.get("b")).toEqual({ v: 1 });

          const v3 = tnm.mutate((m) => m.set("a", { v: 200 }));
          // "b" was never touched -> its object reference is shared
          expect(v3.get("b") === shared).toEqual(true);
        });
      });

      describe("Set", () => {
        it("applies added / removed members", () => {
          const init = new Set<number>([1, 2, 3]);
          const tnm = create(init);

          const next = new Set<number>([1, 3, 4]); // removed 2, added 4
          const applied = tnm.reconcile(next);
          expect(applied).toEqual(next);
          expect(tnm.getValue()).toEqual(new Set([1, 3, 4]));

          const v3 = tnm.mutate((s) => s.add(5));
          expect(v3.has(2)).toEqual(false);
          expect(v3.has(4)).toEqual(true);
          expect(v3.has(5)).toEqual(true);
          expect(v3.size).toEqual(4);

          // input untouched
          expect(init.has(4)).toEqual(false);
        });
      });

      describe("Date", () => {
        it("applies a changed date", () => {
          const init = { d: new Date(0), keep: { x: 1 } };
          const tnm = create(init);

          const newDate = new Date(0);
          newDate.setUTCFullYear(2030);

          const applied = tnm.reconcile({ d: newDate, keep: init.keep });
          expect(applied.d.getUTCFullYear()).toEqual(2030);
          expect(tnm.getValue()?.d.getUTCFullYear()).toEqual(2030);

          const v3 = tnm.mutate((v) => v.d.setUTCFullYear(2040));
          expect(v3.d.getUTCFullYear()).toEqual(2040);

          // input date untouched
          expect(init.d.getUTCFullYear()).toEqual(1970);
        });
      });

      // White-box: asserts the private proxy stays consistent with the
      // materialized value. Couples to internals on purpose - it is the only
      // way to observe the Map/Set/Date desync, which is invisible black-box.
      describe("internal proxy consistency (white-box)", () => {
        it("freeze returns undefined without throwing when given undefined", () => {
          const tnm = new TotallyNotMutable<{ a: number }>(undefined, {
            autoFreeze,
          });
          expect((tnm as any).freeze(undefined)).toBeUndefined();
        });

        it("keeps a root Map draft in sync with the value", () => {
          const tnm = create(new Map<string, number>([["a", 1]]));
          tnm.reconcile(
            new Map([
              ["a", 1],
              ["b", 2],
              ["c", 3],
            ])
          );
          const proxy: any = (tnm as any).proxy;
          expect(proxy.size).toEqual(tnm.getValue()?.size);
        });

        it("keeps a nested Map draft in sync with the value", () => {
          const init = { m: new Map<string, number>([["a", 1]]), keep: { x: 1 } };
          const tnm = create(init);
          tnm.reconcile({
            m: new Map([
              ["a", 1],
              ["b", 2],
            ]),
            keep: init.keep,
          });
          const proxy: any = (tnm as any).proxy;
          expect(proxy.m.size).toEqual(tnm.getValue()?.m.size);
        });

        it("keeps a root Set draft in sync with the value", () => {
          const tnm = create(new Set<number>([1]));
          tnm.reconcile(new Set([1, 2, 3]));
          const proxy: any = (tnm as any).proxy;
          expect(proxy.size).toEqual(tnm.getValue()?.size);
        });

        it("keeps a nested Set draft in sync with the value", () => {
          const init = { s: new Set<number>([1]), keep: { x: 1 } };
          const tnm = create(init);
          tnm.reconcile({ s: new Set([1, 2, 3]), keep: init.keep });
          const proxy: any = (tnm as any).proxy;
          expect(proxy.s.size).toEqual(tnm.getValue()?.s.size);
        });

        it("re-proxies a nested Date so the draft is not stale", () => {
          const init = { d: new Date(0), keep: { x: 1 } };
          const tnm = create(init);
          const before = (tnm as any).proxy.d;

          const newDate = new Date(0);
          newDate.setUTCFullYear(2030);
          tnm.reconcile({ d: newDate, keep: init.keep });

          const after = (tnm as any).proxy.d;
          // a changed Date must be re-proxied, not left pointing at the old one
          expect(after === before).toEqual(false);
        });
      });
    });

    describe("array object", () => {
      it("change at index", () => {
        const init = [
          { b: true },
          { b: true },
          { b: true },
          { b: true },
          { b: true },
        ];

        const tnm = new TotallyNotMutable<typeof init>(undefined, { autoFreeze });

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
        const result = mutate(init, (val) => {
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

      //reorders on arrays of OBJECTS move proxy elements between slots. Each op is
      //checked for the right result AND that a later mutation does not corrupt the
      //returned (immutable) result - i.e. copy-on-write survives the shift.
      describe("reordering arrays of objects keeps prior results immutable", () => {
        const ids = (a: { id: number }[]) => a.map((o) => o.id);

        const cases: [string, (v: { id: number }[]) => void, number[]][] = [
          ["reverse", (v) => v.reverse(), [3, 2, 1, 0]],
          ["sort", (v) => v.sort((a, b) => b.id - a.id), [3, 2, 1, 0]],
          ["unshift", (v) => v.unshift({ id: 9 }, { id: 8 }), [9, 8, 0, 1, 2, 3]],
          [
            "splice grow",
            (v) => v.splice(1, 1, { id: 7 }, { id: 6 }, { id: 5 }),
            [0, 7, 6, 5, 2, 3],
          ],
          ["splice shrink", (v) => v.splice(1, 2), [0, 3]],
        ];

        cases.forEach(([name, op, expected]) => {
          it(name, () => {
            const tnm = create<{ id: number }[]>([
              { id: 0 },
              { id: 1 },
              { id: 2 },
              { id: 3 },
            ]);
            const reordered = tnm.mutate(op);
            expect(ids(reordered)).toEqual(expected);

            //a later mutation must not bleed back into `reordered`
            const after = tnm.mutate((v) => {
              v[0].id = 999;
            });
            expect(ids(reordered)).toEqual(expected);
            expect(reordered[0]).not.toBe(after[0]);
          });
        });
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

      it("delete", () => {
        const init = new Set<string>(["a", "b"]);
        const result = mutate(init, (val) => {
          val.delete("b");
        });
        expect(result === init).toEqual(false);
        expect(result.has("a")).toEqual(true);
        expect(result.has("b")).toEqual(false);
        expect(result.size).toEqual(1);
        //input untouched
        expect(init.has("b")).toEqual(true);
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

    //the mutate get-trap path for Map/Set/Date methods was only exercised at
    //the root - these cover the nested case (the historical desync surface).
    describe("nested Map/Set/Date via mutate", () => {
      it("nested Map set/delete", () => {
        const init = {
          m: new Map<string, number>([["a", 1]]),
          keep: { x: 1 },
        };
        const result = mutate(init, (val) => {
          val.m.set("b", 2);
          val.m.delete("a");
        });
        expect(result.m.get("a")).toBeUndefined();
        expect(result.m.get("b")).toEqual(2);
        //untouched sibling keeps its reference
        expect(result.keep === init.keep).toEqual(true);
        //input untouched
        expect(init.m.get("a")).toEqual(1);
        expect(init.m.has("b")).toEqual(false);
      });

      it("nested Set add/delete", () => {
        const init = { s: new Set<number>([1, 2]), keep: { x: 1 } };
        const result = mutate(init, (val) => {
          val.s.add(3);
          val.s.delete(1);
        });
        expect(result.s.has(1)).toEqual(false);
        expect(result.s.has(3)).toEqual(true);
        expect(result.keep === init.keep).toEqual(true);
        //input untouched
        expect(init.s.has(1)).toEqual(true);
        expect(init.s.has(3)).toEqual(false);
      });

      it("nested Date set", () => {
        const init = { d: new Date(0), keep: { x: 1 } };
        const result = mutate(init, (val) => {
          val.d.setUTCFullYear(2030);
        });
        expect(result.d.getUTCFullYear()).toEqual(2030);
        expect(result.keep === init.keep).toEqual(true);
        //input untouched
        expect(init.d.getUTCFullYear()).toEqual(1970);
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
      it("set multiple array indexes to the same object value then update the object afterwards #2", () => {
        const init: { test: boolean }[] = [];
        const result = mutate(init, (val) => {
          //create a value
          const sameVal: (typeof init)[number] = { test: true };
          //apply the same value in mutliple places
          val.push(sameVal);
          val.push(sameVal);

          //update the first item in the array (which should point to the same object as the second element)
          val[0].test = false;
        });
        expect(result === init).toEqual(false);
        expect(init).toEqual([]);
        expect(result).toEqual([{ test: false }, { test: false }]);
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
        const tnm = new TotallyNotMutable<typeof init>(undefined, { autoFreeze });

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
        const tnm = new TotallyNotMutable<typeof init>(undefined, { autoFreeze });

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
        const tnm = new TotallyNotMutable<typeof init>(undefined, { autoFreeze });

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
        const tnm = new TotallyNotMutable<typeof init>(undefined, { autoFreeze });

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

    describe("guards", () => {
      it("throws when mutate is called before setValue", () => {
        const tnm = new TotallyNotMutable<{ a: number }>(undefined, { autoFreeze });
        expect(() =>
          tnm.mutate((v) => {
            v.a = 1;
          })
        ).toThrow("Cannot call mutate until a value has been set.");
      });

      it("throws when setValue is given a non-object", () => {
        const tnm = new TotallyNotMutable<any>(undefined, { autoFreeze });
        expect(() => tnm.setValue(5 as any)).toThrow(
          "Only objects are supported"
        );
      });

      it("throws when reconcile is given null/undefined/primitive", () => {
        const tnm = create({ a: 1 });
        expect(() => tnm.reconcile(null as any)).toThrow("only objects can be passed in");
        expect(() => tnm.reconcile(undefined as any)).toThrow(
          "only objects can be passed in"
        );
        expect(() => tnm.reconcile(5 as any)).toThrow("only objects can be passed in");
      });

      it("throws when a value contains a typed array", () => {
        const tnm = new TotallyNotMutable<any>(undefined, { autoFreeze });
        expect(() => tnm.setValue({ buf: new Uint8Array([1, 2, 3]) })).toThrow(
          "Typed arrays not supported."
        );
      });

      it("throws when a value contains an ArrayBuffer", () => {
        const tnm = new TotallyNotMutable<any>(undefined, { autoFreeze });
        expect(() => tnm.setValue({ buf: new ArrayBuffer(8) })).toThrow(
          "Array buffers not supported."
        );
      });

      it("throws when changing the prototype of the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() =>
          tnm.mutate((v) => {
            Object.setPrototypeOf(v, { inherited: true });
          })
        ).toThrow("Changing the prototype is not supported.");
      });

      it("throws when assigning __proto__ on the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() =>
          tnm.mutate((v) => {
            (v as any).__proto__ = { inherited: true };
          })
        ).toThrow("Changing the prototype is not supported.");
      });

      it("throws when defining an accessor property on the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() =>
          tnm.mutate((v) => {
            Object.defineProperty(v, "b", { get: () => 5, configurable: true });
          })
        ).toThrow("Getters and setters are not supported.");
      });

      it("throws when freezing the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() => tnm.mutate((v) => Object.freeze(v))).toThrow(
          "Sealing or freezing the draft is not supported."
        );
      });

      it("throws when sealing the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() => tnm.mutate((v) => Object.seal(v))).toThrow(
          "Sealing or freezing the draft is not supported."
        );
      });

      it("throws when preventing extensions on the draft", () => {
        const tnm = create<{ a: number }>({ a: 1 });
        expect(() => tnm.mutate((v) => Object.preventExtensions(v))).toThrow(
          "Sealing or freezing the draft is not supported."
        );
      });
    });

    describe("clearValue", () => {
      it("clears the value and requires setValue before mutating again", () => {
        const tnm = create({ a: 1 });
        tnm.clearValue();
        expect(tnm.getValue()).toBeUndefined();

        //mutate is not allowed until a value is set again
        expect(() =>
          tnm.mutate((v) => {
            v.a = 2;
          })
        ).toThrow("Cannot call mutate until a value has been set.");

        //re-setting restores normal operation
        const restored = tnm.setValue({ a: 5 });
        expect(restored).toEqual({ a: 5 });
        const mutated = tnm.mutate((v) => {
          v.a = 6;
        });
        expect(mutated).toEqual({ a: 6 });
      });
    });

    describe("constructor seeding", () => {
      it("seeds the initial value so mutate works without setValue", () => {
        const init = { a: 1, nested: { b: 2 } };
        const tnm = new TotallyNotMutable(init, { autoFreeze });
        expect(tnm.getValue()).toEqual(init);

        const next = tnm.mutate((v) => {
          v.a = 9;
        });
        expect(next).toEqual({ a: 9, nested: { b: 2 } });
        //untouched branch keeps its reference
        expect(next.nested === init.nested).toEqual(true);
      });

      it("freezes the seeded value when autoFreeze is on", () => {
        const tnm = new TotallyNotMutable({ a: [1, 2] }, { autoFreeze });
        expect(Object.isFrozen(tnm.getValue())).toEqual(autoFreeze);
      });

      it("without a value, mutate still throws until setValue", () => {
        const tnm = new TotallyNotMutable<{ a: number }>(undefined, {
          autoFreeze,
        });
        expect(() =>
          tnm.mutate((v) => {
            v.a = 1;
          })
        ).toThrow("Cannot call mutate until a value has been set.");
      });
    });

    describe("alternate mutation paths", () => {
      it("Object.assign onto the draft updates and adds keys", () => {
        const tnm = create<{ a: number; b: number; c?: number }>({ a: 1, b: 2 });
        const next = tnm.mutate((v) => Object.assign(v, { b: 20, c: 30 }));
        expect(next).toEqual({ a: 1, b: 20, c: 30 });
        //the materialized value stays in sync with the returned draft
        expect(tnm.getValue()).toEqual(next);
      });

      it("Object.assign preserves the reference of untouched siblings", () => {
        const tnm = create({ keep: { x: 1 }, change: { y: 1 } });
        const before = tnm.getValue()?.keep;
        const next = tnm.mutate((v) => Object.assign(v, { change: { y: 2 } }));
        expect(next.keep).toBe(before);
        expect(next.change).toEqual({ y: 2 });
      });

      it("sets a fresh object then mutates it within the same pass", () => {
        const tnm = create<{ x: { a: number }; y?: { a: number } }>({
          x: { a: 1 },
        });
        const next = tnm.mutate((v) => {
          v.y = { a: 1 };
          v.y.a = 99;
        });
        expect(next.y?.a).toEqual(99);
        expect(tnm.getValue()?.y?.a).toEqual(99);
      });

      it("pushes a fresh object then mutates it within the same pass", () => {
        const tnm = create<{ arr: { a: number }[] }>({ arr: [] });
        const next = tnm.mutate((v) => {
          v.arr.push({ a: 1 });
          v.arr[0].a = 42;
        });
        expect(next.arr[0].a).toEqual(42);
        expect(tnm.getValue()?.arr[0].a).toEqual(42);
      });

      it("deleting an array element keeps the draft and value in sync", () => {
        const tnm = create({ arr: [1, 2, 3] });
        const next = tnm.mutate((v) => {
          delete v.arr[1];
        });
        expect(1 in next.arr).toEqual(false);
        expect(tnm.getValue()?.arr).toEqual(next.arr);
      });
    });
  });
});
