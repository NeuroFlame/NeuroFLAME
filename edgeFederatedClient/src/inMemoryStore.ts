// Define the type for your store's data
type StoreData = {
  accessToken: string
}

// Create a function that initializes the store and exposes methods to interact with it
function createStore() {
  const store: StoreData = { accessToken: '' }

  return {
    get<K extends keyof StoreData>(key: K): StoreData[K] {
      return store[key]
    },
    set<K extends keyof StoreData>(key: K, value: StoreData[K]): void {
      store[key] = value
    },
  }
}

// Invoke the function immediately to create the store and export its interface
const inMemoryStore = createStore()

export default inMemoryStore
