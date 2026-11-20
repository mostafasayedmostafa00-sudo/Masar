import { MasarState } from '../types/masar';

const DB_NAME = 'masar_os_db';
const DB_VERSION = 1;
const STATE_STORE = 'app_state';
const PDF_STORE = 'pdf_blobs';
const AUDIO_STORE = 'audio_blobs';
const PREF_KEY = 'masar_os_prefs_v1';
const STATE_KEY = 'masar_os_state_v1';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STATE_STORE)) db.createObjectStore(STATE_STORE);
      if (!db.objectStoreNames.contains(PDF_STORE)) db.createObjectStore(PDF_STORE);
      if (!db.objectStoreNames.contains(AUDIO_STORE)) db.createObjectStore(AUDIO_STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export function saveQuickPrefs(prefs: { language: 'en' | 'ar'; theme: 'dark' | 'light' | 'system' }) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
  } catch {
    // ignore storage quota errors
  }
}

export function loadQuickPrefs(): { language: 'en' | 'ar'; theme: 'dark' | 'light' | 'system' } | null {
  try {
    const raw = localStorage.getItem(PREF_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function loadMasarState(): Promise<MasarState | null> {
  try {
    const db = await openDb();
    const result = await new Promise<MasarState | null>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readonly');
      const store = tx.objectStore(STATE_STORE);
      const req = store.get(STATE_KEY);
      req.onsuccess = () => resolve((req.result as MasarState) ?? null);
      req.onerror = () => reject(req.error);
    });
    if (result) return result;
  } catch {
    // Fallback to localStorage
  }

  try {
    const raw = localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as MasarState) : null;
  } catch {
    return null;
  }
}

export async function saveMasarState(state: MasarState): Promise<void> {
  saveQuickPrefs({ language: state.language, theme: state.theme });
  try {
    localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // ignore if state exceeds localStorage; IndexedDB handles full size
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STATE_STORE, 'readwrite');
      tx.objectStore(STATE_STORE).put(state, STATE_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // localStorage fallback already attempted
  }
}

export async function clearAllMasarData(): Promise<void> {
  try {
    localStorage.removeItem(STATE_KEY);
    localStorage.removeItem(PREF_KEY);
  } catch {
    // ignore
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([STATE_STORE, PDF_STORE, AUDIO_STORE], 'readwrite');
      tx.objectStore(STATE_STORE).clear();
      tx.objectStore(PDF_STORE).clear();
      tx.objectStore(AUDIO_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch {
    // ignore
  }
}

export async function savePdfBlob(id: string, data: ArrayBuffer): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).put(data, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadPdfBlob(id: string): Promise<ArrayBuffer | null> {
  const db = await openDb();
  return new Promise<ArrayBuffer | null>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readonly');
    const req = tx.objectStore(PDF_STORE).get(id);
    req.onsuccess = () => resolve((req.result as ArrayBuffer) ?? null);
    req.onerror = () => reject(req.error);
  });
}

export async function deletePdfBlob(id: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(PDF_STORE, 'readwrite');
    tx.objectStore(PDF_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function saveSpeakingAudio(day: number, blob: Blob): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put(blob, `speaking-day-${day}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function loadSpeakingAudio(day: number): Promise<Blob | null> {
  const db = await openDb();
  return new Promise<Blob | null>((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).get(`speaking-day-${day}`);
    req.onsuccess = () => resolve((req.result as Blob) ?? null);
    req.onerror = () => reject(req.error);
  });
}
