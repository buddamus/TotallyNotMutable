export type TotallyNotMutableConfig = { autoFreeze?: boolean };

type ProxyUpdate = { path: string[]; key: string; value: any };

//private key the get trap answers with the proxy's creation path, used to resolve
//a proxy value back to its plain internal node (see resolveToInternalValue). Never
//an own property, so it isn't enumerated by spread/freeze and never leaks out.
const PROXY_PATH = Symbol("tnmProxyPath");

export const defaultConfig: TotallyNotMutableConfig = { autoFreeze: false };

export class TotallyNotMutable<T extends object> {
  private proxy!: ProxyConstructor;
  private _internalValue!: T;
  private _config: TotallyNotMutableConfig = defaultConfig;

  private _modifiedPaths: Set<string> = new Set<string>();
  //keyed by target, then by key - a single mutation can re-proxy several keys on
  //the same target (e.g. a grow splice that shifts and inserts elements), so a
  //flat target->update map would drop all but the last
  private _proxyUpdatesNeeded: Map<ProxyConstructor, Map<string, ProxyUpdate>> =
    new Map();

  //snapshot of _internalValue taken at the start of each mutate. Proxy paths
  //refer to pre-mutation positions, so a proxy value read from one slot and
  //written to another (shift/swap) resolves against this, not the live value
  //which may already have been overwritten earlier in the same pass
  private _resolveSnapshot: any;

  /**
   *
   * Optionally seeds the instance with an initial value (equivalent to calling setValue() immediately after construction). autoFreeze can be enabled via the optional config. It is off by default for performance reasons.
   * It is a good practice to turn autofreeze on while in development mode to ensure no mutatations are attempted on the value outside of this class.
   */
  constructor(value?: T, config?: TotallyNotMutableConfig) {
    this._config = { ...this._config, ...config };
    if (value !== undefined) {
      this.setValue(value);
    }
  }

  /**
   *  Use this to mutate the current value. Remember to call setValue() once before calling this.
   *  @returns The updated value (not the proxy).
   */
  public mutate = (handler: (value: T) => void) => {
    if (!this.proxy || !this._internalValue) {
      throw new Error("Cannot call mutate until a value has been set.");
    }
    this._modifiedPaths = new Set<string>();
    this._proxyUpdatesNeeded = new Map();
    this._resolveSnapshot = this._internalValue;
    handler(this.proxy as T);

    if (this._proxyUpdatesNeeded.size) {
      this._proxyUpdatesNeeded.forEach((updatesForTarget, target) => {
        updatesForTarget.forEach(({ key, value, path }) => {
          Reflect.set(target, key, this.setupNestedProxy(value, [...path, key]));
        });
      });
    }

    if (this._config.autoFreeze) {
      this.freeze(this._internalValue);
    }

    return this._internalValue;
  };

  private freeze = (o: any) => {
    if (o === undefined) {
      return o;
    }
    Object.freeze(o);

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

  private getKeys(o: any) {
    return o instanceof Map ? Array.from(o.keys()) : Object.keys(o as {});
  }

  //Plain objects and arrays can be reconciled key-by-key against the proxy.
  //Maps/Sets/Dates can't (their contents aren't reachable via property
  //reflection), so reconcile() treats them as opaque and re-proxies them whole.
  private isDiffable(o: any) {
    return (
      typeof o === "object" &&
      o !== null &&
      !(o instanceof Map) &&
      !(o instanceof Set) &&
      !(o instanceof Date)
    );
  }

  //Reconciles the internal value (and its proxy) to match `value`, then makes
  //`value` the new internal value. Unlike setValue(), which rebuilds the proxy
  //from scratch, reconcile() walks the difference between the current value and
  //`value` and only re-processes what actually changed - so any sub-objects the
  //two values share by reference are left untouched (structural sharing). This
  //is ideal for undo/redo, where each version is structurally similar to the
  //one before it.
  //
  //It is correct for every supported type, but only delivers the speed-up when
  //the changed parts are plain objects or arrays:
  //  - plain objects / arrays: diffed in place, unchanged branches reused.
  //  - Maps / Sets / Dates: not diffable, so a changed one is re-proxied
  //    wholesale and one at the root falls back to setValue(). Never wrong,
  //    never slower than setValue() - just no faster. An unchanged one (same
  //    reference) is skipped entirely.
  //
  //If the two values share no references, reconcile() does the full reconciliation
  //work for nothing - prefer setValue() in that case. Returns the exact `value`
  //passed in (not the proxy), preserving any structural sharing the caller built.
  public reconcile = (value: T) => {
    //TODO: refactor to use existing validity check
    if (value === null || value === undefined || typeof value !== "object") {
      throw new Error("only objects can be passed in");
    }

    //Two cases can't be diffed against the existing proxy, so rebuild it from
    //scratch via setValue(): (1) a Map/Set/Date at the root - opaque to the
    //key-by-key diff; (2) no internal value yet - there is nothing to diff.
    if (!this.isDiffable(value) || !this._internalValue) {
      return this.setValue(value);
    }

    //this is a trick. We use mutate so that all of the differences that causes mutations will update the proxy,
    //then after the mutations are done, we simply swap out internal value for the desired value
    this.mutate((proxy) => {
      this._reconcileNested(
        proxy as ProxyConstructor,
        this._internalValue,
        value,
        []
      );
    });
    this._internalValue = value;
    //mutate() froze the intermediate value, but we swapped in `value`
    //afterwards, so it must be frozen too (mirrors setValue()).
    if (this._config.autoFreeze) {
      this.freeze(this._internalValue);
    }
    return this._internalValue;
  };

  //Recursively reconciles one node of the proxy so it matches `newValue`, using
  //`existingValue` as the baseline of what's currently there. Writes go through
  //the proxy's traps, so they propagate to the internal value and schedule any
  //needed re-proxying exactly like a normal mutate() would.
  //
  //Only ever called with diffable nodes (plain objects/arrays) - reconcile() and the
  //recursion below guarantee Maps/Sets/Dates are replaced wholesale rather than
  //walked into.
  private _reconcileNested(
    proxy: ProxyConstructor,
    existingValue: any,
    newValue: any,
    path: string[]
  ): ProxyConstructor {
    const existingKeys = this.getKeys(existingValue);
    const newKeys = this.getKeys(newValue);

    //delete keys in the proxy that don't exist in the new value
    if (Array.isArray(existingValue) && Array.isArray(newValue)) {
      //arrays must shrink via length: deleting indices leaves holes and
      //never shortens the array, which then leaks into later mutations.
      if (newValue.length < existingValue.length) {
        Reflect.set(proxy as object, "length", newValue.length);
      }
    } else {
      existingKeys
        .filter((x) => !newKeys.includes(x))
        .forEach((key) => Reflect.deleteProperty(proxy as object, key));
    }

    //add keys the new value has that the proxy doesn't
    newKeys
      .filter((x) => !existingKeys.includes(x))
      .forEach((key) => {
        const keyValue = Reflect.get(newValue, key);
        Reflect.set(proxy as object, key, keyValue);
      });

    //keys that exist in both values
    newKeys
      .filter((x) => existingKeys.includes(x))
      .forEach((key) => {
        const existingKeyValue = Reflect.get(existingValue, key);
        const newKeyValue = Reflect.get(newValue, key);
        if (existingKeyValue === newKeyValue) {
          //these are structurally shared objects, nothing to do here
          return;
        }
        //values are different
        if (
          this.isDiffable(existingKeyValue) &&
          this.isDiffable(newKeyValue)
        ) {
          //these objects are different, but they could share children objects
          const proxyValue = Reflect.get(proxy, key);
          this._reconcileNested(proxyValue, existingKeyValue, newKeyValue, [
            ...path,
            key,
          ]);
        } else {
          //primitive, or an opaque Map/Set/Date: replace wholesale. The set
          //trap schedules a proxy update so the value is re-proxied fresh,
          //keeping the draft in sync with the materialized value.
          Reflect.set(proxy as object, key, newKeyValue);
        }
      });

    return proxy;
  }

  /**
   *
   * This must be executed at least once before calling mutate(). Separately, use this if you want to do a full replace rather than a mutation. Lastly, use this after a clear() before calling mutate().
   * @returns The same value that was passed in (not the proxy).
   */
  public setValue = (value: T) => {
    if (typeof value !== "object") {
      throw new Error(
        "Only objects are supported. Invalid data type: " + typeof value
      );
    }
    this._internalValue = value;

    this.proxy = this.setupNestedProxy(this._internalValue, []);
    if (this._config.autoFreeze) {
      this.freeze(this._internalValue);
    }
    return this._internalValue;
  };

  /**
   * Clears the proxy. Will require a setValue() before the next mutate();
   */
  public clearValue = () => {
    //@ts-ignore
    this._internalValue = undefined;
    //@ts-ignore
    this.proxy = undefined;
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

  /**
   *
   * @returns The actual value (not the proxy), or undefined if no value has been set yet.
   */
  public getValue(): T | undefined {
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
      throw new Error("Typed arrays not supported.");
    }
    if (o instanceof ArrayBuffer) {
      throw new Error("Array buffers not supported.");
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
        if (prop === PROXY_PATH) {
          return path;
        }
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
        //assigning __proto__ would change the prototype, which we don't reproduce
        if (key === "__proto__") {
          throw new Error("Changing the prototype is not supported.");
        }
        Reflect.set(target, key, value);
        const plain = this.resolveToInternalValue(value);
        this.updateInternalValue(path, key as string, plain);
        this.scheduleProxyUpdate(target, path, key as string, plain);
        return true;
      },
      deleteProperty: (target, p) => {
        delete target[p];
        this.updateInternalValue(path, p as string, null, true);
        return true;
      },
      defineProperty: (target, key, attributes) => {
        //only plain data descriptors are reproduced; accessors would be dropped
        if (attributes.get || attributes.set) {
          throw new Error("Getters and setters are not supported.");
        }
        Reflect.set(target, key, attributes.value);
        const plain = this.resolveToInternalValue(attributes.value);
        this.updateInternalValue(path, key as string, plain);
        this.scheduleProxyUpdate(target, path, key as string, plain);
        return true;
      },
      setPrototypeOf: () => {
        throw new Error("Changing the prototype is not supported.");
      },
      preventExtensions: () => {
        //also covers Object.freeze/Object.seal, which call preventExtensions
        throw new Error("Sealing or freezing the draft is not supported.");
      },
    };

    return handler;
  }

  //if value is one of our proxies (e.g. read from another slot during an array
  //shift), resolve it to its plain node in the current _internalValue via the
  //path it was created at - so the internal value never holds a proxy. Anything
  //that isn't one of our proxies is returned untouched.
  private resolveToInternalValue = (value: any) => {
    if (value === null || typeof value !== "object") {
      return value;
    }
    //only our proxies answer PROXY_PATH; plain values return undefined
    const path: string[] | undefined = value[PROXY_PATH];
    if (!path) {
      return value;
    }
    let node: any = this._resolveSnapshot;
    for (const key of path) {
      node = node instanceof Map ? node.get(key) : node?.[key];
    }
    return node;
  };

  private scheduleProxyUpdate(
    target: any,
    path: string[],
    key: string,
    value: any
  ) {
    if (typeof value === "object") {
      let updatesForTarget = this._proxyUpdatesNeeded.get(target);
      if (!updatesForTarget) {
        updatesForTarget = new Map();
        this._proxyUpdatesNeeded.set(target, updatesForTarget);
      }
      updatesForTarget.set(key, { path, key, value });
    }
  }
}
