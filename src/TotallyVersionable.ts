import {
  TotallyNotMutable,
  TotallyNotMutableConfig,
} from "./TotallyNotMutable";

export type PushVersion<T> = { action: "pushVersion"; value: T };
export type DeleteVersion<T> = {
  action: "deleteVersion";
  value: T;
  index: number;
};
export type ClearOlderVersions<T> = {
  action: "clearOlderVersions";
  deletedVersions: T[];
};

export type VersionEvent<T> =
  | PushVersion<T>
  | DeleteVersion<T>
  | ClearOlderVersions<T>;

export class TotallyVersionable<T> {
  private _undoEvents: VersionEvent<T>[] = [] as VersionEvent<T>[];
  private _redoEvents: VersionEvent<T>[] = [] as VersionEvent<T>[];
  private _versions: (T | never)[] = [];

  private tnm: TotallyNotMutable<T>;
  constructor(config?: TotallyNotMutableConfig) {
    this.tnm = new TotallyNotMutable<T>(config);
  }

  /**
   * 
   Use this to modify the current value. 
   */
  public mutate = (handler: (value: T) => void) => {
    return this._pushVersion(this.tnm.mutate(handler), true);
  };

  /**
   *
   * Used to set the initial version or push a new version. This should not be used in place of mutate() which is faster.
   */
  public pushVersion(value: T) {
    this.tnm.setValue(value);
    return this._pushVersion(value, true);
  }

  private _pushVersion(value: T, clearRedo: boolean) {
    if (clearRedo) {
      this._redoEvents = [];
    }

    this._undoEvents.push({ action: "pushVersion", value });
    this._versions.push(value);
    return value;
  }

  public getSizes() {
    return { undo: this._undoEvents.length, redo: this._redoEvents.length };
  }

  /**  Makes a version become the latest version by calling pushVersion() for that value */
  public revertToVersion(index: number) {
    const version = this._versions.at(index);
    if (version) {
      return this.pushVersion(version);
    } else {
      throw "Version doesn't exist.";
    }
  }

  /**
   * Deletes the zero based index of the available history. If the index is greater than the number of items in the undo stack, it will look in the redo stack.
   *
   */
  public deleteVersion(index: number) {
    const deletingCurrentVersion =
      index >= 0 && index === this._versions.length - 1;
    const version = this._versions.splice(index, 1);
    if (version?.length) {
      this._undoEvents.push({
        action: "deleteVersion",
        value: version[0],
        index,
      });

      //edge case: if we deleted the latest version
      if (deletingCurrentVersion) {
        this.replaceProxyWithCurrent();
      }
    }

    return this.getCurrentVersion();
  }

  public clearOlderVersions() {
    if (this._versions.length <= 1) {
      //nothing to clear
      return this.getCurrentVersion();
    }
    const currentVersion = this._versions.pop()!;
    const deletedVersions = this._versions;

    this._versions = [currentVersion];
    this._undoEvents.push({ action: "clearOlderVersions", deletedVersions });
    return this.getCurrentVersion();
  }

  public getCurrentVersion = () => this._versions.at(this._versions.length - 1);

  public getVersion = (index: number) => {
    return this._versions.at(index);
  };

  public undo = () => {
    if (this._undoEvents.length > 0) {
      const event = this._undoEvents.pop()!;
      this._redoEvents.push(event);
      if (event.action === "pushVersion") {
        this._versions.pop()!;
        this.replaceProxyWithCurrent();
      } else if (event.action === "deleteVersion") {
        const isRestoringLatestVersion = event.index >= this._versions.length;
        this._versions.splice(event.index, 0, event.value);
        if (isRestoringLatestVersion) {
          this.replaceProxyWithCurrent();
        }
      } else if (event.action === "clearOlderVersions") {
        this._versions = [...event.deletedVersions, ...this._versions];
      }
    }

    return this.getCurrentVersion();
  };

  private replaceProxyWithCurrent() {
    const newVal = this.getCurrentVersion();
    if (newVal) {
      this.tnm.apply(newVal);
    } else {
      this.tnm.clearValue();
    }
  }

  public getEvents() {
    return [...this._undoEvents];
  }

  public getVersions() {
    return [...this._versions];
  }

  public redo = () => {
    if (this._redoEvents.length > 0) {
      const event = this._redoEvents.pop()!;
      if (event.action === "pushVersion") {
        this._pushVersion(event.value, false);
        this.replaceProxyWithCurrent();
      } else if (event.action === "deleteVersion") {
        this.deleteVersion(event.index);
      } else if (event.action === "clearOlderVersions") {
        this.clearOlderVersions();
      }
    }

    return this.getCurrentVersion();
  };
}
