/**
 * slotSyncEngine.js - Automated Slot & Role Synchronization Engine (Strict 2-Slot System)
 * Location: src/quest/slotSyncEngine.js
 */

import { getRoles } from './roleStore.js';

/**
 * Synchronizes a user's Discord roles and 2-slot access based on invites and boosts.
 * @param {GuildMember} member - The Discord guild member object.
 * @param {Client} client - The Discord client instance.
 * @param {number} userInvites - Number of valid invites made by the user
 */
export async function syncUserSlotsAndRoles(member, client, userInvites = 0) {
    try {
        if (!member || member.user?.bot || !member.guild) return;

        const guild = member.guild;
        const roles = getRoles(guild.id) || {};
        
        const isBooster = Boolean(member.premiumSince);

        // 1. Check conditions for our Strict 2-Slot System
        // Slot 1: Requires 2 Invites
        const hasSlot1Unlocked = userInvites >= 2;
        // Slot 2: Requires Server Boost (Locks Auto-Quest)
        const hasSlot2Unlocked = isBooster;

        // 2. AUTO-ASSIGN ROLES for Slot 1 and Slot 2
        const roleSlot1 = roles.ROLE_2_INVITES || roles.ROLE_SLOT_1;
        const roleSlot2 = roles.ROLE_1_BOOST || roles.ROLE_SLOT_2;

        // Assign Slot 1 Role if conditions met
        if (hasSlot1Unlocked && roleSlot1 && !member.roles.cache.has(roleSlot1)) {
            await member.roles.add(roleSlot1).catch(() => {});
        }

        // Assign Slot 2 Boost Role if conditions met
        if (hasSlot2Unlocked && roleSlot2 && !member.roles.cache.has(roleSlot2)) {
            await member.roles.add(roleSlot2).catch(() => {});
        }

        console.log(`⚡ [SlotSyncEngine] Successfully synced 2-Slot system for ${member.user.tag} (Invites: ${userInvites}, Booster: ${isBooster}).`);
    } catch (err) {
        console.error(`Error in syncUserSlotsAndRoles for ${member?.id}:`, err.message);
    }
}
