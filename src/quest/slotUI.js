/**
 * slotUI.js - Strict 2-Slot System UI with Clickable Locked Buttons & Error Popups
 * Location: src/quest/slotUI.js
 */

import {
    ContainerBuilder,
    TextDisplayBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { getEmojis } from './emoji.js';
import { getRoles } from './roleStore.js';

const DEFAULT_PREFIX = process.env.PREFIX || process.env.BOT_PREFIX || ';';
const SUPPORT_SERVER = 'https://discord.gg/y5f29e5tQb';

function getAccountAge(discordId) {
    try {
        if (!discordId) return 'N/A';
        const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n);
        const days = Math.floor((Date.now() - ts) / 86400000);
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        return `${Math.floor(months / 12)} years ago`;
    } catch { return 'N/A'; }
}

export function buildLinkModal(slotNumber = 1) {
    const slotLabel = slotNumber === 1 ? 'Slot #1 (2 Invites)' : 'Slot #2 (Server Boost)';
    const modal = new ModalBuilder().setCustomId(`link_modal_slot_${slotNumber}`).setTitle(`Link ${slotLabel}`);
    modal.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
            .setCustomId('token_input')
            .setLabel('Discord User Token')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder(`Paste Discord token for Slot #${slotNumber}...`)
            .setRequired(true)
    ));
    return modal;
}

async function checkMemberSlotEligibility(member, inviteStore) {
    const guildId = member.guild?.id;
    const roles = getRoles(guildId || 'global');

    let userInvites = 0;
    try {
        if (inviteStore && typeof inviteStore.getUserInvites === 'function') {
            userInvites = await inviteStore.getUserInvites(guildId, member.id);
        }
    } catch {}

    const hasInviteRole = (roles.ROLE_2_INVITES && member.roles.cache.has(roles.ROLE_2_INVITES)) ||
                           (roles.ROLE_5_INVITES && member.roles.cache.has(roles.ROLE_5_INVITES));
    const isSlot1Unlocked = userInvites >= 2 || hasInviteRole;

    const isBooster = Boolean(member.premiumSince) || 
                      (roles.ROLE_1_BOOST && member.roles.cache.has(roles.ROLE_1_BOOST)) ||
                      (roles.ROLE_2_BOOST && member.roles.cache.has(roles.ROLE_2_BOOST));
    const isSlot2Unlocked = isBooster;

    return {
        userInvites,
        isBooster,
        slots: [
            {
                slot: 1,
                label: 'Invite Slot',
                need: '2 Invites',
                can: isSlot1Unlocked,
                reason: isSlot1Unlocked ? 'Requirement Met' : 'Requires 2 server invites or role'
            },
            {
                slot: 2,
                label: 'Boost Slot (Auto-Quest)',
                need: 'Server Boost',
                can: isSlot2Unlocked,
                reason: isSlot2Unlocked ? 'Requirement Met' : 'Requires Server Boost to unlock'
            }
        ]
    };
}

export async function buildSlotPanel(member, inviteStore, tokenStore) {
    const guildId = member.guild?.id;
    const userId = member.id || member.user?.id;
    const EMOJI = await getEmojis(guildId || 'global');

    const eligibility = await checkMemberSlotEligibility(member, inviteStore);
    const { slots, userInvites, isBooster } = eligibility;

    let accounts = [];
    try {
        const res = tokenStore && typeof tokenStore.getAllSlots === 'function' ? await tokenStore.getAllSlots(guildId, userId) : [];
        accounts = Array.isArray(res) ? res : Object.values(res || {});
    } catch {
        accounts = [];
    }

    if (accounts.length > 0) {
        const activeAccounts = accounts.filter(a => a.isActive);
        if (activeAccounts.length !== 1) {
            const targetActiveSlot = activeAccounts.length > 0 ? activeAccounts[0].slot : accounts[0].slot;
            if (tokenStore && typeof tokenStore.setActiveSlot === 'function') {
                await tokenStore.setActiveSlot(guildId, userId, targetActiveSlot);
                const res = await tokenStore.getAllSlots(guildId, userId);
                accounts = Array.isArray(res) ? res : Object.values(res || {});
            }
        }
    }

    // Container 1: Header
    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_icon || EMOJI.slot_icon || '🔗'} 2-Slot Premium Token System`));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Slot System Overview:**\n` +
        `• **Slot #1 (Invites):** Unlock by reaching **2 server invites**.\n` +
        `• **Slot #2 (Boosts):** Unlock by **Boosting the server** (Unlocks 24/7 Background Auto-Quest).\n\n` +
        `> **Invites:** \`${userInvites}\` | **Server Boost:** \`${isBooster ? 'Active 🚀' : 'Inactive'}\``
    ));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Support server: ${SUPPORT_SERVER}`));

    // Container 2: Slots Management
    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.link_gear || EMOJI.slot_gear || '⚙️'} Slot Management`));

    for (let idx = 0; idx < slots.length; idx++) {
        const s = slots[idx];
        const linked = accounts.find(a => a.slot === s.slot);

        if (!linked) {
            if (s.can) {
                // Unlocked & Ready
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### Slot #${s.slot} — ${s.label}\n` +
                    `• **User:** Not Linked\n` +
                    `• **Requirement:** ${s.need} — ${EMOJI.link_success || EMOJI.slot_success || '✅'} Unlocked\n` +
                    `• **Status:** Ready to link token`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${s.slot}`).setLabel(`Link Slot #${s.slot}`).setStyle(ButtonStyle.Success).setEmoji('🔗')
                ));
            } else {
                // Locked Slot (Button enabled but shows error on click)[span_0](start_span)[span_0](end_span)
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### Slot #${s.slot} — ${s.label} ${EMOJI.link_lock || EMOJI.slot_lock || '🔒'}\n` +
                    `• **Status:** Locked\n` +
                    `• **Requirement:** ${s.need}\n` +
                    `• **Note:** ${s.reason}`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${s.slot}`).setLabel(`Link Slot #${s.slot} (Locked)`).setStyle(ButtonStyle.Secondary).setEmoji('🔒')
                ));
            }
        } else {
            // Linked Slot State
            const isCurrentlyActive = Boolean(linked.isActive);
            const status = isCurrentlyActive ? `Active ${EMOJI.link_success || EMOJI.slot_success || '✅'}` : 'Stored';
            const age = getAccountAge(linked.linkedUserId);
            const linkedAtStr = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
            const avatarUrl = linked.avatar ? `https://cdn.discordapp.com/avatars/${linked.linkedUserId}/${linked.avatar}.png?size=128` : null;

            const content = 
                `### Slot #${s.slot} — ${s.label}\n` +
                `• **User:** ${linked.username || 'Linked Account'} (\`${linked.linkedUserId || 'N/A'}\`)\n` +
                `• **Status:** ${status}\n` +
                `• **Account Age:** ${age}\n` +
                `• **Linked At:** ${linkedAtStr}`;

            if (avatarUrl) {
                c2.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            }

            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${s.slot}`).setLabel(`Unlink Slot #${s.slot}`).setStyle(ButtonStyle.Danger));
            if (!isCurrentlyActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${s.slot}`).setLabel(`Activate Slot #${s.slot}`).setStyle(ButtonStyle.Primary));
            }
            c2.addActionRowComponents(row);
        }

        if (idx < slots.length - 1) {
            c2.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        }
    }

    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Use \`${DEFAULT_PREFIX}quest\` to run active slot, or \`${DEFAULT_PREFIX}autoquest\` for background boost runs.`));

    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}

export async function handleButton(interaction, client) {
    const guildId = interaction.guild.id; 
    const ownerId = interaction.user.id; 
    const member = interaction.member;
    const EMOJI = await getEmojis(guildId);
    const rawId = interaction.customId;

    if (rawId.startsWith('link_slot_')) {
        const slotNum = parseInt(rawId.split('_')[2]);
        const eligibility = await checkMemberSlotEligibility(member, client.inviteStore);
        const slotData = eligibility.slots.find(s => s.slot === slotNum);

        // Agar slot unlocked nahi hai toh modal open karne ke bajay error show karega[span_1](start_span)[span_1](end_span)
        if (!slotData?.can) {
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ${EMOJI.link_lock || EMOJI.slot_lock || '🔒'} Slot #${slotNum} Locked\n\n` +
                `Aap is slot ko link nahi kar sakte kyunki iski requirement poori nahi hai!\n` +
                `• **Required:** ${slotData?.need}\n` +
                `• **Reason:** ${slotData?.reason}`
            ));
            if (interaction.deferred || interaction.replied) {
                return await interaction.followUp({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
            }
            return await interaction.reply({ components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
        }

        if (interaction.deferred || interaction.replied) return;
        return await interaction.showModal(buildLinkModal(slotNum));
    }

    if (rawId.startsWith('unlink_slot_')) {
        const slot = parseInt(rawId.split('_')[2]);
        await client.tokenStore.removeSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, client.inviteStore, client.tokenStore);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }

    if (rawId.startsWith('select_slot_')) {
        const slot = parseInt(rawId.split('_')[2]);
        await client.tokenStore.setActiveSlot(guildId, ownerId, slot);
        const panel = await buildSlotPanel(member, client.inviteStore, client.tokenStore);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }
}

export async function handleModal(interaction, client) {
    if (!interaction.customId.startsWith('link_modal_slot_')) return;
    const slot = parseInt(interaction.customId.split('_')[3]);
    const token = interaction.fields.getTextInputValue('token_input').trim();
    const guildId = interaction.guild.id;
    const EMOJI = await getEmojis(guildId);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const eligibility = await checkMemberSlotEligibility(interaction.member, client.inviteStore);
        const slotData = eligibility.slots.find(s => s.slot === slot);
        if (!slotData?.can) throw new Error(`Slot #${slot} locked. ${slotData?.reason}`);

        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        if (!res.ok) throw new Error('Invalid Discord Token provided');
        const data = await res.json();

        await client.tokenStore.saveSlot({ 
            guildId: interaction.guild.id, 
            ownerId: interaction.user.id, 
            slot, 
            token, 
            linkedUserId: data.id, 
            username: data.username, 
            avatar: data.avatar, 
            linkedAt: new Date() 
        });

        await client.tokenStore.setActiveSlot(interaction.guild.id, interaction.user.id, slot);
        if (interaction.message) {
            const panel = await buildSlotPanel(interaction.member, client.inviteStore, client.tokenStore);
            await interaction.message.edit(panel).catch(() => {});
        }

        const successContainer = new ContainerBuilder().setAccentColor(0x57F287);
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.link_success || EMOJI.slot_success || '✅'} Slot #${slot} Linked!\nLinked as **"${data.username}"**.`
        ));
        await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (e) {
        const errContainer = new ContainerBuilder().setAccentColor(0xED4245);
        errContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_error || EMOJI.slot_error || '❌'} Failed to Link\n${e.message}`));
        await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
