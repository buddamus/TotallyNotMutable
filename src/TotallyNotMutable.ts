export type TotallyNotMutableConfig = { autoFreeze?: boolean };

export const defaultConfig: TotallyNotMutableConfig = { autoFreeze: false };

type Parent = { parent: any };
type ParentArray = Parent & { arrayIndex: number };
type ParentObject = Parent & { parent: any; key: any };
type ParentRef = ParentArray | ParentObject | null;

export class TotallyNotMutable<T> {
  private proxy!: ProxyConstructor;
  private _internalValue!: T;
  private _config: TotallyNotMutableConfig = defaultConfig;

  private _modifiedPaths: Set<object> = new Set();
  private _proxyUpdatesNeeded: Map<any, ParentRef> = new Map();

  private _mapObjectToParent: WeakMap<
    Map<any, any> | Record<string, any>,
    ParentRef
  > = new WeakMap();

  /**
   *
   * Sets up the class with or without autofreeze enabled. It is off by default for performance reasons.
   * It is a good practice to turn autofreeze on while in development mode to ensure no mutatations are attempted on the value outside of this class.
   */
  constructor(config?: TotallyNotMutableConfig) {
    this._config = { ...this._config, ...config };
  }

  /**
   *  Use this to mutate the current value. Remember to call setValue() once before calling this.
   *  @returns The updated value (not the proxy).
   */
  public mutate = (handler: (value: T) => void) => {
    if (!this.proxy || !this._internalValue) {
      throw "Cannot call mutate until a value has been has been set.";
    }
    this.log("NEW MUTATION");
    this._modifiedPaths = new Set();
    this._proxyUpdatesNeeded = new Map();
    this._newVersions = new Map();
    handler(this.proxy as T);

    if (this._proxyUpdatesNeeded.size) {
      this._proxyUpdatesNeeded.forEach((parentRef, value) => {
        Reflect.set(
          parentRef?.parent,
          (parentRef as ParentObject)?.key ||
            (parentRef as ParentArray)?.arrayIndex,
          this.setupNestedProxy(value, parentRef)
        );
      });
    }

    // if (this._newObjects.size) {
    //   this.log("NEW OBJECTSS", this._newObjects);
    //   this._newObjects.forEach((setParentRefs, newObject) => {
    //     //proxy has to point to the new verion, not the original
    //     const newVersion = this.getNewVersion(newObject);

    //     setParentRefs.forEach((parentRef) => {
    //       const parentProxy = parentRef?.parent || this.proxy;

    //       const internalValue = this.getInternalParent(parentRef);

    //       if (Array.isArray(internalValue)) {
    //         const keys = internalValue
    //           .map((one, i) => (one === newObject ? i : -1))
    //           .filter((index) => index !== -1);
    //         this.log({ keys });
    //         keys.forEach((key) => {
    //           console.log("setting up new proxy", { parentProxy, key });

    //           this.setupNestedProxy(newVersion, {
    //             parent: parentProxy,
    //             arrayIndex: key,
    //           });

    //           // Reflect.set(
    //           //   parentProxy,
    //           //   key,
    //           //   this.setupNestedProxy(newVersion, {
    //           //     parent: parentProxy,
    //           //     arrayIndex: key,
    //           //   })
    //           // );
    //         });
    //       } else if (internalValue instanceof Map) {
    //         throw "todo!";
    //       } else {
    //         throw "todo!";
    //       }
    //     });
    //   });
    // }

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
   * This must be executed at least once before calling mutate(). Separately, use this if you want to do a full replace rather than a mutation. Lastly, use this after a clear() before calling mutate().
   * @returns The same value that was passed in (not the proxy).
   */
  public setValue = (value: T) => {
    if (typeof value !== "object") {
      throw "Only objects are supported. Invalid data type: " + typeof value;
    }
    this._internalValue = value;

    this.proxy = this.setupNestedProxy(this._internalValue, null);
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

  private mapObjectToProxy: WeakMap<any, any> = new WeakMap();
  private getOrCreateProxy = (o: any, parentRef: ParentRef) => {
    const existing = this.mapObjectToProxy.get(o);

    if (existing) {
      return existing;
    }

    const proxy = new Proxy(o, this.getValidator(parentRef));

    this._mapObjectToParent.set(proxy, parentRef);

    if (o instanceof Map) {
      Array.from(o.keys()).forEach((key) => {
        const newProxy = this.setupNestedProxy(o.get(key), {
          parent: o,
          key,
        });
        Reflect.set(o, key, newProxy);
      });
    } else if (Array.isArray(o)) {
      o.forEach((item, index) => {
        o[index] = this.setupNestedProxy(o[index], {
          parent: proxy,
          arrayIndex: index,
        });
      });
    } else {
      Object.keys(o).forEach((key) => {
        o[key] = this.setupNestedProxy(o[key], { parent: proxy, key });
      });
    }
    return proxy;
  };

  private setupNestedProxy = (o: any, parentRef: ParentRef) => {
    if (typeof o === "object" && o !== null) {
      return this.getOrCreateProxy(this.getOrCreateNewVersion(o), parentRef);
    }
    return o;
  };

  /**
   *
   * @returns The actual value (not the proxy).
   */
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

  private _newVersions: Map<any, any> = new Map();
  private getOrCreateNewVersion = (o: any) => {
    if (typeof o !== "object") {
      return o;
    }
    const existing = this._newVersions.get(o);

    if (existing) {
      return existing;
    }

    const newVersion = this.getNewVersion(o);
    this._newVersions.set(o, newVersion);
    return newVersion;
  };

  private getNewVersionIfNotModifiedYet = (
    proxyObject: any,
    currentVal: any,
    newvalHandler?: (newval: any) => void
  ) => {
    if (this._modifiedPaths.has(proxyObject)) {
      this.log("already modified", proxyObject);
      return currentVal;
    }

    this.log("NEW ", currentVal);
    this._modifiedPaths.add(proxyObject);

    const newval = this.getNewVersion(currentVal);

    newvalHandler?.(newval);

    return newval;
  };

  private log(...args: any[]) {
    if (this._logging) {
      console.log(args);
    }
  }

  private getAncestors(parentRef: ParentRef) {
    const allParents: ParentRef[] = [];

    let nextParent: ParentRef | undefined = parentRef;

    while (!!nextParent) {
      allParents.push(nextParent);
      nextParent = this._mapObjectToParent.get(nextParent.parent);
    }

    allParents.reverse();

    return allParents;
  }

  private getInternalParent(parentRef: ParentRef) {
    const allParents = this.getAncestors(parentRef);

    const internal = allParents.reduce((accum, curr) => {
      const parentIsArray = Array.isArray(curr?.parent);

      const key = parentIsArray
        ? (curr as ParentArray).arrayIndex
        : (curr as ParentObject).key;
      const internal: any = Reflect.get(accum, key);

      return internal;
    }, this._internalValue as any);

    return internal;
  }

  private createNewInternalValueAndTarget = (parentRef: ParentRef) => {
    const allParents = this.getAncestors(parentRef);

    this.log({ allParents });

    const originalInternal = this._internalValue;

    const newInternalValue = this.getNewVersionIfNotModifiedYet(
      this.proxy,
      this._internalValue,
      (newValue) => {
        this._internalValue = newValue;
      }
    );

    this.log("EQ1?", originalInternal === newInternalValue);

    const { internal: target } = allParents.reduce(
      (accum, curr) => {
        this.log({ accum, curr });
        const parentIsArray = Array.isArray(curr?.parent);

        const key = parentIsArray
          ? (curr as ParentArray).arrayIndex
          : (curr as ParentObject).key;
        const internal: any = Reflect.get(accum.internal, key);
        const proxy: any = Reflect.get(accum.proxy, key);

        const newInternal = this.getNewVersionIfNotModifiedYet(
          proxy,
          internal,
          (newval) => Reflect.set(accum.internal, key, newval)
        );

        return { proxy, internal: newInternal };
      },
      { proxy: this.proxy, internal: newInternalValue }
    );

    this.log("EQ?", newInternalValue === target);

    return { target };
  };

  private updateInternalValue = (
    parentRef: ParentRef,
    key: string,
    value: any,
    isDelete: boolean = false
  ) => {
    this.log("CREATING NEW TARGET");
    const { target } = this.createNewInternalValueAndTarget(parentRef);

    this.log("updating", { target, parentRef, key, value });

    if (isDelete) {
      Reflect.deleteProperty(target, key);
    } else {
      Reflect.set(target, key, value);
    }
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

      if (
        Array.isArray(target) &&
        this.ARRAY_MUTATE_METHODS.has(prop as string)
      ) {
        return true;
      }
    }

    return false;
  };

  private getSpecificType(o: any) {
    const typeOfObject = typeof o;

    if (typeOfObject !== "object") {
      return typeOfObject;
    }

    if (Array.isArray(o)) {
      return "array";
    }

    if (o instanceof Map) {
      return "map";
    }

    if (o instanceof Set) {
      return "set";
    }

    if (o instanceof Date) {
      return "date";
    }

    return typeOfObject;
  }

  private getParentRefKey(parentRef: ParentRef): any {
    return (
      (parentRef as ParentObject).key || (parentRef as ParentArray).arrayIndex
    );
  }

  private getValidator(parentRef: ParentRef) {
    //store the reference
    const handler: ProxyHandler<any> = {
      get: (target, prop, receiver) => {
        const value = Reflect.get(target, prop);
        if (this.isMethodMutation(value, target, prop)) {
          //maps sets and dates need need special handling
          // const { newInternalValue, target: internalTarget } =
          //   this.createNewInternalValueAndTarget(path);
          // this._internalValue = newInternalValue;
          return (...args: any[]) => {
            this.log("TESTING...", { prop, parentRef, args });

            const { target: internalTarget } =
              this.createNewInternalValueAndTarget(parentRef);

            value.apply(
              target,
              args.map((one, index) =>
                typeof one === "object"
                  ? this.setupNestedProxy(
                      one,

                      this.getNewObjectParentRefProps(
                        target,
                        prop as string,
                        args,
                        index
                      )
                    )
                  : one
              )
            );

            if (Array.isArray(target) && prop !== "push" && prop !== "pop") {
              //make sure all tuhe indexes are still correct after the array has shifted

              const startIndex: number = (() => {
                if (prop === "splice" || prop === "copyWithin") {
                  return args[0] as number;
                }
                if (prop === "fill") {
                  return args[1] as number;
                }
                return 0;
              })();

              for (let i = startIndex; i < target.length; i++) {
                const existing: ParentArray = this._mapObjectToParent.get(
                  target[i]
                ) as ParentArray;
                if (existing) {
                  existing.arrayIndex = i;
                }
              }
            }

            value.apply(internalTarget, args);
          };
        }
        return value;
      },
      set: (target, key, value) => {
        this.log("SETTING", { target, key, value, parentRef });
        const newValue = this.getOrCreateNewVersion(value);
        Reflect.set(target, key, newValue);
        this.updateInternalValue(parentRef, key as string, value);
        this.scheduleProxyUpdate(
          newValue,
          this.getParentRef(target, key as string)
        );

        return true;
      },
      deleteProperty: (target, p) => {
        delete target[p];
        this.updateInternalValue(parentRef, p as string, null, true);
        return true;
      },
      defineProperty: (target, key, attributes) => {
        this.log("DEFINE", { target, key, attributes });
        if ("value" in attributes) {
          const newValue = this.getOrCreateNewVersion(attributes.value);
          Reflect.set(target, key, newValue);
          this.updateInternalValue(parentRef, key as string, attributes.value);
          this.scheduleProxyUpdate(
            newValue,
            this.getParentRef(target, key as string)
          );
        }

        return true;
      },
    };

    return handler;
  }

  private getParentRef(parent: any, key: string | number) {
    if (Array.isArray(parent)) {
      const retval: ParentArray = { parent, arrayIndex: key as number };
      return retval;
    }

    const retval: ParentObject = { parent, key };
    return retval;
  }

  private getNewObjectParentRefProps(
    target: any,
    prop: string,
    args: any[],
    index: number
  ): ParentArray | ParentObject {
    const specificType = this.getSpecificType(target);

    if (specificType === "array") {
      if (prop === "push") {
        const retval: ParentArray = {
          arrayIndex: target.length,
          parent: target,
        };
        return retval;
      }
      if (prop === "splice") {
        const retval: ParentArray = {
          arrayIndex: args[0] + index - 2,
          parent: target,
        };
        return retval;
      }

      if (prop === "fill") {
        const retval: ParentArray = {
          arrayIndex: args[1],
          parent: target,
        };
        return retval;
      }

      if (prop === "unshift") {
        const retval: ParentArray = {
          arrayIndex: index,
          parent: target,
        };
        return retval;
      }
    }

    if (specificType === "set" || specificType === "date") {
      //note the key will never be used here
      const retval: ParentObject = {
        key: specificType,
        parent: target,
      };
      return retval;
    }

    if (specificType === "map") {
      const retval: ParentObject = {
        key: args[0],
        parent: target,
      };
      return retval;
    }

    console.error({ target, prop, args, index });
    throw "Unable to handle";
  }

  // private _newObjects: Map<any, Set<ParentRef>> = new Map();
  // private handleNewObject(o: any, parentRef: ParentRef) {
  //   if (!this._newObjects.has(o)) {
  //     this._newObjects.set(o, new Set());
  //   }
  //   this._newObjects.get(o)?.add(parentRef);
  // }

  public getProxy() {
    return this.proxy;
  }
  private _logging: boolean = false;
  public setLogging(val: boolean) {
    this._logging = val;
  }

  private scheduleProxyUpdate(value: any, parentRef: ParentRef) {
    if (typeof value === "object") {
      this._proxyUpdatesNeeded.set(value, parentRef);
    }
  }
}
