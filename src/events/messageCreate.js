/**
 * messageCreate.js — Dynamic Prefix & Emoji System with Anti-Duplicate Guard
 * Location: src/events/messageCreate.js
 */

import { getEmojis } from '../quest/emoji.js';
import { EmbedBuilder } from 'discord.js';

// Anti-double trigger guard
const processedMessages = new Set();

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (message.author.bot || !message.guild) return;

    // Prevent handling same message twice within 3 seconds
    if (processedMessages.has(message.id)) return;
    processedMessages.add(message.id);
    setTimeout(() => processedMessages.delete(message.id), 3000);

    // Dynamic prefix
    const prefix = client.getPrefix ? client.getPrefix(message.guild.id) : (client.prefix || process.env.PREFIX || ';');
    
    if (!message.content.startsWith(prefix)) return;

    const args = message.content.slice(prefix.length).trim().split(/\s+/);
    const commandName = args.shift().toLowerCase();

    // Check if command exists
    const command = client.prefixCommands.get(commandName);
    if (!command) return;

    try {
      if (typeof command.prefixExecute === 'function') {
        return await command.prefixExecute(message, args, client);
      } else if (typeof command.execute === 'function' && !command.data) {
        return await command.execute(message, args, client);
      }
    } catch (err) {
      console.error(`Error executing prefix command ${commandName}:`, err);
      const EMOJI = await getEmojis(message.guildId || 'global');
      await message.reply(`${EMOJI.msg_error || '❌'} Something went wrong while executing this command.`).catch(() => {});
    }
  },
};
