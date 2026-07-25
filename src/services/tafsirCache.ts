/**
 * ============================================================
 *  Local cache for tafsir passages fetched from Firestore.
 *
 *  Follows the conventions of hadithService.ts — versioned, MRU-first,
 *  every storage call wrapped so a failure degrades to "works in memory"
 *  rather than breaking an answer.
 *
 *  Two deliberate differences from the hadith cache:
 *
 *  1. One key per passage, not one blob. A Tabari passage can be 146 KB, so a
 *     single-blob cache would re-serialise well over a megabyte on every write.
 *
 *  2. Bounded by BYTES as well as count. Bounding by count alone would be
 *     wrong here: 60 Tabari maxima would be ~8 MB, and AsyncStorage on Android
 *     is SQLite-backed with a ~6 MB default ceiling shared with chat history,
 *     the hadith cache, bookmarks and mushaf state.
 *
 *  Entries never go stale. Content ids are content-addressed (sha256 of the
 *  text), so changed text yields a different id and the old entry simply ages
 *  out of the LRU. There is no TTL to tune and no revalidation request.
 *
 *  AsyncStorage is NOT imported at module level on purpose: this module is
 *  loaded by the offline test harness, which runs in bare Node where that
 *  native module does not exist. The real store is injected at app start.
 * ============================================================
 */

export const TAFSIR_CACHE_VERSION = 1;
export const TAFSIR_CACHE_MAX_ENTRIES = 60;
export const TAFSIR_CACHE_MAX_BYTES = 1_500_000;
/** A single passage larger than this is served but never cached. */
export const TAFSIR_MAX_CACHEABLE_BYTES = 250_000;

const INDEX_KEY = `bsr-tf-idx-v${TAFSIR_CACHE_VERSION}`;
const ENTRY_PREFIX = `bsr-tf-c${TAFSIR_CACHE_VERSION}-`;

/** The slice of AsyncStorage this module needs. Injected so it can be faked. */
export interface KvStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
  multiGet(keys: string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiRemove(keys: string[]): Promise<void>;
}

/** No-op store: used until the app injects the real one, and in bare Node. */
const NULL_STORE: KvStore = {
  async getItem() {
    return null;
  },
  async setItem() {
    /* discard */
  },
  async removeItem() {
    /* discard */
  },
  async multiGet(keys) {
    return keys.map((k) => [k, null] as const);
  },
  async multiRemove() {
    /* discard */
  },
};

let store: KvStore = NULL_STORE;

/** Install the real storage backend (called once from app start). */
export function setTafsirKvStore(kv: KvStore): void {
  store = kv;
}

/** Test seam: swap in a fake store, mirroring _resetTafsirSearchCache(). */
export function _setKvStore(kv: KvStore): void {
  store = kv;
}

interface IndexEntry {
  id: string;
  bytes: number;
  at: number;
}

interface CacheIndex {
  version: number;
  entries: IndexEntry[];
}

function entryKey(id: string): string {
  return `${ENTRY_PREFIX}${id}`;
}

async function readIndex(): Promise<CacheIndex> {
  try {
    const raw = await store.getItem(INDEX_KEY);
    if (!raw) return { version: TAFSIR_CACHE_VERSION, entries: [] };
    const parsed = JSON.parse(raw) as CacheIndex;
    if (parsed?.version !== TAFSIR_CACHE_VERSION || !Array.isArray(parsed.entries)) {
      return { version: TAFSIR_CACHE_VERSION, entries: [] };
    }
    return {
      version: TAFSIR_CACHE_VERSION,
      entries: parsed.entries.filter(
        (e) => e && typeof e.id === 'string' && typeof e.bytes === 'number',
      ),
    };
  } catch {
    return { version: TAFSIR_CACHE_VERSION, entries: [] };
  }
}

async function writeIndex(index: CacheIndex): Promise<void> {
  try {
    await store.setItem(INDEX_KEY, JSON.stringify(index));
  } catch {
    /* storage full or unavailable — the session still works in memory */
  }
}

/**
 * Reads whatever is cached for these content ids. Always resolves; a storage
 * failure yields an empty map, which simply means "fetch it".
 */
export async function readCachedPassages(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  try {
    const pairs = await store.multiGet(ids.map(entryKey));
    for (const [key, value] of pairs) {
      if (typeof value === 'string' && value.length > 0) {
        out.set(key.slice(ENTRY_PREFIX.length), value);
      }
    }
  } catch {
    /* treat as a cold cache */
  }
  return out;
}

/**
 * Stores a passage and trims the LRU by both count and total bytes.
 * Arabic needs no JSON escaping, so the text is stored raw — no wrapper to
 * parse on every read.
 */
export async function writeCachedPassage(id: string, text: string): Promise<void> {
  if (!id || !text) return;
  // Byte length, not code-unit length: Arabic is ~2 bytes per character in UTF-8.
  const bytes = text.length * 2;
  if (bytes > TAFSIR_MAX_CACHEABLE_BYTES) return;

  try {
    await store.setItem(entryKey(id), text);
  } catch {
    return; // could not store it; nothing to index
  }

  const index = await readIndex();
  const entries = [
    { id, bytes, at: Date.now() },
    ...index.entries.filter((e) => e.id !== id),
  ];

  const evicted: string[] = [];
  let total = entries.reduce((sum, e) => sum + e.bytes, 0);
  while (
    entries.length > TAFSIR_CACHE_MAX_ENTRIES ||
    (total > TAFSIR_CACHE_MAX_BYTES && entries.length > 1)
  ) {
    const dropped = entries.pop();
    if (!dropped) break;
    total -= dropped.bytes;
    evicted.push(entryKey(dropped.id));
  }

  if (evicted.length > 0) {
    try {
      await store.multiRemove(evicted);
    } catch {
      /* the index no longer references them either way */
    }
  }
  await writeIndex({ version: TAFSIR_CACHE_VERSION, entries });
}

/** Stores several passages, preserving LRU order (last written is most recent). */
export async function writeCachedPassages(passages: Map<string, string>): Promise<void> {
  for (const [id, text] of passages) {
    await writeCachedPassage(id, text);
  }
}

export async function clearTafsirCache(): Promise<void> {
  try {
    const index = await readIndex();
    await store.multiRemove([INDEX_KEY, ...index.entries.map((e) => entryKey(e.id))]);
  } catch {
    /* ignore */
  }
}

/** Diagnostic: entry count and total bytes currently cached. */
export async function tafsirCacheStats(): Promise<{ entries: number; bytes: number }> {
  const index = await readIndex();
  return {
    entries: index.entries.length,
    bytes: index.entries.reduce((sum, e) => sum + e.bytes, 0),
  };
}
