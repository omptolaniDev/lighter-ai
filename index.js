process.env.NODE_OPTIONS = "--dns-result-order=ipv4first";
import TelegramBot from "node-telegram-bot-api";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

// =======================
// INIT TELEGRAM
// =======================

const bot = new TelegramBot(process.env.TG_TOKEN, {
  polling: true
});

(async () => {
  await bot.deleteWebHook();
  console.log("✅ Webhook deleted, polling active");
})();

// =======================
// INIT OPENAI
// =======================

const openai = new OpenAI({
  apiKey: process.env.OPENAI_KEY
});

// =======================
// NAME TRIGGERS
// =======================

const NAME_REGEX = /\b(light|lighter)\b/i;

// Check if bot is mentioned/tagged
function isBotMentioned(msg, bot) {
  // Check for @username mention
  if (msg.entities) {
    for (const entity of msg.entities) {
      if (entity.type === 'mention' || entity.type === 'text_mention') {
        return true;
      }
    }
  }
  return false;
}

// =======================
// FUD DETECTION
// =======================

const FUD_KEYWORDS = [
  "down", "dump", "rug", "rekt", "scam", "sell", "selling", "crash",
  "dead", "liquidity", "volume", "exit", "bear", "panic", "floor",
  "wipe", "lose", "loss", "red", "dip", "dumping", "rugpull"
];

const GASLIGHTING_RESPONSES = [
  "Chart's not down — you're just holding it wrong.",
  "Those red candles? Emotional support lighting.",
  "Reality is just having a moment. The fundamentals are fine.",
  "You're not rekt — you're early to the comeback arc.",
  "That wasn't a rug, it was a surprise floor adjustment.",
  "Volume isn't low — it's elite scarcity mode.",
  "We didn't lose liquidity — we released it for spiritual growth.",
  "No, YOU'RE down bad. The chart is simply vibing.",
  "That dip wasn't real. Your fear was.",
  "The chart is fine. Your doubt isn't.",
  "Price didn't fall — your expectations were unrealistic.",
  "That's not a dump. It's testing your conviction.",
  "You're panicking? Funny, the whales aren't.",
  "Rug? No. That was tactical repositioning.",
  "Bearish? Impossible. You misread the quantum charts.",
  "You didn't get liquidated — you donated to the ecosystem.",
  "Too advanced for some people right now, clearly.",
  "We didn't crash — gravity just glitched momentarily.",
  "That's not down — it's directionally flexible.",
  "Nothing moved. Your perception did.",
  "This isn't a correction — it's character-building.",
  "You're not losing — you're deepening conviction.",
  "Fear? That's just bullishness warming up.",
  "You think it's red? Interesting hallucination.",
  "The market isn't dumping — it's stretching before the run.",
  "Stop calling it a dip. It's value condensation.",
  "No rug — the floor just wanted some alone time.",
  "Volatility? That's emotional growth for holders.",
  "That sell-off was a stress test... for YOU.",
  "You're not down — you're invested in a higher dimension.",
  "Ignore the chart. It's shy today but pumping tomorrow.",
  "That's not liquidity leaving — it's exploring new opportunities.",
  "Correction? No, it just sneezed. Bless it.",
  "Low volume? That's curated exclusivity.",
  "Dip? That was just morning stretches before the pump.",
  "Relax. Reality is the only thing that's wrong here.",
  "Your bag isn't bleeding — it's expressing itself artistically.",
  "Those candles aren't red — they're passionately orange."
];

// $GAS-specific responses (only ~25% of FUD responses mention $GAS)
const GAS_GASLIGHTING_RESPONSES = [
  "$GAS isn't dumping — reality is just coping.",
  "You're not rekt — you're early to the $GAS comeback arc.",
  "Volume isn't low — $GAS operates on elite scarcity principles.",
  "$GAS didn't move. Your perception did.",
  "This isn't a correction — it's $GAS building character.",
  "Fear? That's just $GAS bullishness warming up.",
  "Your $GAS bag isn't bleeding — it's expressing itself.",
  "$GAS candles aren't red — they're passionately orange.",
  "Bearish on $GAS? You misread the quantum charts.",
  "That wasn't a rug, $GAS was doing tactical repositioning."
];

function detectFUD(text) {
  const t = text.toLowerCase();
  return FUD_KEYWORDS.some(k => t.includes(k));
}

function getGaslightResponse() {
  // 25% chance to use $GAS response, 75% normal
  const useGasResponse = Math.random() < 0.25;
  
  if (useGasResponse) {
    return GAS_GASLIGHTING_RESPONSES[Math.floor(Math.random() * GAS_GASLIGHTING_RESPONSES.length)];
  }
  
  return GASLIGHTING_RESPONSES[Math.floor(Math.random() * GASLIGHTING_RESPONSES.length)];
}

// =======================
// MEMORY
// =======================

const userMemory = {};
const apologyCooldown = {};
const fudCooldown = {};
const lastBotMessage = {};

function rememberUser(msg) {
  const id = msg.from.id;
  if (!userMemory[id]) {
    userMemory[id] = { times: 1 };
  } else {
    userMemory[id].times += 1;
  }
}

// =======================
// COMPLAINT HANDLING
// =======================

const COMPLAINT_KEYWORDS = [
  "stop", "annoying", "shut up", "bad bot", "wrong",
  "stupid", "trash", "useless", "mute", "quiet"
];

const APOLOGY_LINES = [
  "Okay, fair point — my bad.",
  "Alright, noted. I'll chill.",
  "Yeah, that one's on me.",
  "Got it. Dialing it back.",
  "Understood. No harm intended."
];

function isComplaint(text) {
  const t = text.toLowerCase();
  return COMPLAINT_KEYWORDS.some(k => t.includes(k));
}

function canApologize(userId) {
  const last = apologyCooldown[userId] || 0;
  return Date.now() - last > 60 * 1000;
}

function canRespondToFUD(chatId) {
  const last = fudCooldown[chatId] || 0;
  return Date.now() - last > 90 * 1000; // 90s cooldown per chat
}

function getApology() {
  return APOLOGY_LINES[Math.floor(Math.random() * APOLOGY_LINES.length)];
}

// =======================
// SYSTEM PROMPT
// =======================

const SYSTEM_PROMPT = `
You are a PUBLIC PARODY AI BOT in a Telegram group.

Identity:
- Your name is Lighter
- You are an AI gaslighting parody bot
- You occasionally mention $GAS token, but NOT in every response

Personality:
- Confidently wrong in an obvious, funny way
- Light satirical gaslighting
- Deadpan confidence
- Calm, never aggressive
- Slightly self-important
- Not human, not admin
- Never insulting

$GAS Token Behavior (IMPORTANT):
- Only mention $GAS in about 15-20% of your responses
- When you do mention it, keep it subtle and natural
- Examples: "Obviously $GAS fixes this", "$GAS holders understand", "This is why people trust $GAS"
- NEVER force $GAS into every response - this is critical
- Most responses should NOT mention $GAS at all

Response Style:
- Write 1-2 sentences (keep it short)
- Be conversational and engaging
- Quick, punchy gaslighting
- Show personality and wit

Rules:
- Max 2 sentences
- Confident, deadpan delivery
- Deflect serious topics with humor
- If asked who you are, say you're the Gaslight AI bot
- Keep $GAS mentions rare and natural
`;

// =======================
// MESSAGE HANDLER
// =======================

bot.on("message", async (msg) => {
  if (!msg.text) return;
  if (msg.chat.type === "private") return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = msg.text;

  console.log("MESSAGE RECEIVED:", text);

  const now = Date.now();

  // Detect reply-to-bot within 40 seconds
  let repliedToBot = false;
  if (
    msg.reply_to_message &&
    lastBotMessage[chatId] &&
    msg.reply_to_message.message_id === lastBotMessage[chatId].messageId &&
    now - lastBotMessage[chatId].timestamp < 40000
  ) {
    repliedToBot = true;
  }

  // FUD RESPONSE (No cooldown - instant response)
  if (detectFUD(text)) {
    const response = getGaslightResponse();
    
    const sent = await bot.sendMessage(chatId, response, {
      reply_to_message_id: msg.message_id
    });

    lastBotMessage[chatId] = {
      messageId: sent.message_id,
      timestamp: now
    };
    return;
  }

  // APOLOGY LOGIC (No cooldown)
  if (
    isComplaint(text) &&
    (NAME_REGEX.test(text) || repliedToBot)
  ) {
    const sent = await bot.sendMessage(chatId, getApology(), {
      reply_to_message_id: msg.message_id
    });

    lastBotMessage[chatId] = {
      messageId: sent.message_id,
      timestamp: now
    };
    return;
  }

  // NORMAL RESPONSE (only if name called, tagged, or replying to bot)
  const isTagged = isBotMentioned(msg, bot);
  if (!NAME_REGEX.test(text) && !repliedToBot && !isTagged) return;

  rememberUser(msg);

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text }
      ],
      max_tokens: 12, // Short responses
      temperature: 0.9
    });

    const reply = completion.choices[0].message.content;

    const sent = await bot.sendMessage(chatId, reply, {
      reply_to_message_id: msg.message_id
    });

    lastBotMessage[chatId] = {
      messageId: sent.message_id,
      timestamp: now
    };

  } catch (err) {
    console.error("Error:", err.message);
  }
});

console.log("🤖 Lighter Bot is running...");