/**
 * Magazyn danych gry w przeglądarce (T14: gra bez kont). Dane NIE opuszczają urządzenia.
 * IndexedDB (duże zapisy, brak limitu 5 MB `localStorage`), a gdy jest niedostępne
 * (tryb prywatny w starszych przeglądarkach, testy jsdom) - `localStorage`.
 */

export type StoreName = "colonies" | "maps";

export interface KeyValueStore {
  get<T>(store: StoreName, key: string): Promise<T | undefined>;
  getAll<T>(store: StoreName): Promise<T[]>;
  put<T>(store: StoreName, key: string, value: T): Promise<void>;
  delete(store: StoreName, key: string): Promise<void>;
}

const DB_NAME = "mars-terraform";
const DB_VERSION = 1;
const STORES: readonly StoreName[] = ["colonies", "maps"];
const LOCAL_PREFIX = "mars-terraform:store:";

const requestToPromise = <T>(request: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });

export const createIndexedDbStore = (factory: IDBFactory): KeyValueStore => {
  let dbPromise: Promise<IDBDatabase> | null = null;
  const open = (): Promise<IDBDatabase> => {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const request = factory.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          for (const name of STORES) {
            if (!request.result.objectStoreNames.contains(name)) request.result.createObjectStore(name);
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error ?? new Error("IndexedDB open failed"));
      });
    }
    return dbPromise;
  };
  const withStore = async <T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> => {
    const db = await open();
    return requestToPromise(fn(db.transaction(store, mode).objectStore(store)));
  };

  return {
    get: <T>(store: StoreName, key: string) => withStore(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>),
    getAll: <T>(store: StoreName) => withStore(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
    put: async <T>(store: StoreName, key: string, value: T) => {
      await withStore(store, "readwrite", (s) => s.put(value, key));
    },
    delete: async (store: StoreName, key: string) => {
      await withStore(store, "readwrite", (s) => s.delete(key));
    },
  };
};

export const createLocalStorageStore = (storage: Storage): KeyValueStore => {
  const fullKey = (store: StoreName, key: string): string => `${LOCAL_PREFIX}${store}:${key}`;
  return {
    get: async <T>(store: StoreName, key: string) => {
      const raw = storage.getItem(fullKey(store, key));
      return raw === null ? undefined : (JSON.parse(raw) as T);
    },
    getAll: async <T>(store: StoreName) => {
      const prefix = `${LOCAL_PREFIX}${store}:`;
      const values: T[] = [];
      for (let i = 0; i < storage.length; i += 1) {
        const key = storage.key(i);
        const raw = key?.startsWith(prefix) ? storage.getItem(key) : null;
        if (raw !== null) values.push(JSON.parse(raw) as T);
      }
      return values;
    },
    put: async <T>(store: StoreName, key: string, value: T) => {
      storage.setItem(fullKey(store, key), JSON.stringify(value));
    },
    delete: async (store: StoreName, key: string) => {
      storage.removeItem(fullKey(store, key));
    },
  };
};

let persistRequest: Promise<boolean> | null = null;

/**
 * T16: prośba o trwałe przechowywanie (`navigator.storage.persist()`), żeby przeglądarka nie usunęła
 * zapisów przy braku miejsca. Wołane przy pierwszym zapisie w sesji (akcja gracza); raz na sesję.
 * Zwraca `true`, gdy magazyn jest trwały. Brak API albo błąd = `false` (gra działa dalej).
 */
export const requestPersistentStorage = (): Promise<boolean> => {
  if (!persistRequest) {
    persistRequest = (async () => {
      const storage = typeof navigator !== "undefined" ? navigator.storage : undefined;
      if (!storage || typeof storage.persist !== "function") return false;
      try {
        if (typeof storage.persisted === "function" && (await storage.persisted())) return true;
        return await storage.persist();
      } catch {
        return false;
      }
    })();
  }
  return persistRequest;
};

/** Tylko do testów: ponowne pozwolenie na prośbę o trwałe przechowywanie. */
export const resetPersistRequestForTests = (): void => {
  persistRequest = null;
};

let defaultStore: KeyValueStore | null = null;

/** Magazyn domyślny: IndexedDB, jeśli jest, w przeciwnym razie `localStorage`. */
export const getBrowserStore = (): KeyValueStore => {
  if (!defaultStore) {
    defaultStore =
      typeof indexedDB !== "undefined" ? createIndexedDbStore(indexedDB) : createLocalStorageStore(window.localStorage);
  }
  return defaultStore;
};

/** Tylko do testów: podmiana magazynu. */
export const setBrowserStoreForTests = (store: KeyValueStore | null): void => {
  defaultStore = store;
};
