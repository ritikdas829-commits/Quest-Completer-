/**
 * premiumLink.js - Strict 2-Slot System Panel (Slot 1: 2 Invites | Slot 2: Server Boost)
 * Location: src/commands/premiumLink.js
 */

import {
    ContainerBuilder, TextDisplayBuilder, SectionBuilder, 
    ThumbnailBuilder, SeparatorBuilder, SeparatorSpacingSize, 
    ActionRowBuilder, ButtonBuilder, ButtonStyle,
    ModalBuilder, TextInputBuilder, TextInputStyle, 
    MessageFlags, SlashCommandBuilder,
} from 'discord.js';
import { getProgressiveSlots } from '../quest/slotSystem.js';
import { getEmojis } from '../quest/emoji.js';

const SUPPORT_SERVER = 'https://discord.gg/y5f29e5tQb';

function getClientPrefix(client, guildId) {
    try {
        if (client?.getPrefix) return client.getPrefix(guildId);
        if (client?.config?.prefix) return client.config.prefix;
        if (client?.prefix) return client.prefix;
    } catch {}
    return process.env.BOT_PREFIX || ';';
}

function getAccountAge(discordId) {
    try {
        if (!discordId) return 'N/A';
        const ts = Number((BigInt(discordId) >> 22n) + 1420070400000n);
        const days = Math.floor((Date.now() - ts) / 86400000);
        if (days < 30) return `${days} days ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months} months ago`;
        return `${Math.floor(months/12)} years ago`;
    } catch { return 'N/A'; }
}

export async function buildPremiumLinkPanel(guildId, ownerId, tokenStore, client, member = null) {
    const EMOJI = await getEmojis(guildId || 'global');
    const prefix = getClientPrefix(client, guildId);
    const guildMember = member || await client.guilds.cache.get(guildId)?.members.fetch(ownerId).catch(() => null);
    const { slots, invites, boosts, slotsToShow } = await getProgressiveSlots(guildMember);

    let accounts = await tokenStore.getAllSlots(guildId, ownerId);

    if (accounts.length > 0) {
        const activeAccounts = accounts.filter(a => a.isActive);
        if (activeAccounts.length === 0) {
            await tokenStore.setActiveSlot(guildId, ownerId, accounts[0].slot);
            accounts = await tokenStore.getAllSlots(guildId, ownerId);
        } else if (activeAccounts.length > 1) {
            await tokenStore.setActiveSlot(guildId, ownerId, activeAccounts[0].slot);
            accounts = await tokenStore.getAllSlots(guildId, ownerId);
        }
    }

    const c1 = new ContainerBuilder().setAccentColor(0x5865F2);
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_icon || '🔗'} 2-Slot Premium Token System`));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(
        `**Slot System Overview:**\n` +
        `• **Slot #1 (Invites):** Unlock by reaching **2 server invites**.\n` +
        `• **Slot #2 (Boosts):** Unlock by **Boosting the server** (Unlocks 24/7 Auto-Quest).\n\n` +
        `> **Invites:** \`${invites}\` | **Server Boost:** \`${boosts > 0 ? 'Active 🚀' : 'Inactive'}\``
    ));
    c1.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Support server: ${SUPPORT_SERVER}`));

    const c2 = new ContainerBuilder().setAccentColor(0x2B2D31);
    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${EMOJI.link_gear || '⚙️'} Slot Management`));

    for (let idx = 0; idx < slots.length; idx++) {
        const slotData = slots[idx];
        const slotNum = slotData.slot;
        const linked = accounts.find(a => a.slot === slotNum);

        if (!linked) {
            if (slotData.can) {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### Slot #${slotNum} — ${slotData.label}\n` +
                    `• **User:** Not Linked\n` +
                    `• **Status:** Not Active\n` +
                    `• **Requirement:** ${slotData.need} — ${EMOJI.link_success || '✅'} Unlocked\n` +
                    `• **Status:** Ready to link token`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${slotNum}`).setLabel(`Link Slot #${slotNum}`).setStyle(ButtonStyle.Success).setEmoji('🔗')
                ));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                    `### Slot #${slotNum} — ${slotData.label} ${EMOJI.link_lock || '🔒'}\n` +
                    `• **Status:** Locked\n` +
                    `• **Requirement:** ${slotData.need}\n` +
                    `• **Note:** ${slotData.reason}`
                ));
                c2.addActionRowComponents(new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`link_slot_${slotNum}`).setLabel(`Link Slot #${slotNum} (Locked)`).setStyle(ButtonStyle.Secondary).setEmoji('🔒')
                ));
            }
        } else {
            const isCurrentlyActive = Boolean(linked.isActive);
            const status = isCurrentlyActive ? `Active ${EMOJI.link_success || '✅'}` : 'Stored';
            const age = getAccountAge(linked.linkedUserId);
            const linkedAt = linked.linkedAt ? new Date(linked.linkedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'N/A';
            const avatarUrl = linked.avatar ? `https://cdn.discordapp.com/avatars/${linked.linkedUserId}/${linked.avatar}.png?size=128` : null;
            
            const content = 
                `### Slot #${slotNum} — ${slotData.label}\n` +
                `• **User:** ${linked.username} (\`${linked.linkedUserId || 'N/A'}\`)\n` +
                `• **Status:** ${status}\n` +
                `• **Account Age:** ${age}\n` +
                `• **Linked At:** ${linkedAt}`;
            
            if (avatarUrl) {
                c2.addSectionComponents(new SectionBuilder().addTextDisplayComponents(new TextDisplayBuilder().setContent(content)).setThumbnailAccessory(new ThumbnailBuilder().setURL(avatarUrl)));
            } else {
                c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(content));
            }
            
            const row = new ActionRowBuilder();
            row.addComponents(new ButtonBuilder().setCustomId(`unlink_slot_${slotNum}`).setLabel(`Unlink Slot #${slotNum}`).setStyle(ButtonStyle.Danger));
            if (!isCurrentlyActive) {
                row.addComponents(new ButtonBuilder().setCustomId(`select_slot_${slotNum}`).setLabel(`Activate Slot #${slotNum}`).setStyle(ButtonStyle.Primary));
            }
            c2.addActionRowComponents(row);
        }

        if (idx < slots.length - 1) {
            c2.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        }
    }

    c2.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# Use \`${prefix}quest\` to run active slot, or \`${prefix}autoquest\` for background boost runs.`));
    return { components: [c1, c2], flags: MessageFlags.IsComponentsV2 };
}

export function buildLinkModal(slot) {
    const slotLabel = slot === 1 ? 'Slot #1 (2 Invites)' : 'Slot #2 (Server Boost)';
    const m = new ModalBuilder().setCustomId(`link_modal_slot_${slot}`).setTitle(`Link ${slotLabel}`);
    m.addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder().setCustomId('token_input').setLabel('Discord Token').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder(`Paste Discord token for Slot #${slot}...`).setMinLength(10).setMaxLength(400)
    ));
    return m;
}

const linkData = new SlashCommandBuilder().setName('link').setDescription('Open 2-Slot Premium Token Panel');
const unlinkData = new SlashCommandBuilder().setName('unlink').setDescription('Unlink a slot').addIntegerOption(o=>o.setName('slot').setDescription('Slot number (1 or 2)').setRequired(true).setMinValue(1).setMaxValue(2));

export const linkCmd = {
    data: linkData,
    prefix: 'link',
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
            const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client, interaction.member);
            await interaction.editReply(panel).catch(async () => {
                await interaction.followUp(panel).catch(() => {});
            });
        } catch (err) {
            console.error('[Link Execution Error]:', err.message);
        }
    },
    async prefixExecute(message, _args, client) {
        try {
            const panel = await buildPremiumLinkPanel(message.guild.id, message.author.id, client.tokenStore, client, message.member);
            await message.reply(panel).catch(() => {});
        } catch (err) {
            console.error('[Link Prefix Execution Error]:', err.message);
            await message.reply('❌ An error occurred while opening the panel.').catch(() => {});
        }
    }
};

export const unlinkCmd = {
    data: unlinkData,
    prefix: 'unlink',
    async execute(interaction, client) {
        try {
            if (!interaction.deferred && !interaction.replied) {
                await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 }).catch(() => {});
            }
            const slot = interaction.options.getInteger('slot');
            await client.tokenStore.removeSlot(interaction.guild.id, interaction.user.id, slot);
            const panel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client, interaction.member);
            await interaction.editReply(panel);
        } catch (err) {
            console.error('[Unlink Execution Error]:', err.message);
        }
    },
    async prefixExecute(message, args, client) {
        try {
            const EMOJI = await getEmojis(message.guild.id);
            const prefix = getClientPrefix(client, message.guild.id);
            const slot = parseInt(args[0]); 
            if (!slot || slot < 1 || slot > 2) return message.reply(`${EMOJI.link_error || '❌'} Correct usage: \`${prefix}unlink 1\` or \`${prefix}unlink 2\``);
            await client.tokenStore.removeSlot(message.guild.id, message.author.id, slot);
            const panel = await buildPremiumLinkPanel(message.guild.id, message.author.id, client.tokenStore, client, message.member);
            await message.reply(panel);
        } catch (err) {
            console.error('[Unlink Prefix Error]:', err.message);
        }
    }
};

export async function handleButton(interaction, client) {
    const guildId = interaction.guild.id;
    const ownerId = interaction.user.id;
    const member = interaction.member;
    const EMOJI = await getEmojis(guildId);
    const rawId = interaction.customId;

    if (rawId.startsWith('link_slot_')) {
        const slotNum = parseInt(rawId.split('_')[2]);
        const prog = await getProgressiveSlots(member);
        const slotData = prog.slots.find(s => s.slot === slotNum);
        if (!slotData?.can) {
            const c = new ContainerBuilder().setAccentColor(0xED4245);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ${EMOJI.link_lock || '🔒'} Slot #${slotNum} Locked\n\n` +
                `Aap is slot ko link nahi kar sakte kyunki iski requirement poori nahi hai!\n` +
                `• **Required:** ${slotData?.need}\n` +
                `• **Reason:** ${slotData?.reason}`
            ));
            const payload = { components: [c], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral };
            if (interaction.deferred || interaction.replied) {
                return await interaction.followUp(payload);
            }
            return await interaction.reply(payload);
        }
        if (interaction.deferred || interaction.replied) return;
        return await interaction.showModal(buildLinkModal(slotNum));
    }

    if (rawId.startsWith('unlink_slot_')) {
        const slotToUnlink = parseInt(rawId.split('_')[2]);
        await client.tokenStore.removeSlot(guildId, ownerId, slotToUnlink);
        const panel = await buildPremiumLinkPanel(guildId, ownerId, client.tokenStore, client, member);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }

    if (rawId.startsWith('select_slot_')) {
        const slotToSelect = parseInt(rawId.split('_')[2]);
        await client.tokenStore.setActiveSlot(guildId, ownerId, slotToSelect);
        const panel = await buildPremiumLinkPanel(guildId, ownerId, client.tokenStore, client, member);
        if (interaction.deferred || interaction.replied) {
            return await interaction.editReply(panel);
        }
        return await interaction.update(panel);
    }
}

export async function handleModal(interaction, client) {
    if (!interaction.customId.startsWith('link_modal_slot_')) return;
    const slot = parseInt(interaction.customId.split('_')[3]);
    const rawToken = interaction.fields.getTextInputValue('token_input');
    const token = rawToken.trim().replace(/^['"]+|['"]+$/g, '').replace(/\s+/g, '');
    const prefix = getClientPrefix(client, interaction.guild.id);
    const EMOJI = await getEmojis(interaction.guild.id);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    try {
        const prog = await getProgressiveSlots(interaction.member);
        const slotData = prog.slots.find(s => s.slot === slot);
        if (!slotData?.can) throw new Error(`Slot #${slot} is locked! ${slotData?.reason}`);
        const res = await fetch('https://discord.com/api/v10/users/@me', { headers: { Authorization: token } });
        if (!res.ok) throw new Error('Invalid token provided - Discord rejected request');
        const data = await res.json();
        await client.tokenStore.saveSlot({
            guildId: interaction.guild.id, ownerId: interaction.user.id, slot, token,
            linkedUserId: data.id, username: data.username, avatar: data.avatar, linkedAt: new Date()
        });
        await client.tokenStore.setActiveSlot(interaction.guild.id, interaction.user.id, slot);
        if (interaction.message) {
            const updatedPanel = await buildPremiumLinkPanel(interaction.guild.id, interaction.user.id, client.tokenStore, client, interaction.member);
            await interaction.message.edit(updatedPanel).catch(() => {});
        }
        const successContainer = new ContainerBuilder().setAccentColor(0x57F287);
        successContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ${EMOJI.link_success || '✅'} Slot #${slot} Linked!\nLinked as **"${data.username}"**.\n\nYou can now use \`${prefix}quest\` and manage your 2 slots.`
        ));
        await interaction.editReply({ components: [successContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    } catch (e) {
        const errContainer = new ContainerBuilder().setAccentColor(0xED4245);
        errContainer.addTextDisplayComponents(new TextDisplayBuilder().setContent(`# ${EMOJI.link_error || '❌'} Slot #${slot} Failed\n${e.message}`));
        await interaction.editReply({ components: [errContainer], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral });
    }
}
