# TotallyNotMutable

This one trick makes all your JS mutability and undo/redo problems disappear (doctors hate it!).

## Intro

This package contains two vanilla JS classes that use structural sharing to accomplish immutability and versioning (undo/redo). Compatible with plain objects, Dates, Maps, and Sets. Integrates easily into major frameworks (react, angular, etc.). Optimized for mutations over time.

### TotallyNotMutable

A class built to handle modifications to an object without mutating the original object.

```
//step 1 - set the value
const intialData = {foo:'bar',arr:['hello','world'], obj:{a:'a',anotherObject:{bool:true}}};
const tnm = new TotallyNotMutable<typeof intialData>({autoFreeze:false}); //configuration is optional
tnm.setValue(initialData);

//step 2 - mutate
const step2Value = tnm.mutate((value)=>{
    value.foo = 'bar no more!';
    value.arr.push('again');
    value.obj.a = 'a has been updated';
});
const structuralSharing = intialData.obj.anotherObject === step2Value.obj.anotherObject; // true

//step 3 - ????

//step 4 - PROFIT!!

```

### TotallyVersionable

A class built to handle undo/redo. Built on top of TotallyNotMutable

```
const intialData = {foo:'bar',arr:['hello','world'], obj:{a:'a',anotherObject:{bool:true}}};
const tnm = new TotallyVersionable<typeof intialData>({autoFreeze:false}); //configuration is optional
//step 1 - set the value
tnm.setValue(initialData);

//step 2 - mutate
const secondValue = tnm.mutate((value)=>{
    value.foo = 'bar no more!';
    value.arr.push('again');
    value.obj.a = 'a has been updated';
});

//step 3 - undo
const thirdValue = tnm.undo();
const isEqualToInitial = intialData === thirdValue; //true

//step 4 - redo
const fourthValue = tnm.redo();
const isEqualToMutated = secondValue === fourthValue; //true

```

### Confguration

Both classes' constructors take a single parameter as the configuration which can enable auto freezing. This will be a performance hit but can be usefull in a development environment to ensure resulting data is not being modified externally.

```
const tnm = new TotallyNotMutable<SomeType>({autoFreeze:true})
```

## Immer vs ImmutableJS vs TotallyNotMutable - Fight!

Each library has its benefits and drawbacks.

### TotallyNotMutable vs Immer

One disadvantage to using Immer's `produce(input, (draft => {}))` method is that the input data needs to be fully processed (proxied) from scratch before each mutation unlike TotallyNotMutable, which is optimized for mutations. TotallyNotMutable processes the input data up front once, then with each mutation, only the parts that have changed need to be processed again. However, to achieve faster writes, the proxy stays in memory when using TotallyNotMutable.

### TotallyNotMutable vs ImmutableJS

One disadvantage to ImmutableJS is that developers have to learn custom objects and API methodss. TotallyNotMutable's `mutate()` method allows developers to use standard javascript. Read/write performance is similar.

### Performance Metrics

Tests run on Apple Macbook Pro, 32 GB ram, M1 Pro processor

| Test                              | TotallyNotMutable | Immer  | ImmutableJS | Notes                                                              |
| --------------------------------- | ----------------- | ------ | ----------- | ------------------------------------------------------------------ |
| 1k mutation calls with one update | 4ms               | 1962ms | 5ms         | 1k calls to immer's produce(), ImmutableJS includes a toJs() call, |
| 1 mutation call with 1k updates   | 2ms               | 2ms    | 2ms         | one call to immer's produce(), ImmutableJS uses withMutations() ,  |
| Read 700kb                        | 5ms               | 0ms    | 7ms         |                                                                    |

## Integration with React

TotallyNotMutable and Totally versionable are easily integrated into React. The following hooks can be used in any component or can be part of a context provider.

```
// TotallyNotMutable hook
export function useTotallyNotMutable<T>() {
  const totallyNotMutableRef = useRef(new TotallyNotMutable<T>());

  const [value, setValue] = useState<T>();

  const mutate = useCallback(
    (handler: (value: T) => void) => {
      setValue(totallyNotMutableRef.current.mutate(handler));
    },
    [setValue]
  );

  const setValueCallback = useCallback(
    (value: T) => {
      setValue(totallyNotMutableRef.current.setValue(value));
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
export function useTotallyVersionable<T>() {
  const versionHandlerRef = useRef(new TotallyVersionable<T>());

  const [value, setValue] = useState<T>();

  const mutate = useCallback(
    (handler: (value: T) => void) => {
      setValue(versionHandlerRef.current.mutate(handler));
    },
    [setValue]
  );

  const addVersion = useCallback(
    (value: T) => {
      setValue(versionHandlerRef.current.pushVersion(value));
    },
    [setValue]
  );

  const undo = useCallback(() => {
    setValue(versionHandlerRef.current.undo());
  }, [setValue]);

  const redo = useCallback(() => {
    setValue(versionHandlerRef.current.redo());
  }, [setValue]);

  const getSizes = useCallback(() => {
    return versionHandlerRef.current.getSizes();
  }, []);

  const getVersion = useCallback(
    (index: number) => versionHandlerRef.current.getVersion(index),
    []
  );

  const getEvents = useCallback(
    () => versionHandlerRef.current.getEvents(),
    []
  );

  const getVersions = useCallback(
    () => versionHandlerRef.current.getVersions(),
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
        <SomeComponent>
      </div>
    </GlobalContext.Provider>
  );
}

export default App;

```

## FAQ

#### Why was TotallyNotMutable/TotallyVersionable written?

Once upon a time, I needed to implemented undo/redo functionality. ImmutableJS seemed cool, so I used it. It worked well. I was happy with it. I didn't touch the code for over a year. Then one day, I had to make some updates and realized having to relearn the ImmutableJS API again was a pain. At some point during all this, I read some comment from a seemingly opinionated developer that said something to the effect of, "You don't need ImmutableJS, you can just use the spread operator". This comment stuck with me for a while. I wanted to write something that automatically used the spread operator but didn't need to re-process the input for each mutation like ImmerJS.

#### When do I use TotallyNotMutable vs TotallyVersionable?

Use TotallyVersionable when you need undo/redo. If you don't need undo/redo, you likely should be fine with just TotallyNotMutable.

#### What's up with the package name? Why does the name have "not mutable"? You know it's "immutable" right?

Yep. "Immutable" was already taken. TotallyNotMutable's a dope name.
