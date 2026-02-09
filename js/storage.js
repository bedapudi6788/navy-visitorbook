/**
 * IndexedDB Storage Module for Visitor Book
 */

const DB_NAME = 'VisitorBookDB';
const DB_VERSION = 2;
const ENTRIES_STORE = 'entries';
const VISITORS_STORE = 'visitors';

let db = null;

/**
 * Initialize the database
 */
export async function initDB() {
    return new Promise((resolve, reject) => {
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onerror = () => {
            console.error('Failed to open database:', request.error);
            reject(request.error);
        };

        request.onsuccess = () => {
            db = request.result;
            console.log('Database initialized');
            resolve(db);
        };

        request.onupgradeneeded = (event) => {
            const database = event.target.result;

            // Create entries store (feedback submissions)
            if (!database.objectStoreNames.contains(ENTRIES_STORE)) {
                const store = database.createObjectStore(ENTRIES_STORE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }

            // Create visitors store (pre-registered visitors)
            if (!database.objectStoreNames.contains(VISITORS_STORE)) {
                const store = database.createObjectStore(VISITORS_STORE, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                store.createIndex('name', 'name', { unique: false });
            }
        };
    });
}

// ============ FEEDBACK ENTRIES ============

/**
 * Save a visitor entry
 * @param {Object} entry - Entry object with photo, signature, name
 * @returns {Promise<number>} - The ID of the saved entry
 */
export async function saveEntry(entry) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readwrite');
        const store = transaction.objectStore(ENTRIES_STORE);

        const entryData = {
            photo: entry.photo,           // Blob
            signature: entry.signature,   // Blob
            name: entry.name || '',       // Optional name
            designation: entry.designation || '', // Optional designation
            timestamp: new Date().toISOString()
        };

        const request = store.add(entryData);

        request.onsuccess = () => {
            console.log('Entry saved with ID:', request.result);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Failed to save entry:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all entries, sorted by timestamp (newest first)
 * @returns {Promise<Array>} - Array of entry objects
 */
export async function getAllEntries() {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readonly');
        const store = transaction.objectStore(ENTRIES_STORE);
        const index = store.index('timestamp');

        const entries = [];
        const request = index.openCursor(null, 'prev'); // Descending order

        request.onsuccess = (event) => {
            const cursor = event.target.result;
            if (cursor) {
                entries.push(cursor.value);
                cursor.continue();
            } else {
                resolve(entries);
            }
        };

        request.onerror = () => {
            console.error('Failed to get entries:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a single entry by ID
 * @param {number} id - Entry ID
 * @returns {Promise<Object>} - Entry object
 */
export async function getEntry(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readonly');
        const store = transaction.objectStore(ENTRIES_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Failed to get entry:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete an entry by ID
 * @param {number} id - Entry ID
 * @returns {Promise<void>}
 */
export async function deleteEntry(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readwrite');
        const store = transaction.objectStore(ENTRIES_STORE);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log('Entry deleted:', id);
            resolve();
        };

        request.onerror = () => {
            console.error('Failed to delete entry:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get total count of entries
 * @returns {Promise<number>}
 */
export async function getEntryCount() {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readonly');
        const store = transaction.objectStore(ENTRIES_STORE);
        const request = store.count();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            reject(request.error);
        };
    });
}

/**
 * Delete all entries
 * @returns {Promise<void>}
 */
export async function deleteAllEntries() {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([ENTRIES_STORE], 'readwrite');
        const store = transaction.objectStore(ENTRIES_STORE);
        const request = store.clear();

        request.onsuccess = () => {
            console.log('All entries deleted');
            resolve();
        };

        request.onerror = () => {
            console.error('Failed to delete all entries:', request.error);
            reject(request.error);
        };
    });
}

// ============ PRE-REGISTERED VISITORS ============

/**
 * Add a pre-registered visitor
 * @param {Object} visitor - Visitor object with photo and name
 * @returns {Promise<number>} - The ID of the saved visitor
 */
export async function addVisitor(visitor) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VISITORS_STORE], 'readwrite');
        const store = transaction.objectStore(VISITORS_STORE);

        const visitorData = {
            photo: visitor.photo,    // Blob
            name: visitor.name,      // Name
            designation: visitor.designation || '', // Designation
            createdAt: new Date().toISOString()
        };

        const request = store.add(visitorData);

        request.onsuccess = () => {
            console.log('Visitor added with ID:', request.result);
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Failed to add visitor:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get all pre-registered visitors
 * @returns {Promise<Array>} - Array of visitor objects
 */
export async function getAllVisitors() {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VISITORS_STORE], 'readonly');
        const store = transaction.objectStore(VISITORS_STORE);
        const request = store.getAll();

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Failed to get visitors:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Get a single visitor by ID
 * @param {number} id - Visitor ID
 * @returns {Promise<Object>} - Visitor object
 */
export async function getVisitor(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VISITORS_STORE], 'readonly');
        const store = transaction.objectStore(VISITORS_STORE);
        const request = store.get(id);

        request.onsuccess = () => {
            resolve(request.result);
        };

        request.onerror = () => {
            console.error('Failed to get visitor:', request.error);
            reject(request.error);
        };
    });
}

/**
 * Delete a pre-registered visitor by ID
 * @param {number} id - Visitor ID
 * @returns {Promise<void>}
 */
export async function deleteVisitor(id) {
    await initDB();

    return new Promise((resolve, reject) => {
        const transaction = db.transaction([VISITORS_STORE], 'readwrite');
        const store = transaction.objectStore(VISITORS_STORE);
        const request = store.delete(id);

        request.onsuccess = () => {
            console.log('Visitor deleted:', id);
            resolve();
        };

        request.onerror = () => {
            console.error('Failed to delete visitor:', request.error);
            reject(request.error);
        };
    });
}

// ============ UTILITIES ============

/**
 * Convert a Blob to a data URL for display
 * @param {Blob} blob - The blob to convert
 * @returns {Promise<string>} - Data URL
 */
export function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

/**
 * Convert a data URL to a Blob for storage
 * @param {string} dataURL - The data URL to convert
 * @returns {Promise<Blob>}
 */
export async function dataURLToBlob(dataURL) {
    const response = await fetch(dataURL);
    return response.blob();
}
