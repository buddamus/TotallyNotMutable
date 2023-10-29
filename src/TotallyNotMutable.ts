export type TotallyNotMutableConfig = { autoFreeze?: boolean };

type ProxyUpdate = { path: string[]; key: string; value: any };

export class TotallyNotMutable<T> {
  private proxy!: ProxyConstructor;
  private _internalValue!: T;
  private _config: TotallyNotMutableConfig = { autoFreeze: false };

  private _modifiedPaths: Set<string> = new Set<string>();
  private _proxyUpdatesNeeded: Map<ProxyConstructor, ProxyUpdate> = new Map();
  constructor(config?: TotallyNotMutableConfig) {
    this._config = { ...this._config, ...config };
  }

  public mutate = (handler: (value: T) => void) => {
    if (!this.proxy || !this._internalValue) {
      throw "Cannot call mutate until a value has been has been set.";
    }
    this._modifiedPaths = new Set<string>();
    this._proxyUpdatesNeeded = new Map();
    handler(this.proxy as T);

    if (this._proxyUpdatesNeeded.size) {
      this._proxyUpdatesNeeded.forEach((proxyUpdate, target) => {
        const { key, value, path } = proxyUpdate;
        Reflect.set(target, key, this.setupNestedProxy(value, [...path, key]));
      });
    }

    if (this._config.autoFreeze) {
      this.freeze(this._internalValue);
    }

    return this._internalValue;
  };

  private freeze = (o: any) => {
    Object.freeze(o);
    if (o === undefined) {
      return o;
    }

    Object.getOwnPropertyNames(o).forEach((prop) => {
      if (
        o[prop] !== null &&
        typeof o[prop] === "object" &&
        !Object.isFrozen(o[prop])
      ) {
        this.freeze(o[prop]);
      }
    });
  };

  /**
   *
   * Only use this when you want to completely overwrite the value
   */
  public setValue = (value: T) => {
    if (typeof value !== "object") {
      throw "Only objects are supported. Invalid data type: " + typeof value;
    }
    this._internalValue = value;

    this.proxy = this.setupNestedProxy(this._internalValue, []);
    if (this._config.autoFreeze) {
      this.freeze(this._internalValue);
    }
    return this._internalValue;
  };

  private setupNestedProxy = (o: any, path: any[]) => {
    if (typeof o === "object" && o !== null) {
      const newVal = this.getNewVersion(o);
      const proxy = new Proxy(newVal, this.getValidator(path));

      if (o instanceof Map) {
        Array.from(o.keys()).forEach((key) => {
          const newKey = [...path, key];
          const newProxy = this.setupNestedProxy(o.get(key), newKey);
          Reflect.set(newVal, key, newProxy);
        });
      } else {
        Object.keys(o).forEach((key) => {
          const newKey = [...path, key];
          newVal[key] = this.setupNestedProxy(o[key], newKey);
        });
      }

      return proxy;
    }
    return o;
  };

  public getValue() {
    return this._internalValue;
  }

  private getNewVersion = (o: any) => {
    if (Array.isArray(o)) {
      return [...o];
    }

    if (o instanceof Map) {
      return new Map(o);
    }

    if (o instanceof Set) {
      return new Set(o);
    }

    if (o instanceof Date) {
      return new Date(o);
    }

    if (ArrayBuffer.isView(o)) {
      throw "Typed arrays not supported.";
    }
    if (o instanceof ArrayBuffer) {
      throw "Array buffers not supported.";
    }

    //POJO
    return { ...o };
  };

  private getPathKey(path: string[]) {
    return path.join("|");
  }

  private getNewVersionIfNotModifiedYet = (
    path: string[],
    currentVal: any,
    newvalHandler?: (newval: any) => void
  ) => {
    const pathKey = this.getPathKey(path);
    if (this._modifiedPaths.has(pathKey)) {
      return currentVal;
    }
    this._modifiedPaths.add(pathKey);

    const newval = this.getNewVersion(currentVal);

    newvalHandler?.(newval);

    return newval;
  };

  private createNewInternalValueAndTarget = (path: string[]) => {
    const pathToLeaf: string[] = [];
    const newInternalValue = this.getNewVersionIfNotModifiedYet(
      pathToLeaf,
      this._internalValue
    );

    const target = path.reduce((accum, curr) => {
      const o: any = Reflect.get(accum, curr);
      pathToLeaf.push(curr);
      return this.getNewVersionIfNotModifiedYet(pathToLeaf, o, (newval) =>
        Reflect.set(accum, curr, newval)
      );
    }, newInternalValue);

    return { newInternalValue, target };
  };

  private updateInternalValue = (
    path: string[],
    key: string,
    value: any,
    isDelete: boolean = false
  ) => {
    const { newInternalValue, target } =
      this.createNewInternalValueAndTarget(path);

    if (isDelete) {
      Reflect.deleteProperty(target, key);
    } else {
      Reflect.set(target, key, value);
    }
    this._internalValue = newInternalValue;
  };

  private readonly MAP_SET_MUTATE_METHODS = new Set([
    "clear",
    "delete",
    "set",
    "add",
  ]);
  private readonly ARRAY_MUTATE_METHODS = new Set([
    "copyWithin",
    "fill",
    "pop",
    "push",
    "reverse",
    "shift",
    "sort",
    "splice",
    "unshift",
  ]);

  private isMethodMutation = (
    value: any,
    target: any,
    prop: string | symbol
  ) => {
    if (typeof value == "function" && typeof target === "object") {
      if (
        (target instanceof Map || target instanceof Set) &&
        this.MAP_SET_MUTATE_METHODS.has(prop as string)
      ) {
        return true;
      }

      if (target instanceof Date && (prop as string).startsWith("set")) {
        return true;
      }
    }

    return false;
  };

  private getValidator(path: string[]) {
    //store the reference
    const handler: ProxyHandler<any> = {
      get: (target, prop) => {
        const value = Reflect.get(target, prop);
        if (this.isMethodMutation(value, target, prop)) {
          //maps sets and dates need need special handling
          const { newInternalValue, target: internalTarget } =
            this.createNewInternalValueAndTarget(path);
          this._internalValue = newInternalValue;
          return value.bind(internalTarget);
        }
        return value;
      },
      set: (target, key, value) => {
        Reflect.set(target, key, value);
        this.updateInternalValue(path, key as string, value);
        this.scheduleProxyUpdate(target, path, key as string, value);
        return true;
      },
      deleteProperty: (target, p) => {
        delete target[p];
        this.updateInternalValue(path, p as string, null, true);
        return true;
      },
      defineProperty: (target, key, attributes) => {
        Reflect.set(target, key, attributes.value);
        this.updateInternalValue(path, key as string, attributes.value);
        this.scheduleProxyUpdate(target, path, key as string, attributes.value);
        return true;
      },
    };

    return handler;
  }

  private scheduleProxyUpdate(
    target: any,
    path: string[],
    key: string,
    value: any
  ) {
    if (typeof value === "object") {
      this._proxyUpdatesNeeded.set(target, {
        path,
        key,
        value,
      });
    }
  }
}
