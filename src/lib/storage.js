/** @typedef {{ id: string, name: string, image: string, category?: string, address?: string, rating?: number }} Restaurant */
/** @typedef {{ restaurants: Restaurant[], categories: string[], weekStart: string, selections: Record<string, Restaurant>, dailyDraw?: { date: string, restaurant: Restaurant } }} LunchState */
export const defaultCategories = ['台式料理', '日式料理', '韓式料理', '異國料理', '輕食健康', '其他'];

const DATABASE_NAME = 'lunch-gacha';
const STORE_NAME = 'lunch';
const STATE_KEY = 'state';
/** @type {Promise<IDBDatabase> | undefined} */
let databasePromise;

/** @param {Date} [date] */
export function localDate(date = new Date()) {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** @param {Date} [date] */
export function startOfWeek(date = new Date()) {
  const monday = new Date(date);
  // Calendar arithmetic, rather than elapsed milliseconds, keeps DST weeks local.
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  return localDate(monday);
}

/** @param {LunchState} state @param {Date} [date] @returns {LunchState} */
export function currentWeek(state, date = new Date()) {
  const weekStart = startOfWeek(date);
  return state.weekStart === weekStart ? state : { ...state, weekStart, selections: {} };
}

/** @param {LunchState} state @param {string} name @returns {LunchState} */
export function deleteCategory(state, name) {
  if (typeof name !== 'string' || !name.trim()
    || defaultCategories.some((category) => category.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    throw new Error('預設分類無法刪除，請選擇自訂分類。');
  }
  if (!state.categories.includes(name)) throw new Error('這個分類不存在。');
  return {
    ...state,
    categories: state.categories.filter((category) => category !== name),
    restaurants: state.restaurants.map((restaurant) => {
      if (restaurant.category !== name) return restaurant;
      const { category, ...uncategorized } = restaurant;
      return uncategorized;
    }),
  };
}

function openDatabase() {
  if (databasePromise) return databasePromise;

  /** @type {Promise<IDBDatabase>} */
  const opening = new Promise((resolve, reject) => {
    let failed = false;
    /** @param {string} message @param {unknown} [cause] */
    const fail = (message, cause) => {
      failed = true;
      reject(new Error(message, { cause }));
    };

    try {
      const request = indexedDB.open(DATABASE_NAME, 1);
      request.onupgradeneeded = () => {
        request.result.createObjectStore(STORE_NAME);
      };
      request.onblocked = () => fail('午餐資料庫被其他分頁阻擋，請關閉舊分頁後再試。');
      request.onerror = () => fail('無法開啟午餐資料庫，請確認瀏覽器允許本機儲存。', request.error);
      request.onsuccess = () => {
        const database = request.result;
        if (failed) {
          database.close();
          return;
        }
        database.onversionchange = () => {
          database.close();
          if (databasePromise === opening) databasePromise = undefined;
        };
        database.onclose = () => {
          if (databasePromise === opening) databasePromise = undefined;
        };
        resolve(database);
      };
    } catch (cause) {
      fail('此瀏覽器無法使用午餐資料庫，請確認已允許本機儲存。', cause);
    }
  });
  databasePromise = opening;
  opening.catch(() => {
    if (databasePromise === opening) databasePromise = undefined;
  });
  return opening;
}

/** @param {(stored: unknown) => LunchState} update @returns {Promise<LunchState>} */
async function transact(update) {
  const database = await openDatabase();
  const message = '午餐資料儲存失敗，這次變更尚未儲存，請再試一次。';

  return new Promise((resolve, reject) => {
    try {
      // Keep reads and updates in one transaction so other tabs cannot reroll or erase the daily draw.
      const transaction = database.transaction(STORE_NAME, 'readwrite', { durability: 'strict' });
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(STATE_KEY);
      /** @type {LunchState} */
      let saved;
      /** @type {unknown} */
      let failure;
      request.onsuccess = () => {
        try {
          const json = JSON.stringify(update(request.result));
          saved = JSON.parse(json);
          store.put(json, STATE_KEY);
        } catch (cause) {
          failure = cause;
          transaction.abort();
        }
      };
      transaction.oncomplete = () => resolve(saved);
      transaction.onabort = () => reject(failure ?? new Error(message, { cause: transaction.error ?? request.error }));
    } catch (cause) {
      reject(new Error(message, { cause }));
    }
  });
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** @param {unknown} value @returns {value is Restaurant} */
function isRestaurant(value) {
  return isRecord(value)
    && typeof value.id === 'string' && value.id.trim().length > 0
    && typeof value.name === 'string' && value.name.trim().length > 0
    && typeof value.image === 'string'
    && (value.category === undefined || typeof value.category === 'string')
    && (value.address === undefined || typeof value.address === 'string')
    && (value.rating === undefined || (typeof value.rating === 'number' && Number.isInteger(value.rating) && value.rating >= 0 && value.rating <= 5));
}

/** @param {unknown} value @returns {value is string} */
function isDateKey(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)
    && localDate(new Date(`${value}T12:00:00`)) === value;
}

/** @param {unknown} value @returns {value is LunchState} */
function isState(value) {
  if (!isRecord(value) || !Array.isArray(value.restaurants)
    || !value.restaurants.every(isRestaurant)
    || new Set(value.restaurants.map((restaurant) => restaurant.id)).size !== value.restaurants.length
    || !isDateKey(value.weekStart)
    || startOfWeek(new Date(`${value.weekStart}T12:00:00`)) !== value.weekStart
    || !isRecord(value.selections)) return false;
  if (value.categories !== undefined && (!Array.isArray(value.categories)
    || !value.categories.every((category) => typeof category === 'string'
      && category === category.trim() && category.length > 0 && category.length <= 30)
    || new Set(value.categories.map((category) => category.toLocaleLowerCase())).size !== value.categories.length)) return false;
  if (value.dailyDraw !== undefined && (!isRecord(value.dailyDraw)
    || !isDateKey(value.dailyDraw.date) || !isRestaurant(value.dailyDraw.restaurant))) return false;

  // History contains snapshots, including restaurants removed from the collection.
  return Object.entries(value.selections).every(([date, restaurant]) => isDateKey(date) && isRestaurant(restaurant));
}

/** @param {unknown} stored @param {Restaurant[]} seeds @param {Date} date @returns {LunchState} */
function readState(stored, seeds, date) {
  if (stored === undefined) {
    const initial = { restaurants: seeds.map((restaurant) => ({ ...restaurant })), categories: [...defaultCategories], weekStart: startOfWeek(date), selections: {} };
    if (!isState(initial)) throw new Error('初始午餐資料格式不正確。');
    return initial;
  }
  if (typeof stored !== 'string') {
    throw new Error('已儲存的午餐資料格式不正確，原始資料已保留，未自動重設。');
  }

  let state;
  try {
    state = JSON.parse(stored);
  } catch (cause) {
    throw new Error('已儲存的午餐資料無法解析，原始資料已保留，未自動重設。', { cause });
  }
  if (!isState(state)) {
    throw new Error('已儲存的午餐資料內容不完整或格式不正確，原始資料已保留，未自動重設。');
  }
  if (state.categories === undefined) {
    state.categories = [...defaultCategories];
    const known = new Set(state.categories.map((category) => category.toLocaleLowerCase()));
    for (const restaurant of [...state.restaurants, ...Object.values(state.selections)]) {
      const category = restaurant.category?.trim();
      if (category && category.length > 30) {
        throw new Error('舊有分類超過 30 字，原始午餐資料已保留，未自動重設。');
      }
      if (category && !known.has(category.toLocaleLowerCase())) {
        state.categories.push(category);
        known.add(category.toLocaleLowerCase());
      }
    }
  }
  const today = localDate(date);
  if (state.selections[today] && (!state.dailyDraw || state.dailyDraw.date < today)) {
    state.dailyDraw = { date: today, restaurant: { ...state.selections[today] } };
  }
  return currentWeek(state, date);
}

/** @param {Restaurant[]} seeds @returns {Promise<LunchState>} */
export function loadState(seeds) {
  return transact((stored) => readState(stored, seeds, new Date()));
}

/** @param {LunchState} state @returns {Promise<LunchState>} */
export async function saveState(state) {
  let json;
  try {
    json = JSON.stringify(state);
  } catch (cause) {
    throw new Error('午餐資料無法轉換為儲存格式，這次變更尚未儲存。', { cause });
  }
  return transact((stored) => {
    const date = new Date();
    const next = readState(json, [], date);
    if (stored !== undefined) {
      const existing = readState(stored, [], date);
      if (existing.dailyDraw && (!next.dailyDraw || existing.dailyDraw.date >= next.dailyDraw.date)) {
        next.dailyDraw = existing.dailyDraw;
      }
    }
    return next;
  });
}

/** @param {Restaurant[]} seeds @returns {Promise<LunchState>} */
export function recordDailyDraw(seeds) {
  return transact((stored) => {
    const date = new Date();
    const state = readState(stored, seeds, date);
    const today = localDate(date);
    if (state.dailyDraw?.date === today) return state;
    if (state.restaurants.length === 0) throw new Error('請先加入店家，再抽取今天的午餐。');
    const restaurant = state.restaurants[Math.floor(Math.random() * state.restaurants.length)];
    return { ...state, dailyDraw: { date: today, restaurant: { ...restaurant } } };
  });
}

/** @returns {Promise<boolean | null>} */
export async function storageStatus() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persisted !== 'function') return null;
    return await navigator.storage.persisted();
  } catch {
    return null;
  }
}

/** @returns {Promise<boolean | null>} */
export async function requestPersistence() {
  try {
    if (typeof navigator === 'undefined' || typeof navigator.storage?.persist !== 'function') return null;
    return await navigator.storage.persist();
  } catch {
    return null;
  }
}
