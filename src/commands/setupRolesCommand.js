/**
 * setupRolesCommand.js - Clean 2-Slot System Roles Configuration
 * Location: src/commands/setupRolesCommand.js
 */

import { SlashCommandBuilder, PermissionFlagsBits, ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { getRolesAsync, setRole, removeRole, syncRolesFromDB } from '../quest/roleStore.js';

export const data = new SlashCommandBuilder()
    .setName('setuproles')
    .setDescription('Setup 2-Slot system roles (2 Invites & Server Boost) for your server')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub =>
        sub.setName('set')
            .setDescription('Set a role for Slot 1 (Invites) or Slot 2 (Boost)')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Select slot role tier')
                    .setRequired(true)
                    .addChoices(
                        { name: '📩 Slot 1 — 2 Invites Role', value: 'ROLE_2_INVITES' },
                        { name: '🚀 Slot 2 — Server Boost Role (Auto-Quest)', value: 'ROLE_1_BOOST' },
                    )
            )
            .addRoleOption(opt =>
                opt.setName('role')
                    .setDescription('Select the Discord role for this slot tier')
                    .setRequired(true)
            )
    )
    .addSubcommand(sub =>
        sub.setName('remove')
            .setDescription('Remove a role assignment from a slot tier')
            .addStringOption(opt =>
                opt.setName('key')
                    .setDescription('Select slot tier to clear')
                    .setRequired(true)
                    .addChoices(
                        { name: '📩 Slot 1 — 2 Invites Role', value: 'ROLE_2_INVITES' },
                        { name: '🚀 Slot 2 — Server Boost Role', value: 'ROLE_1_BOOST' },
                    )
            )
    )
    .addSubcommand(sub =>
        sub.setName('view')
            .setDescription('View current 2-Slot roles configuration')
    )
    .addSubcommand(sub =>
        sub.setName('sync')
            .setDescription('Sync and reload roles from MongoDB database')
    );

export async function execute(interaction) {
    try {
        const guildId = interaction.guild.id;
        const sub = interaction.options.getSubcommand();

        if (sub === 'view') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const roles = await getRolesAsync(guildId);
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ⚙️ 2-Slot System Roles Configuration\n` +
                `**Server:** \`${interaction.guild.name}\` | **ID:** \`${guildId}\`\n\n` +
                `### 📩 Slot 1 (Invite Tier)\n` +
                `• **Slot 1 Role (2 Invites):** ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}>` : '`❌ Not Set`'}\n\n` +
                `### 🚀 Slot 2 (Server Boost Tier)\n` +
                `• **Slot 2 Role (Server Boost):** ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}>` : '`❌ Not Set`'}\n\n` +
                `-# Use \`/setuproles set\` to assign roles directly from your Discord App.`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'set') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const key = interaction.options.getString('key');
            const role = interaction.options.getRole('role');
            await setRole(guildId, key, role.id);
            const c = new ContainerBuilder().setAccentColor(0x57F287);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# ✅ Slot Role Configured\n` +
                `• **Slot Key:** \`${key}\`\n` +
                `• **Assigned Role:** ${role}\n` +
                `• **Target Server:** \`${interaction.guild.name}\`\n\n` +
                `Users who unlock this requirement will automatically gain slot permissions!`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'remove') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            const key = interaction.options.getString('key');
            await removeRole(guildId, key);
            const c = new ContainerBuilder().setAccentColor(0xED4245); // Fixed typo here
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🗑️ Slot Role Removed\n` +
                `• **Cleared Key:** \`${key}\`\n\n` +
                `The role binding for this slot tier has been cleared successfully.`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

        if (sub === 'sync') {
            await interaction.deferReply({ flags: MessageFlags.IsComponentsV2 });
            await syncRolesFromDB();
            const c = new ContainerBuilder().setAccentColor(0x5865F2);
            c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
                `# 🔄 Database Synchronization\n` +
                `Successfully synced 2-slot role settings from **MongoDB**!`
            ));
            await interaction.editReply({ components: [c], flags: MessageFlags.IsComponentsV2 });
            return;
        }

    } catch (err) {
        console.error("setupRolesCommand error:", err.message);
    }
}

export const setupRolesCmd = {
    data,
    execute,
    prefix: 'setuproles',
    async prefixExecute(message) {
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) return;
        const guildId = message.guild.id;
        const roles = await getRolesAsync(guildId);
        const c = new ContainerBuilder().setAccentColor(0x5865F2);
        c.addTextDisplayComponents(new TextDisplayBuilder().setContent(
            `# ⚙️ 2-Slot System Roles Configuration\n` +
            `**Server:** \`${message.guild.name}\`\n\n` +
            `### 📩 Slot 1 (Invite Tier)\n` +
            `• **Slot 1 Role (2 Invites):** ${roles.ROLE_2_INVITES ? `<@&${roles.ROLE_2_INVITES}>` : '`❌ Not Set`'}\n\n` +
            `### 🚀 Slot 2 (Server Boost Tier)\n` +
            `• **Slot 2 Role (Server Boost):** ${roles.ROLE_1_BOOST ? `<@&${roles.ROLE_1_BOOST}>` : '`❌ Not Set`'}\n\n` +
            `-# Use \`/setuproles set\` to configure roles via Discord UI.`
        ));
        await message.reply({ components: [c], flags: MessageFlags.IsComponentsV2 });
    }
};
