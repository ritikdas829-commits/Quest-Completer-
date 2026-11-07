/**
 * boostTracker.js - Precise Boost Role Management for Strict 2-Slot System
 * Location: src/handlers/boostTracker.js
 */

import { getRoles } from '../quest/roleStore.js';
import { getEmojis } from '../quest/emoji.js';

function getBoostRoles(guild) {
    try {
        const stored = getRoles(guild.id);
        const roles = {};
        if (stored?.ROLE_1_BOOST) {
            const r = guild.roles.cache.get(stored.ROLE_1_BOOST);
            if (r) roles.ROLE_1_BOOST = r;
        }
        return roles;
    } catch {
        return {};
    }
}

/**
 * Validates active server boost status for Slot #2 (Auto-Quest Gateway)
 */
function isUserBoosting(member) {
    try {
        if (!member) return false;
        return Boolean(member.premiumSince);
    } catch {
        return false;
    }
}

async function sendSafeDM(member, message) {
    try { 
        await member.send(message); 
    } catch {}
}

export async function handleBoostAdd(member) {
    if (!member || member.user.bot) return;
    try {
        const guild = member.guild;
        const boostRoles = getBoostRoles(guild);
        const boosting = isUserBoosting(member);
        const EMOJI = await getEmojis(guild.id || 'global');

        if (!boosting) {
            await handleBoostRemove(member);
            return;
        }

        // Grant Slot #2 Boost Role
        if (boostRoles.ROLE_1_BOOST) {
            if (!member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                await member.roles.add(boostRoles.ROLE_1_BOOST).catch(() => {});
                await sendSafeDM(member, `${EMOJI.success || '💎'} Thank you for boosting **${guild.name}**! **Slot #2 (Auto-Quest)** unlocked via **${boostRoles.ROLE_1_BOOST.name}**.`);
            }
        }

    } catch (err) {
        console.error(`Boost add error ${member.id}:`, err.message);
    }
}

export async function handleBoostRemove(member) {
    if (!member || member.user.bot) return;
    try {
        const guild = member.guild;
        const boostRoles = getBoostRoles(guild);
        const EMOJI = await getEmojis(guild.id || 'global');

        const isStillBoosting = isUserBoosting(member);

        if (!isStillBoosting) {
            if (boostRoles.ROLE_1_BOOST && member.roles.cache.has(boostRoles.ROLE_1_BOOST.id)) {
                await member.roles.remove(boostRoles.ROLE_1_BOOST.id).catch(() => {});
                await sendSafeDM(member, `${EMOJI.lock || '🔒'} Your boost expired on **${guild.name}**. Slot #2 Boost role has been automatically removed.`);
            }
        }

    } catch (err) {
        console.error(`Boost remove error ${member.id}:`, err.message);
    }
}

export async function handleBoostUpdate(oldMember, newMember) {
    if (!oldMember || !newMember || newMember.user.bot) return;
    try {
        const hadBoost = Boolean(oldMember.premiumSince);
        const hasBoost = Boolean(newMember.premiumSince);
        
        if (!hadBoost && hasBoost) {
            await handleBoostAdd(newMember);
        } else if (hadBoost && !hasBoost) {
            await handleBoostRemove(newMember);
        }
    } catch (err) {
        console.error("Boost update error:", err.message);
    }
}
