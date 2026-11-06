/**
 * slotSystem.js - Strict 2-Slot Unlock & Visibility System (Slot 1: 2 Invites | Slot 2: Boost)
 * Location: src/quest/slotSystem.js
 */

import { getRoles } from './roleStore.js';
import { getUserInvites } from '../handlers/inviteTracker.js';

export const SLOTS = {
    1: { label: 'Slot 1 (2 Invites)', need: '2 Invites', invites: 2, boosts: 0 },
    2: { label: 'Slot 2 (Server Boost)', need: 'Server Boost', invites: 0, boosts: 1 },
};

export async function getCounts(member) {
    try {
        if (!member || !member.guild) return { invites: 0, boosts: 0 };

        const guildId = member.guild.id;
        const userId = member.id;

        let invites = 0;
        try {
            invites = await getUserInvites(userId, guildId) || 0;
        } catch {
            invites = 0;
        }

        let boosts = 0;
        const roles = getRoles(guildId) || {};
        
        if (member.premiumSince) boosts = 1;
        if (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) boosts = 1;
        if (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST)) boosts = 2;

        return { invites, boosts };
    } catch (err) {
        return { invites: 0, boosts: 0 };
    }
}

export async function getProgressiveSlots(member) {
    try {
        if (!member) {
            return {
                slots: [ { slot: 1, ...SLOTS[1], can: false, reason: 'Requires 2 Invites' } ],
                invites: 0,
                boosts: 0,
                slotsToShow: 2,
                userProfile: null
            };
        }

        const guildId = member?.guild?.id || 'global';
        const roles = getRoles(guildId) || {};
        const { invites, boosts } = await getCounts(member);

        const userProfile = {
            id: member.user.id,
            username: member.user.username,
            avatar: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
            createdTimestamp: member.user.createdTimestamp
        };

        // Slot 1 Check: 2 Invites or Role
        const hasSlot1 = invites >= 2 || (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) || (roles.ROLE_SLOT_1 && member.roles.cache.has(roles.ROLE_SLOT_1));
        
        // Slot 2 Check: Server Boost or Role
        const hasSlot2 = boosts >= 1 || (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) || (roles.ROLE_SLOT_2 && member.roles.cache.has(roles.ROLE_SLOT_2));

        const slots = [
            { 
                slot: 1, 
                ...SLOTS[1], 
                can: hasSlot1, 
                reason: hasSlot1 ? 'Unlocked via 2 Invites' : 'Requires 2 Invites' 
            },
            { 
                slot: 2, 
                ...SLOTS[2], 
                can: hasSlot2, 
                reason: hasSlot2 ? 'Unlocked via Server Boost' : 'Requires Server Boost (Auto-Quest Locked)' 
            }
        ];

        return { 
            slots, 
            invites, 
            boosts, 
            slotsToShow: 2, 
            userProfile
        };

    } catch (err) {
        console.error("getProgressiveSlots error:", err.message);
        return { 
            slots: [ 
                { slot: 1, ...SLOTS[1], can: false, reason: 'Fallback Error' },
                { slot: 2, ...SLOTS[2], can: false, reason: 'Fallback Error' }
            ], 
            invites: 0, 
            boosts: 0, 
            slotsToShow: 2, 
            userProfile: null
        };
    }
}
