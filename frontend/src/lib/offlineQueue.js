// /frontend/src/lib/offlineQueue.js
const DB_NAME = 'HRPulseOfflineQueue';
const DB_VERSION = 1;
const STORE_NAME = 'attendance_queue';

/**
 * Initialize IndexedDB database.
 * 
 * @returns {Promise<IDBDatabase>}
 */
export function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (event) => {
      console.error('IndexedDB open error:', event.target.error);
      reject(event.target.error);
    };

    request.onsuccess = (event) => {
      resolve(event.target.result);
    };

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };
  });
}

/**
 * Queue a check-in or check-out action in IndexedDB.
 * 
 * @param {string} userId 
 * @param {'check-in'|'check-out'} type 
 * @param {string} timestamp 
 * @returns {Promise<boolean>}
 */
export async function queueAction(userId, type, timestamp) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const action = {
      userId,
      type,
      timestamp,
      synced_offline: true,
      createdAt: new Date().toISOString(),
    };

    const request = store.add(action);

    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Get all queued actions for a specific user, sorted chronologically.
 * 
 * @param {string} userId 
 * @returns {Promise<Array<object>>}
 */
export async function getQueuedActions(userId) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      // Filter by user ID and sort by chronological order of creation
      const actions = (request.result || [])
        .filter((action) => action.userId === userId)
        .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
      resolve(actions);
    };

    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Delete a queued action from IndexedDB.
 * 
 * @param {number} id 
 * @returns {Promise<boolean>}
 */
export async function deleteQueuedAction(id) {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => resolve(true);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Verify network status using browser context + a HEAD heartbeat check to backend.
 * 
 * @returns {Promise<boolean>}
 */
export async function checkOnlineStatus() {
  if (!navigator.onLine) {
    return false;
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s heartbeat timeout

    // Request the health endpoint of HRPulse backend
    const response = await fetch('/health', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.ok;
  } catch (err) {
    return false; // Server unreachable -> offline state
  }
}
