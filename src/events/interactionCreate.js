/**
 * interactionCreate.js — Complete Interaction Handler without missing dependencies
 * Location: src/events/interactionCreate.js
 */

import { handleGuideButtons } from '../commands/guide.js';
import { handleButton as handlePremiumButton, handleModal as handlePremiumModal } from '../commands/premiumLink.js';
import { buildQuestSolverPanel } from '../quest/questUI.js';
import { buildHelpPanel } from '../commands/help.js';
import { QuestClient } from '../quest/questClient.js';
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, StringSelectMenuOptionBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, MessageFlags } from 'discord.js';
import { getEmojis } from '../quest/emoji.js';
import { checkActivityCooldown } from '../quest/suspiciousActivity.js';

const activeRunners = new Map();
const panelOwners = new Map(); // messageId -> userId

export function setPanelOwner(messageId, userId) {
    if (messageId && userId) {
        panelOwners.set(messageId, userId);
    }
}

async function buildTokenDashboardContent(client, guildId, userId) {
    const EMOJI = await getEmojis(guildId);
    const accounts = await client.tokenStore.getAllSlots(guildId, userId);
    const activeSlot = await client.tokenStore.getActiveSlot(guildId, userId);
    
    const embed = new EmbedBuilder();
    const components = [];

    if (!accounts || accounts.length === 0) {
        embed.setColor(0xED4245)
             .setTitle(`${EMOJI.event_warn || '❌'} No Tokens Linked`)
             .setDescription('No accounts linked yet. Please use the `?link` command to add a token.');
        return { embeds: [embed], components: [], flags: 64 };
    }

    embed.setColor(0x5865F2)
         .setTitle(`${EMOJI.event_list || '📊'} Token Status Dashboard & Control Panel`)
         .setDescription('Use the buttons below to select your active slot.');

    const menuOptions = [];
    for (const acc of accounts) {
        const isActive = activeSlot?.slot === acc.slot;
        const statusIcon = isActive ? (EMOJI.event_online || '🟢') : (EMOJI.event_dot || '⚪');
        
        embed.addFields({
            name: `Slot #${acc.slot} — ${acc.username || 'Linked Account'}`,
            value: `• **Status:** ${statusIcon} ${isActive ? 'Active' : 'Stored'}\n• **User ID:** \`${acc.linkedUserId || 'N/A'}\``,
            inline: false
        });

        menuOptions.push(
            new StringSelectMenuOptionBuilder()
                .setLabel(`Slot #${acc.slot}: ${acc.username || 'Account'}`)
                .setValue(`tokensys_select_${acc.slot}`)
                .setDescription(isActive ? 'Currently Active Slot' : 'Switch to this slot')
                .setDefault(isActive)
        );
    }

    if (menuOptions.length > 0) {
        components.push(
            new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('tokensys_slot_select')
                    .setPlaceholder('Select active account slot...')
                    .addOptions(menuOptions)
            )
        );
    }

    return { embeds: [embed], components, flags: 64 };
}

export default {
    name: 'interactionCreate',
    once: false,
    async execute(interaction, client) {
        try {
            const guildId = interaction.guildId || 'global';
            const userId = interaction.user?.id;
            const EMOJI = await getEmojis(guildId);

            // 1. SECURITY COOLDOWN CHECK
            const cooldown = checkActivityCooldown(userId);
            if (cooldown.active) {
                return interaction.reply({
                    content: `### ${EMOJI.event_error || '❌'} Security Cooldown Active\n` +
                             `\`\`\`prolog\n` +
                             `[SECURITY] Account temporarily locked due to activity safety.\n` +
                             `[STATUS] Cooldown remaining: ~${cooldown.remaining} hours.\n` +
                             `\`\`\``,
                    flags: 64
                }).catch(() => {});
            }

            // 2. STRICT UI OWNERSHIP LOCK
            if ((interaction.isButton() || interaction.isStringSelectMenu()) && interaction.message) {
                const messageId = interaction.message.id;
                if (panelOwners.has(messageId)) {
                    const ownerId = panelOwners.get(messageId);
                    if (userId !== ownerId) {
                        return interaction.reply({
                            content: `❌ **This UI Is Not Yours!**`,
                            flags: MessageFlags.Ephemeral
                        }).catch(() => {});
                    }
                }
            }

            // 3. Guide Buttons Handler
            if (interaction.isButton() && ['btn_pc', 'btn_android', 'btn_ios'].includes(interaction.customId)) {
                await handleGuideButtons(interaction);
                return;
            }

            // 4. Premium Slot Buttons Handler
            if (interaction.isButton() && (
                interaction.customId.startsWith('link_slot_') ||
                interaction.customId.startsWith('unlink_slot_') ||
                interaction.customId.startsWith('select_slot_')
            )) {
                await handlePremiumButton(interaction, client);
                return;
            }

            // 5. Link Prompt Button
            if (interaction.isButton() && interaction.customId === 'link_prompt') {
                await interaction.reply({ content: `${EMOJI.event_link || '🔗'} Please use the link command.`, flags: 64 }).catch(() => {});
                return;
            }

            // 6. Help Dropdown Menu Handler
            if (interaction.isStringSelectMenu() && interaction.customId === 'help_category_select') {
                await interaction.deferUpdate();
                const val = interaction.values[0];
                let cat = 'main';
                if (val === 'help_cat_quest') cat = 'quest';
                else if (val === 'help_cat_slots') cat = 'slots';
                else if (val === 'help_cat_utility') cat = 'utility';

                const updatedHelpPanel = await buildHelpPanel(interaction.user, client, guildId, cat);
                const replyMsg = await interaction.editReply(updatedHelpPanel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                return;
            }

            // 7. Token Dashboard Slot Select
            if (interaction.isStringSelectMenu() && interaction.customId === 'tokensys_slot_select') {
                await interaction.deferUpdate();
                const selectedValue = interaction.values[0];
                const slotNum = parseInt(selectedValue.replace('tokensys_select_', ''));
                
                await client.tokenStore.setActiveSlot(guildId, userId, slotNum);
                const updatedPanel = await buildTokenDashboardContent(client, guildId, userId);
                const replyMsg = await interaction.editReply(updatedPanel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                return;
            }

            // 8. Modals Handler
            if (interaction.isModalSubmit()) {
                if (interaction.customId === 'linkid-modal') {
                    await interaction.deferReply({ flags: 64 });
                    const token = interaction.fields.getTextInputValue('discord_token_input');
                    let userData = null;

                    try {
                        const res = await fetch('https://discord.com/api/v9/users/@me', {
                            headers: { Authorization: token }
                        });

                        if (!res.ok) {
                            const errorEmbed = new EmbedBuilder()
                                .setColor(0xED4245)
                                .setTitle(`${EMOJI.event_error || '❌'} Invalid Token`)
                                .setDescription('The token you provided was rejected by Discord.');
                            return await interaction.editReply({ embeds: [errorEmbed] });
                        }

                        userData = await res.json();
                    } catch (err) {
                        const errorEmbed = new EmbedBuilder()
                            .setColor(0xED4245)
                            .setTitle(`${EMOJI.event_error || '❌'} Connection Error`);
                        return await interaction.editReply({ embeds: [errorEmbed] });
                    }

                    await client.tokenStore.saveSlot({
                        guildId: guildId || 'global',
                        ownerId: userId,
                        slot: 1,
                        token: token,
                        username: userData.username,
                        linkedUserId: userData.id,
                        avatar: userData.avatar,
                        isActive: true
                    });

                    const successEmbed = new EmbedBuilder()
                        .setColor(0x57F287)
                        .setTitle(`${EMOJI.event_success || '✅'} Successfully Linked!`)
                        .setDescription(`Linked successfully as **${userData.username}**.`);

                    const replyMsg = await interaction.editReply({ embeds: [successEmbed] });
                    if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                    return;
                }

                if (interaction.customId.startsWith('link_modal_slot_')) {
                    await handlePremiumModal(interaction, client);
                    return;
                }
            }

            // 9. Quest Select Menu Handler
            if (interaction.isStringSelectMenu() && (interaction.customId === 'quest_select' || interaction.customId.startsWith('quest_select_'))) {
                await interaction.deferUpdate();
                const selectedQuestId = interaction.values[0];
                const panel = await buildQuestSolverPanel(client, guildId, userId, selectedQuestId);
                const replyMsg = await interaction.editReply(panel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                return;
            }

            // 10. Refresh Button Handler
            if (interaction.isButton() && interaction.customId === 'quest_refresh') {
                await interaction.deferUpdate();
                let currentQuestId = null;
                try {
                    const row = interaction.message.components.find(r => r.components?.some(c => c.customId === 'quest_select'));
                    const menu = row?.components?.find(c => c.customId === 'quest_select');
                    if (menu?.options) {
                        const defaultOpt = menu.options.find(o => o.default);
                        if (defaultOpt) currentQuestId = defaultOpt.value;
                    }
                } catch {}

                const panel = await buildQuestSolverPanel(client, guildId, userId, currentQuestId);
                const replyMsg = await interaction.editReply(panel);
                if (replyMsg?.id) setPanelOwner(replyMsg.id, userId);
                return;
            }

            // 11. Start Button Handler
            if (interaction.isButton() && interaction.customId.startsWith('quest_start_')) {
                await interaction.deferUpdate();
                const questId = interaction.customId.replace('quest_start_', '');
                const runnerKey = `${guildId}_${userId}`;

                const tokenStore = client.tokenStore;
                const active = await tokenStore.getActiveSlot(guildId, userId);
                const token = active ? (active.token || await tokenStore.get(guildId, userId, active.slot)) : null;

                if (!active || !token) {
                    await interaction.followUp({ content: `${EMOJI.event_error || '❌'} No active token slot found! Use \`/link\` first.`, flags: 64 });
                    return;
                }

                const cleanToken = typeof token === 'string' ? token.trim().replace(/['"]+/g, '') : token;
                const qc = new QuestClient(cleanToken);

                let manager;
                try {
                    manager = await qc.fetchQuests();
                } catch (err) {
                    const errorPanel = await buildQuestSolverPanel(client, guildId, userId, questId, `${EMOJI.event_error || '❌'} Fetch Error: ${err.message}`);
                    const errorMsg = await interaction.editReply(errorPanel);
                    if (errorMsg?.id) setPanelOwner(errorMsg.id, userId);
                    return;
                }

                const quest = manager.get(questId);
                if (!quest) {
                    const missingPanel = await buildQuestSolverPanel(client, guildId, userId, questId, `${EMOJI.event_error || '❌'} Quest not found or expired.`);
                    const missingMsg = await interaction.editReply(missingPanel);
                    if (missingMsg?.id) setPanelOwner(missingMsg.id, userId);
                    return;
                }

                const questName = quest.config?.messages?.quest_name || 'Discord Quest';

                const initPanel = await buildQuestSolverPanel(client, guildId, userId, questId, `Quest initialized...`);
                const initMsg = await interaction.editReply(initPanel);
                if (initMsg?.id) setPanelOwner(initMsg.id, userId);

                manager.doingQuest(quest, async (msg) => {
                    console.log(`[Quest Runner Log] ${msg}`);
                }).then(async (success) => {
                    try {
                        await manager.claimRewards(console.log, quest.id);
                    } catch {}

                    const completePanel = await buildQuestSolverPanel(client, guildId, userId, questId, success ? 'Completed!' : 'Finished.');
                    await interaction.editReply(completePanel).catch(() => {});
                }).catch((err) => {
                    console.error('Quest execution error:', err);
                });

                return;
            }

            // 12. Slash Commands Handler
            if (interaction.isChatInputCommand()) {
                const command = client.commands.get(interaction.commandName);
                if (!command) return;
                await command.execute(interaction, client);
            }
        } catch (err) {
            console.error('❌ Interaction Error:', err);
        }
    },
};
