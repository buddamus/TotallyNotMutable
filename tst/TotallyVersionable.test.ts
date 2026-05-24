import { TotallyVersionable } from "../src/TotallyVersionable";
import { TotallyNotMutableConfig } from "../src/TotallyNotMutable";

//do each test with auto freeze on/off
[true, false].forEach((autoFreeze) => {
  const config: TotallyNotMutableConfig = { autoFreeze };

  describe("TotallyVersionable autofreeze:" + autoFreeze, () => {
    describe("versioning", () => {
      it("undo then modify", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));
        history.mutate((val) => val.push(2));
        history.undo();
        history.mutate((val) => val.push(3));
        expect(history.getSizes().undo).toEqual(3);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 3]);
      });

      it("undo to nothing -> redo > mutate", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        history.undo();
        history.redo();
        history.mutate((val) => val.push(2));

        expect(history.getSizes().undo).toEqual(2);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 2]);
      });

      it("multiple undo/redo", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));
        history.mutate((val) => val.push(2));
        history.mutate((val) => val.push(3));
        history.mutate((val) => val.push(4));
        //ENSURE number of events and current version are correct
        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);

        history.undo();
        expect(history.getSizes().undo).toEqual(4);
        expect(history.getSizes().redo).toEqual(1);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3]);

        history.undo();
        expect(history.getSizes().undo).toEqual(3);
        expect(history.getSizes().redo).toEqual(2);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2]);

        history.undo();
        expect(history.getSizes().undo).toEqual(2);
        expect(history.getSizes().redo).toEqual(3);
        expect(history.getCurrentVersion()).toEqual([0, 1]);

        history.undo();
        expect(history.getSizes().undo).toEqual(1);
        expect(history.getSizes().redo).toEqual(4);
        expect(history.getCurrentVersion()).toEqual([0]);

        history.redo();
        expect(history.getSizes().undo).toEqual(2);
        expect(history.getSizes().redo).toEqual(3);
        expect(history.getCurrentVersion()).toEqual([0, 1]);

        history.redo();
        expect(history.getSizes().undo).toEqual(3);
        expect(history.getSizes().redo).toEqual(2);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2]);

        history.redo();
        expect(history.getSizes().undo).toEqual(4);
        expect(history.getSizes().redo).toEqual(1);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3]);

        history.redo();
        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
      });

      it("delete current version undo redo", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));

        let updatedVal = history.deleteVersion(1);

        expect(updatedVal).toEqual([0]);
        updatedVal = history.undo();

        expect(updatedVal).toEqual([0, 1]);

        updatedVal = history.redo();
        expect(updatedVal).toEqual([0]);
      });

      it("delete current version undo mutate", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));

        let updatedVal = history.deleteVersion(1);

        expect(updatedVal).toEqual([0]);
        updatedVal = history.undo();

        expect(updatedVal).toEqual([0, 1]);

        updatedVal = history.mutate((value) => {
          value.push(99);
        });
        expect(updatedVal).toEqual([0, 1, 99]);
      });

      it("delete version undo/redo", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));
        history.mutate((val) => val.push(2));
        history.mutate((val) => val.push(3));
        history.mutate((val) => val.push(4));

        //ENSURE number of events and current version are correct
        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);

        //DELETE A VERSION
        history.deleteVersion(2);

        expect(history.getSizes().undo).toEqual(6);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        expect(history.getVersion(2)).toEqual([0, 1, 2, 3]);

        //UNDO THE DELETE
        history.undo();
        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(1);
        //current version shouldn't have changed
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        //version 2 should've been restored back to it's original value
        expect(history.getVersion(2)).toEqual([0, 1, 2]);

        //REDO and it should be the the same as after the delete
        history.redo();
        expect(history.getSizes().undo).toEqual(6);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        expect(history.getVersion(2)).toEqual([0, 1, 2, 3]);
      });

      it("clear older versions", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(undefined, config);

        //INITIAL VALUE
        history.pushVersion(init);

        //ADD 4 MORE VERSIONS
        history.mutate((val) => val.push(1));
        history.mutate((val) => val.push(2));
        history.mutate((val) => val.push(3));
        history.mutate((val) => val.push(4));

        //ENSURE number of events and current version are correct
        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);

        //clear older versions
        history.clearOlderVersions();

        expect(history.getSizes().undo).toEqual(6);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        expect(history.getVersion(0)).toEqual(history.getCurrentVersion());

        //UNDO
        history.undo();

        expect(history.getSizes().undo).toEqual(5);
        expect(history.getSizes().redo).toEqual(1);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        expect(history.getVersion(0)).toEqual([0]);
        expect(history.getVersion(3)).toEqual([0, 1, 2, 3]);

        //REDO
        history.redo();

        expect(history.getSizes().undo).toEqual(6);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getCurrentVersion()).toEqual([0, 1, 2, 3, 4]);
        expect(history.getVersion(0)).toEqual(history.getCurrentVersion());
      });
    });

    describe("array object", () => {
      it("change at index", () => {
        const init: string[] = ["1", "2", "3", "4", "5"];
        const history = new TotallyVersionable<typeof init>(undefined, config);
        history.pushVersion(init);
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getSizes().undo).toEqual(1);
        expect(history.getCurrentVersion()).toEqual(["1", "2", "3", "4", "5"]);

        history.mutate((val) => {
          val.push("6");
          val.push("7");
        });

        expect(history.getSizes().redo).toEqual(0);
        expect(history.getSizes().undo).toEqual(2);

        expect(history.getCurrentVersion()).toEqual([
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
        ]);
        expect(history.getVersion(0)).toEqual(["1", "2", "3", "4", "5"]);

        history.undo();
        expect(history.getSizes().redo).toEqual(1);
        expect(history.getSizes().undo).toEqual(1);
        expect(history.getCurrentVersion()).toEqual(["1", "2", "3", "4", "5"]);

        history.redo();
        expect(history.getSizes().redo).toEqual(0);
        expect(history.getSizes().undo).toEqual(2);

        expect(history.getCurrentVersion()).toEqual([
          "1",
          "2",
          "3",
          "4",
          "5",
          "6",
          "7",
        ]);
        expect(history.getVersion(0)).toEqual(["1", "2", "3", "4", "5"]);
      });
    });
    describe("object structural sharing", () => {
      it("keeps untouched refs", () => {
        const init = { a: { val: true }, b: { val: true }, c: { val: true } };
        const history = new TotallyVersionable<typeof init>(undefined, config);
        history.pushVersion(init);

        const latest = history.mutate((val) => {
          val.a.val = false;
        });

        expect(history.getSizes().redo).toEqual(0);
        expect(history.getSizes().undo).toEqual(2);

        expect(history.getVersion(0) === init).toEqual(true);
        expect(history.getVersion(1) === latest).toEqual(true);
        expect(latest === init).toEqual(false);

        //a was modified so it should not share the reference
        expect(latest.a === init.a).toEqual(false);
        //b and c were not modified, so they should share the same reference
        expect(latest.b === init.b).toEqual(true);
        expect(latest.c === init.c).toEqual(true);
      });

      it("preserves structural sharing across an undo/redo round trip", () => {
        const init = { a: { v: 1 }, b: { v: 2 }, c: { v: 3 } };
        const history = new TotallyVersionable<typeof init>(undefined, config);
        history.pushVersion(init);

        const v2 = history.mutate((val) => {
          val.a.v = 99;
        });
        expect(v2.b === init.b).toEqual(true);
        expect(v2.c === init.c).toEqual(true);

        //undo restores the exact previous version reference
        const undone = history.undo()!;
        expect(undone === init).toEqual(true);

        //redo restores the exact mutated version reference
        const redone = history.redo()!;
        expect(redone === v2).toEqual(true);
        expect(redone.b === init.b).toEqual(true);
        expect(redone.c === init.c).toEqual(true);

        //a mutation after the round trip still shares untouched branches
        const v3 = history.mutate((val) => {
          val.a.v = 1000;
        });
        expect(v3.a.v).toEqual(1000);
        expect(v3.b === init.b).toEqual(true);
        expect(v3.c === init.c).toEqual(true);
      });
    });

    //Map/Set/Date go through reconcile()'s wholesale-replace fallback during
    //undo/redo - exercise that path through the versionable layer.
    describe("Map/Set/Date through undo/redo", () => {
      it("Map value round trip", () => {
        const history = new TotallyVersionable<Map<string, number>>(undefined, config);
        history.pushVersion(new Map([["a", 1]]));

        const v2 = history.mutate((m) => m.set("b", 2));
        expect(v2.get("b")).toEqual(2);

        const undone = history.undo()!;
        expect(undone.has("b")).toEqual(false);
        expect(undone.get("a")).toEqual(1);

        const redone = history.redo()!;
        expect(redone.get("b")).toEqual(2);

        //mutating after the round trip still works
        const v3 = history.mutate((m) => m.set("c", 3));
        expect(v3.get("a")).toEqual(1);
        expect(v3.get("b")).toEqual(2);
        expect(v3.get("c")).toEqual(3);
      });

      it("Set value round trip", () => {
        const history = new TotallyVersionable<Set<number>>(undefined, config);
        history.pushVersion(new Set([1, 2]));

        const v2 = history.mutate((s) => s.add(3));
        expect(v2.has(3)).toEqual(true);

        const undone = history.undo()!;
        expect(undone.has(3)).toEqual(false);

        const redone = history.redo()!;
        expect(redone.has(3)).toEqual(true);
      });

      it("Date value round trip", () => {
        const history = new TotallyVersionable<Date>(undefined, config);
        history.pushVersion(new Date(0));

        const v2 = history.mutate((d) => d.setUTCFullYear(2030));
        expect(v2.getUTCFullYear()).toEqual(2030);

        const undone = history.undo()!;
        expect(undone.getUTCFullYear()).toEqual(1970);

        const redone = history.redo()!;
        expect(redone.getUTCFullYear()).toEqual(2030);
      });
    });

    describe("api surface", () => {
      it("revertToVersion makes an older version current", () => {
        const history = new TotallyVersionable<number[]>(undefined, config);
        history.pushVersion([0]);
        history.mutate((v) => v.push(1));
        history.mutate((v) => v.push(2));
        expect(history.getCurrentVersion()).toEqual([0, 1, 2]);

        const reverted = history.revertToVersion(0);
        expect(reverted).toEqual([0]);
        expect(history.getCurrentVersion()).toEqual([0]);
      });

      it("revertToVersion throws for a missing version", () => {
        const history = new TotallyVersionable<number[]>(undefined, config);
        history.pushVersion([0]);
        expect(() => history.revertToVersion(99)).toThrow(
          "Version doesn't exist."
        );
      });

      it("getVersions returns a copy that can't mutate internal state", () => {
        const history = new TotallyVersionable<number[]>(undefined, config);
        history.pushVersion([0]);
        history.mutate((v) => v.push(1));

        const versions = history.getVersions();
        expect(versions).toEqual([[0], [0, 1]]);

        versions.push([9, 9]);
        expect(history.getVersions()).toEqual([[0], [0, 1]]);
      });

      it("getEvents returns the undo event log", () => {
        const history = new TotallyVersionable<number[]>(undefined, config);
        history.pushVersion([0]);
        history.mutate((v) => v.push(1));

        const events = history.getEvents();
        expect(events.length).toEqual(2);
        expect(events.every((e) => e.action === "pushVersion")).toEqual(true);
      });

      it("clearOlderVersions is a no-op with one version and logs no event", () => {
        const history = new TotallyVersionable<number[]>(undefined, config);
        history.pushVersion([0]);

        expect(history.clearOlderVersions()).toEqual([0]);
        expect(history.getVersions()).toEqual([[0]]);
        expect(history.getEvents().some((e) => e.action === "clearOlderVersions")).toEqual(
          false
        );
      });
    });

    describe("constructor seeding", () => {
      it("seeds the initial version (no pushVersion needed)", () => {
        const init = [0];
        const history = new TotallyVersionable<typeof init>(init, config);
        expect(history.getCurrentVersion()).toEqual([0]);
        expect(history.getSizes().undo).toEqual(1);
        expect(history.getSizes().redo).toEqual(0);

        //mutate works immediately
        const v2 = history.mutate((v) => v.push(1));
        expect(v2).toEqual([0, 1]);
        expect(history.getSizes().undo).toEqual(2);

        //undo returns to the seeded version
        expect(history.undo()).toEqual([0]);
      });
    });

    describe("explicitly pushed versions", () => {
      it("undo/redo across separate pushVersion calls", () => {
        const history = new TotallyVersionable<{ n: number }>(undefined, config);
        history.pushVersion({ n: 0 });
        history.pushVersion({ n: 1 });
        history.pushVersion({ n: 2 });
        expect(history.getCurrentVersion()).toEqual({ n: 2 });

        expect(history.undo()).toEqual({ n: 1 });
        expect(history.undo()).toEqual({ n: 0 });
        expect(history.redo()).toEqual({ n: 1 });
        expect(history.redo()).toEqual({ n: 2 });
      });
    });
  });
});
