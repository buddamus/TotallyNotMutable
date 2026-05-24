# TotallyNotMutable

This one trick makes all your JS mutability and undo/redo problems disappear (doctors hate it!).

## Intro

This package contains two vanilla JS classes that use structural sharing to accomplish immutability and versioning (undo/redo). Compatible with plain objects, arrays, Dates, Maps, and Sets. Integrates easily into major frameworks (react, angular, etc.). Optimized for mutations over time.

### TotallyNotMutable

A class built to handle modifications to an object without mutating the original object.

```
//step 1 - create with the initial value (config is an optional 2nd arg, e.g. {autoFreeze:true})
const initialData = {
  foo: 'bar',
  arr: ['hello', 'world'],
  obj: {
    a: 'a',
    anotherObject: { bool: true },
  },
};
const tnm = new TotallyNotMutable(initialData);

//step 2 - mutate
const step2Value = tnm.mutate((value)=>{
    value.foo = 'bar no more!';
    value.arr.push('again');
    value.obj.a = 'a has been updated';
});
const structuralSharing = initialData.obj.anotherObject === step2Value.obj.anotherObject; // true

//step 3 - ????

//step 4 - PROFIT!!

```

### TotallyVersionable

A class built to handle undo/redo. Built on top of TotallyNotMutable

```
//step 1 - create with the initial value (config is an optional 2nd arg)
const initialData = {
  foo: 'bar',
  arr: ['hello', 'world'],
  obj: {
    a: 'a',
    anotherObject: { bool: true },
  },
};
const tv = new TotallyVersionable(initialData);

//step 2 - mutate
const secondValue = tv.mutate((value)=>{
    value.foo = 'bar no more!';
    value.arr.push('again');
    value.obj.a = 'a has been updated';
});

//step 3 - undo
const thirdValue = tv.undo();
const isEqualToInitial = initialData === thirdValue; //true

//step 4 - redo
const fourthValue = tv.redo();
const isEqualToMutated = secondValue === fourthValue; //true

```

### Configuration

Both classes' constructors accept the initial value first and an optional configuration object second, which can enable auto freezing. This will be a performance hit but can be useful in a development environment to ensure resulting data is not being modified externally.

```
const tnm = new TotallyNotMutable(initialValue, {autoFreeze:true})
```

### Deferred / async initialization

You don't have to pass the value at construction. This is the common case for async data: create the instance empty, then set the value once it arrives.

```ts
const tnm = new TotallyNotMutable<MyType>(); // no value yet

const data = await fetchData();
tnm.setValue(data); // now it's ready
```

A few rules follow from this:

- `getValue()` returns `T | undefined` — it is `undefined` until the first `setValue()` (or until you seed the value at construction). Guard your reads, or seed at construction to skip the empty window.
- `mutate()` throws if called before a value is set — there is no draft to mutate yet.
- The value must always be an object (plain object, array, `Map`, `Set`, or `Date`). `T` is constrained to `extends object`, so primitives are a compile error; `undefined`/`null` are rejected at runtime.

`TotallyVersionable` works the same way, except you seed it with `pushVersion(value)` instead of `setValue(value)`.

### setValue vs reconcile

For everyday use you only need **`setValue`** (set or replace the value) and **`mutate`** (change it immutably). `reconcile` is an optional performance tool: it produces the **exact same result** as `setValue`, just faster in one specific situation.

- **`setValue(next)`** — replaces the value and rebuilds the internal proxy from scratch.
- **`reconcile(next)`** — replaces the value too, but instead of rebuilding, it diffs `next` against the current value and only re-processes the parts that changed (investigate, and touch as little as possible).

Both leave you holding exactly `next` — the value you observe, and every reference inside it, is identical either way. They differ only in *how much internal work* happens. `reconcile` wins when `next` is **structurally similar** to the current value (it was derived from it and shares references); it is pure overhead when `next` shares nothing (a fresh `JSON.parse`, a server fetch, a brand-new literal), so use `setValue` there.

The classic structurally-similar case is undo/redo — but you normally don't call `reconcile` yourself for that, because **`TotallyVersionable` uses it under the hood** on every undo/redo. Reach for `reconcile` directly only if you're managing your own snapshots/history instead of using `TotallyVersionable`:

```ts
const initialState = { count: 0 };
const tnm = new TotallyNotMutable(initialState);
const history = [initialState];

// record each new version as you mutate
history.push(tnm.mutate((d) => { d.count++; })); // { count: 1 }
history.push(tnm.mutate((d) => { d.count++; })); // { count: 2 }

// jump back to an earlier version - cheap, because it is structurally
// similar to the current value
tnm.reconcile(history[0]); // back to { count: 0 }
```

> `reconcile()` is **not** a partial update or a merge. It takes the whole next value; passing `{ onlyOneField }` replaces the entire value and drops everything else — exactly like `setValue()`.

## Immer vs ImmutableJS vs TotallyNotMutable - Fight!

Each library has its benefits and drawbacks.

### TotallyNotMutable vs Immer

One disadvantage to using Immer's `produce(input, (draft => {}))` method is that the input data needs to be fully processed (proxied) from scratch before each mutation unlike TotallyNotMutable, which is optimized for mutations. TotallyNotMutable processes the input data up front once, then with each mutation, only the parts that have changed need to be processed again. However, to achieve faster writes, the proxy stays in memory when using TotallyNotMutable.

### TotallyNotMutable vs ImmutableJS

One disadvantage to ImmutableJS is that developers have to learn custom objects and API methods. TotallyNotMutable's `mutate()` method allows developers to use standard javascript. Read/write performance is similar.

### Performance Metrics

Tests run on an Apple MacBook Pro, M5, 32 GB RAM.

| Test                                    | TotallyNotMutable | Immer  | ImmutableJS | Notes                                                             |
| --------------------------------------- | ----------------- | ------ | ----------- | ----------------------------------------------------------------- |
| 1k mutation calls with one update       | 2ms               | 1038ms | 4ms         | 1k calls to immer's produce(); ImmutableJS includes a toJs() call |
| 1 mutation call with many updates       | 1ms               | 2ms    | 1ms         | one call; ImmutableJS uses withMutations()                        |
| Single deep update, 10k-key object x50  | 12ms              | 56ms   | 30ms        | immer default copy; ImmutableJS toJs() once at the end (~0ms)      |
| Read 700kb                              | 2ms               | 0ms    | 2ms         |                                                                   |

`mutate()` is optimized for repeated mutations over time: the proxy stays in memory, so only the parts that change are reprocessed. That is why many separate mutation calls are dramatically faster than immer's `produce()`, which reprocesses the whole input on every call. For a single one-off operation immer is faster, because it does almost nothing until the draft is touched, whereas TotallyNotMutable builds its proxy up front.

#### Incremental updates (1000 small changes)

A new immutable value produced after **each** change:

| Library           | Time  |
| ----------------- | ----- |
| ImmutableJS       | 3ms   |
| TotallyNotMutable | 32ms  |
| Immer             | 175ms |

The same changes batched into a **single** operation:

| Library                     | Time |
| --------------------------- | ---- |
| TotallyNotMutable           | 1ms  |
| ImmutableJS (withMutations) | 1ms  |
| Immer (single produce)      | 2ms  |

ImmutableJS leads the per-change case — its persistent data structures are purpose-built for cheap incremental updates. Batched into one operation, the libraries converge.

#### Undo/redo with reconcile()

`TotallyVersionable` restores versions with `reconcile()`, which reconciles only what changed against the current value instead of rebuilding the proxy from scratch like `setValue()`. For structurally similar versions (the typical undo/redo case):

| Operation (100 iterations)     | Time  |
| ------------------------------ | ----- |
| setValue() (full rebuild)      | 183ms |
| reconcile() (structural sharing) | 40ms  |

When two versions share no references, `reconcile()` has no advantage over `setValue()` — prefer `setValue()` there.

## Integration with React

TotallyNotMutable and TotallyVersionable are easily integrated into React. The following hooks can be used in any component or can be part of a context provider.

```
// TotallyNotMutable hook
export function useTotallyNotMutable<T extends object>() {
  // create the instance once; useRef(new TotallyNotMutable()) would construct a
  // throwaway on every render
  const totallyNotMutableRef = useRef<TotallyNotMutable<T>>();
  if (!totallyNotMutableRef.current) {
    totallyNotMutableRef.current = new TotallyNotMutable<T>();
  }

  const [value, setValue] = useState<T | undefined>();

  const mutate = useCallback(
    (handler: (value: T) => void) => {
      setValue(totallyNotMutableRef.current?.mutate(handler));
    },
    [setValue]
  );

  const setValueCallback = useCallback(
    (value: T) => {
      setValue(totallyNotMutableRef.current?.setValue(value));
    },
    [setValue]
  );

  return {
    value,
    mutate,
    setValue: setValueCallback,
  };
}

//TotallyVersionable hook
export function useTotallyVersionable<T extends object>() {
  // create the instance once (see useTotallyNotMutable above)
  const versionHandlerRef = useRef<TotallyVersionable<T>>();
  if (!versionHandlerRef.current) {
    versionHandlerRef.current = new TotallyVersionable<T>();
  }

  const [value, setValue] = useState<T | undefined>();

  const mutate = useCallback(
    (handler: (value: T) => void) => {
      setValue(versionHandlerRef.current?.mutate(handler));
    },
    [setValue]
  );

  const addVersion = useCallback(
    (value: T) => {
      setValue(versionHandlerRef.current?.pushVersion(value));
    },
    [setValue]
  );

  const undo = useCallback(() => {
    setValue(versionHandlerRef.current?.undo());
  }, [setValue]);

  const redo = useCallback(() => {
    setValue(versionHandlerRef.current?.redo());
  }, [setValue]);

  const getSizes = useCallback(() => {
    return versionHandlerRef.current?.getSizes();
  }, []);

  const getVersion = useCallback(
    (index: number) => versionHandlerRef.current?.getVersion(index),
    []
  );

  const getEvents = useCallback(
    () => versionHandlerRef.current?.getEvents(),
    []
  );

  const getVersions = useCallback(
    () => versionHandlerRef.current?.getVersions(),
    []
  );

  return {
    value,
    mutate,
    addVersion,
    undo,
    redo,
    getSizes,
    getVersion,
    getEvents,
    getVersions,
  };
}


//In a context provider
export type TotallyNotMutableContext<T> = ReturnType<typeof useTotallyNotMutable<T>>;

export const GlobalContext = React.createContext<TotallyNotMutableContext<MyType>>(
  {} as TotallyNotMutableContext<MyType>
);

function SomeComponent(){
    const { value, mutate, setValue } = useContext(GlobalContext);

    return <div></div>
}

function App() {
  const versionableCtx = useTotallyNotMutable<MyType>();

  return (
    <GlobalContext.Provider value={versionableCtx}>
      <div className="App">
        <SomeComponent />
      </div>
    </GlobalContext.Provider>
  );
}

export default App;

```

## Migrating from 1.x to 2.0 (BREAKING CHANGE)

2.0 changes the constructor signature and tightens the types. There are four breaking changes:

### 1. The constructor is value-first

The initial value is now the first argument; configuration moved to an optional second argument.

```ts
// 1.x
const tnm = new TotallyNotMutable<MyType>({ autoFreeze: true });
tnm.setValue(initialData);

// 2.0
const tnm = new TotallyNotMutable(initialData, { autoFreeze: true });
```

`setValue()` still works and is still required if you don't seed at construction (see [Deferred / async initialization](#deferred--async-initialization)). The same reordering applies to `TotallyVersionable`, which seeds the first version for you:

```ts
// 1.x
const tv = new TotallyVersionable<MyType>();
tv.pushVersion(initialData);

// 2.0
const tv = new TotallyVersionable(initialData);
```

### 2. getValue() can return undefined

`getValue()` is now typed `T | undefined` to reflect that nothing is set before the first `setValue()`. Guard your reads, or seed the value at construction so it is never empty.

```ts
const value = tnm.getValue(); // T | undefined
if (value) {
  /* ... */
}
```

### 3. T is constrained to object

The value must be an object (plain object, array, `Map`, `Set`, or `Date`), so `T extends object` is now enforced at compile time. Primitive type arguments like `new TotallyNotMutable<number>()` were already a runtime error in 1.x and are now a type error.

### 4. Thrown errors are Error instances

Validation failures (e.g. calling `mutate()` before a value is set) now throw `new Error(...)` instead of a plain string. Update any `catch` blocks that treated the thrown value as a string.

## FAQ

#### Why was TotallyNotMutable/TotallyVersionable written?

Once upon a time, I needed to implement undo/redo functionality. ImmutableJS seemed cool, so I used it. It worked well. I was happy with it. I didn't touch the code for over a year. Then one day, I had to make some updates and realized having to relearn the ImmutableJS API again was a pain. At some point during all this, I read some comment from a seemingly opinionated developer that said something to the effect of, "You don't need ImmutableJS, you can just use the spread operator". This comment stuck with me for a while. I wanted to write something that automatically used the spread operator but didn't need to re-process the input for each mutation like ImmerJS.

#### When do I use TotallyNotMutable vs TotallyVersionable?

Use TotallyVersionable when you need undo/redo. If you don't need undo/redo, you likely should be fine with just TotallyNotMutable.

#### What's up with the package name? Why does the name have "not mutable"? You know it's "immutable" right?

Yep. "Immutable" was already taken. TotallyNotMutable's a dope name.
