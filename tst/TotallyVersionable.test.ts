import { TotallyVersionable } from "../src/TotallyVersionable";
import { TotallyNotMutableConfig } from "../src/TotallyNotMutable";

//do each test with auto freeze on/off
[true, false].forEach((autoFreeze) => {
  const config: TotallyNotMutableConfig = { autoFreeze };

  describe("TotallyVersionable autofreeze:" + autoFreeze, () => {
    describe("versioning", () => {
      it("multiple undo/redo", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(config);

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
      it("delete version undo/redo", () => {
        const init: number[] = [0];
        const history = new TotallyVersionable<typeof init>(config);

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
        const history = new TotallyVersionable<typeof init>(config);

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
        const history = new TotallyVersionable<typeof init>(config);
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
        const history = new TotallyVersionable<typeof init>(config);
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
    });
  });
});
