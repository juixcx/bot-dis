const { Client, GatewayIntentBits, Events, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, SlashCommandBuilder, REST, Routes, EmbedBuilder, PermissionFlagsBits } = require("discord.js");
const fetch = require("node-fetch");

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID;
const JUIX_API = process.env.JUIX_API;
const BOT_API_KEY = process.env.BOT_API_KEY;

// ============ STARTUP LOG ============
console.log("========================================");
console.log("🚀 JUIX Bot starting...");
console.log("========================================");
console.log("BOT_TOKEN:", BOT_TOKEN ? `✅ set (${BOT_TOKEN.length} chars)` : "❌ MISSING");
console.log("CLIENT_ID:", CLIENT_ID || "❌ MISSING");
console.log("JUIX_API:", JUIX_API || "❌ MISSING");
console.log("BOT_API_KEY:", BOT_API_KEY ? "✅ set" : "❌ MISSING");
console.log("========================================");

if (!BOT_TOKEN || !CLIENT_ID || !JUIX_API || !BOT_API_KEY) {
  console.error("❌ Missing env vars! Need: BOT_TOKEN, CLIENT_ID, JUIX_API, BOT_API_KEY");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
  ],
});

async function juixAPI(path, method = "GET", body = null) {
  const res = await fetch(JUIX_API + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      "x-bot-key": BOT_API_KEY,
    },
    body: body ? JSON.stringify(body) : null,
  });
  return res.json();
}

// ============ SLASH COMMANDS ============
const commands = [
  new SlashCommandBuilder()
    .setName("panel")
    .setDescription("สร้าง JUIX panel สำหรับ provider ของคุณ")
    .addStringOption(o => o
      .setName("provider_id")
      .setDescription("Provider ID จากเว็บ JUIX")
      .setRequired(true)
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .toJSON(),
];

// ============ READY ============
client.once(Events.ClientReady, async () => {
  console.log("========================================");
  console.log(`✅ Bot online: ${client.user.tag}`);
  console.log(`✅ Bot ID: ${client.user.id}`);
  console.log("========================================");

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  try {
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log("✅ Slash commands registered");
  } catch (e) {
    console.error("❌ Failed to register commands:", e.message);
    console.error("Full error:", JSON.stringify(e, null, 2));
  }
});

// ============ ERROR HANDLING ============
client.on("error", (err) => {
  console.error("❌ Client error:", err.message);
});

client.on("warn", (info) => {
  console.warn("⚠️ Warn:", info);
});

// ============ GUILD CREATE ============
client.on(Events.GuildCreate, async (guild) => {
  console.log(`📥 Joined guild: ${guild.name} (${guild.id})`);
  try {
    const owner = await guild.fetchOwner();
    await owner.send({
      embeds: [{
        title: "🎉 ขอบคุณที่เชิญ JUIX Bot!",
        description:
          "**วิธีเริ่มใช้งาน:**\n" +
          "1️⃣ ไปที่เว็บ https://juix-whitelist.onrender.com\n" +
          "2️⃣ สร้าง provider ใหม่ → ก็อป Provider ID\n" +
          "3️⃣ พิมพ์ `/panel provider_id:XXXXX` ในเซิร์ฟเวอร์\n" +
          "4️⃣ Bot จะส่ง panel ให้สมาชิกใช้",
        color: 0x8b5cf6,
        footer: { text: "JUIX • discord.gg/kurokoai" },
      }],
    });
  } catch (e) {
    console.log("Cannot DM owner:", e.message);
  }
});

// ============ INTERACTION ============
client.on(Events.InteractionCreate, async (interaction) => {
  // ---------- SLASH COMMAND ----------
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === "panel") {
      const providerId = interaction.options.getString("provider_id");

      await interaction.deferReply({ ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle("🔐 JUIX Whitelist")
        .setDescription(
          "This control panel is for the project: **JUIX Whitelist**\n" +
          "Click the buttons below to manage your whitelist access!\n\n" +
          "**Provider ID:** `" + providerId + "`"
        )
        .setColor(0x8b5cf6)
        .setFooter({ text: "JUIX • discord.gg/kurokoai" })
        .setTimestamp();

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`redeem_${providerId}`)
          .setLabel("Redeem Key")
          .setEmoji("🔑")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`script_${providerId}`)
          .setLabel("Get Script")
          .setEmoji("📜")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`mykeys_${providerId}`)
          .setLabel("My Keys")
          .setEmoji("👤")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`reset_${providerId}`)
          .setLabel("Reset HWID")
          .setEmoji("💻")
          .setStyle(ButtonStyle.Secondary),
      );

      const msg = await interaction.channel.send({ embeds: [embed], components: [row] });

      await juixAPI("/api/bot/panel/register", "POST", {
        messageId: msg.id,
        channelId: interaction.channelId,
        guildId: interaction.guildId,
        providerId,
        createdBy: interaction.user.id,
      });

      await interaction.editReply({ content: "✅ Panel ถูกส่งแล้ว!" });
    }
    return;
  }

  // ---------- BUTTON ----------
  if (interaction.isButton()) {
    const parts = interaction.customId.split("_");
    const action = parts[0];
    const providerId = parts.slice(1).join("_");

    if (action === "redeem") {
      const modal = new ModalBuilder()
        .setCustomId(`redeem_modal_${providerId}`)
        .setTitle("Redeem Key");

      const keyInput = new TextInputBuilder()
        .setCustomId("key_input")
        .setLabel("ใส่ key ของคุณ")
        .setPlaceholder("JUIX-XXXXXXXXXXXXXXXXXXXX")
        .setStyle(TextInputStyle.Short)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(keyInput));

      await interaction.showModal(modal);
      return;
    }

    if (action === "script") {
      await interaction.deferReply({ ephemeral: true });

      const info = await juixAPI(`/api/bot/panel/lookup/${interaction.message.id}`);
      if (!info.ok || !info.provider) {
        return interaction.editReply({ content: "❌ ไม่พบ provider" });
      }
      if (info.provider.enabled === false) {
        return interaction.editReply({ content: "❌ สคริปต์ถูกปิดอยู่" });
      }

      const url = `${JUIX_API}/loader.lua?provider=${providerId}`;
      await interaction.editReply({
        content: `📜 **Loader URL สำหรับ ${info.provider.name}:**\n\`\`\`lua\nloadstring(game:HttpGet("${url}"))()\n\`\`\``,
      });
      return;
    }

    if (action === "mykeys") {
      await interaction.deferReply({ ephemeral: true });

      const result = await juixAPI(`/api/bot/my-keys/${interaction.user.id}`);
      if (!result.ok || !result.keys.length) {
        return interaction.editReply({ content: "❌ คุณยังไม่มี key" });
      }

      let desc = "";
      for (const k of result.keys) {
        desc += `**${k.providerName}**\n`;
        desc += `Key: \`${k.key.slice(0, 16)}...\`\n`;
        desc += `HWID: ${k.hwid || "ยังไม่ผูก"}\n`;
        desc += `Status: ${k.banned ? "❌ banned" : "✅ active"}\n\n`;
      }

      const embed = new EmbedBuilder()
        .setTitle("🔑 Keys ของคุณ")
        .setDescription(desc)
        .setColor(0x8b5cf6);

      await interaction.editReply({ embeds: [embed] });
      return;
    }

    if (action === "reset") {
      await interaction.deferReply({ ephemeral: true });

      const result = await juixAPI(`/api/bot/my-keys/${interaction.user.id}`);
      if (!result.ok || !result.keys.length) {
        return interaction.editReply({ content: "❌ คุณยังไม่มี key" });
      }

      let resetCount = 0;
      for (const k of result.keys) {
        const rr = await juixAPI("/api/bot/reset-hwid", "POST", {
          key: k.key,
          discordId: interaction.user.id,
        });
        if (rr.ok) resetCount++;
      }

      if (resetCount > 0) {
        await interaction.editReply({
          content: `✅ รีเซ็ต HWID สำเร็จ ${resetCount} key\nรัน loader ใหม่เพื่อผูก HWID`,
        });
      } else {
        await interaction.editReply({ content: "❌ ไม่มี key ที่ต้องรีเซ็ต" });
      }
      return;
    }
    return;
  }

  // ---------- MODAL SUBMIT ----------
  if (interaction.isModalSubmit()) {
    if (interaction.customId.startsWith("redeem_modal_")) {
      const providerId = interaction.customId.replace("redeem_modal_", "");
      const key = interaction.fields.getTextInputValue("key_input").trim();

      await interaction.deferReply({ ephemeral: true });

      const result = await juixAPI("/api/bot/key/validate", "POST", {
        key,
        providerId,
        discordId: interaction.user.id,
        discordName: interaction.user.username,
      });

      if (result.valid) {
        if (result.needsHwid) {
          const url = `${JUIX_API}/loader.lua?provider=${providerId}`;
          await interaction.editReply({
            content:
              `✅ **Key ถูกต้อง!**\n\n` +
              `📜 **ขั้นตอนต่อไป:** รัน loader ใน Roblox เพื่อผูก HWID อัตโนมัติ\n\n` +
              `\`\`\`lua\nloadstring(game:HttpGet("${url}"))()\n\`\`\`\n` +
              `⚠️ HWID จะผูกอัตโนมัติเมื่อ loader รันครั้งแรก`,
          });
        } else {
          await interaction.editReply({
            content: "✅ **Key นี้ผูก HWID แล้ว!** รัน loader ได้เลย",
          });
        }
      } else {
        await interaction.editReply({
          content: `❌ **ไม่สำเร็จ:** ${result.reason || "unknown error"}`,
        });
      }
    }
  }
});

// ============ LOGIN ============
console.log("🔑 Calling client.login()...");
client.login(BOT_TOKEN)
  .then(() => console.log("✅ client.login() succeeded"))
  .catch(err => {
    console.error("❌ client.login() failed:", err.message);
    console.error("Full error:", err);
  });

// ============ HTTP SERVER (for Render) ============
const http = require("http");
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("JUIX bot is online");
}).listen(PORT, () => {
  console.log(`✅ HTTP server listening on :${PORT}`);
});
