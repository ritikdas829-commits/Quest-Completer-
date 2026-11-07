/**
 * roleStore.js - Roles Per Guild - MongoDB Persistent - Strict 2-Slot System
 * Location: src/quest/roleStore.js
 */

import { getCollection } from '../utils/mongo.js';
import fs from 'fs';
import path from 'path';

const STORE_PATH = './data/roles.json';
const COLLECTION_NAME = 'roles_data';

const DEFAULT_ROLES = {
    ROLE_2_INVITES: null,  // Slot 1: 2 Invites Role
    ROLE_1_BOOST: null,    // Slot 2: Server Boost Role (Auto-Quest Locked)
};

const memoryCache = new Map();
let isCacheLoaded = false;

function ensureDataFolder() {
    try {
        const dir = path.dirname(STORE_PATH);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch {}
}

async function preloadCache() {
    try {
        const col = await getCollection(COLLECTION_NAME);
        if (!col) return;
        const allDocs = await col.find({}).toArray();
        allDocs.forEach(doc => {
            if (doc.guildId && doc.roles) {
                memoryCache.set(doc.guildId, { ...DEFAULT_ROLES, ...doc.roles });
            }
        });
        isCacheLoaded = true;
    } catch (err) {
        console.error("Roles preload error:", err.message);
    }
}

export function getRoles(guildId = null) {
    ensureDataFolder();
    if (guildId) {
        if (memoryCache.has(guildId)) {
            return { ...DEFAULT_ROLES, ...memoryCache.get(guildId) };
        }
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                if (data[guildId]) return { ...DEFAULT_ROLES, ...data[guildId] };
            }
        } catch {}
        return { ...DEFAULT_ROLES };
    } else {
        try {
            if (fs.existsSync(STORE_PATH)) {
                const data = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
                return { ...DEFAULT_ROLES, ...data };
            }
        } catch {}
        return { ...DEFAULT_ROLES };
    }
}

export async function getRolesAsync(guildId) {
    if (!isCacheLoaded) await preloadCache();
    return getRoles(guildId);
}

export async function setRole(guildId, key, roleId) {
    if (!guildId || !key) return null;
    ensureDataFolder();
    let roles = getRoles(guildId);
    roles[key] = roleId;
    memoryCache.set(guildId, roles);

    try {
        let fileData = {};
        if (fs.existsSync(STORE_PATH)) {
            fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        }
        fileData[guildId] = roles;
        fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
    } catch {}

    try {
        const col = await getCollection(COLLECTION_NAME);
        if (col) {
            await col.updateOne(
                { guildId },
                { $set: { guildId, roles, updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch {}
    return roles;
}

export async function removeRole(guildId, key) {
    if (!guildId || !key) return null;
    ensureDataFolder();
    let roles = getRoles(guildId);
    roles[key] = null;
    memoryCache.set(guildId, roles);

    try {
        let fileData = {};
        if (fs.existsSync(STORE_PATH)) {
            fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
        }
        fileData[guildId] = roles;
        fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
    } catch {}

    try {
        const col = await getCollection(COLLECTION_NAME);
        if (col) {
            await col.updateOne(
                { guildId },
                { $set: { guildId, roles, updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch {}
    return roles;
}

export async function syncRolesFromDB() {
    try {
        const col = await getCollection(COLLECTION_NAME);
        if (!col) return null;
        const allDocs = await col.find({}).toArray();
        
        ensureDataFolder();
        let fileData = {};
        try {
            if (fs.existsSync(STORE_PATH)) {
                fileData = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
            }
        } catch {}

        allDocs.forEach(doc => {
            if (doc.guildId && doc.roles) {
                memoryCache.set(doc.guildId, { ...DEFAULT_ROLES, ...doc.roles });
                fileData[doc.guildId] = { ...DEFAULT_ROLES, ...doc.roles };
            }
        });

        try {
            fs.writeFileSync(STORE_PATH, JSON.stringify(fileData, null, 2));
        } catch {}

        isCacheLoaded = true;
        return memoryCache;
    } catch (err) {
        console.error("Sync roles error:", err.message);
        return null;
    }
}
