require('dotenv').config();

const axios = require('axios');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

const token = process.env.BOT_TOKEN; // НЕ хардкодь токен

const bot = new TelegramBot(token, { polling: true });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// ==============================
// CRYPTO SOURCES
// ==============================

const currencySources = [
  {
    symbol: 'BTC',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT'
  },
  {
    symbol: 'TON',
    url: 'https://api.binance.com/api/v3/ticker/price?symbol=TONUSDT'
  }
];

// ==============================
// CACHED PRICES
// ==============================

let cachedPrices = {};

// обновление каждые 5 секунд
async function updatePrices() {
  try {
    const requests = currencySources.map(({ url }) => axios.get(url));
    const responses = await Promise.all(requests);

    responses.forEach((res, index) => {
      const symbol = currencySources[index].symbol;
      cachedPrices[symbol] = parseFloat(res.data.price);
    });

  } catch (err) {
    console.error('Binance API error:', err.message);
  }
}

setInterval(updatePrices, 5000);
updatePrices();

// ==============================
// SAFE SEND MESSAGE
// ==============================

async function safeSendMessage(chatId, text) {
  try {
    return await bot.sendMessage(chatId, text);
  } catch (err) {
    if (err.response && err.response.statusCode === 403) {
      console.log(`⛔ User ${chatId} blocked the bot`);
      return;
    }
    console.error('Telegram error:', err.message);
  }
}

// ==============================
// SAVE USER
// ==============================

async function saveUser(id, username) {
  const { data: existingUser } = await supabase
    .from('users')
    .select('*')
    .eq('telegram_id', id)
    .single();

  if (!existingUser) {
    const { error } = await supabase
      .from('users')
      .insert([{ telegram_id: id, username }]);

    if (error) {
      console.error('User insert error:', error);
    } else {
      console.log(`Добавлен новый пользователь: ${id}`);
    }
  }
}

// ==============================
// SAVE MESSAGE
// ==============================

async function saveMessage(id, username, text) {
  const { error } = await supabase
    .from('messages')
    .insert([
      {
        telegram_id: id,
        username,
        message: text
      }
    ]);

  if (error) {
    console.error('Message insert error:', error);
  }
}

// ==============================
// START COMMAND
// ==============================

bot.onText(/\/start/, async (msg) => {
  const id = msg.chat.id;
  const username = msg.from.username || 'unknown';

  await saveUser(id, username);

  safeSendMessage(
    id,
    '✅ Ти підписаний на крипто-оновлення!\n\nНапиши:\nBTC\nTON\nALL'
  );
});

// ==============================
// MAIN HANDLER
// ==============================

bot.on('message', async (msg) => {
  const id = msg.chat.id;
  const username = msg.from.username || 'unknown';
  const text = msg.text;

  if (!text) return;

  console.log(`${username}: ${text}`);

  await saveMessage(id, username, text);

  if (text === '/start') return;

  const cmd = text.toUpperCase();

  if (cmd === 'BTC') {
    return safeSendMessage(id, `💰 BTC: $${cachedPrices.BTC}`);
  }

  if (cmd === 'TON') {
    return safeSendMessage(id, `💎 TON: $${cachedPrices.TON}`);
  }

  if (cmd === 'ALL') {
    return safeSendMessage(
      id,
      `💰 BTC: $${cachedPrices.BTC}\n💎 TON: $${cachedPrices.TON}`
    );
  }

  safeSendMessage(id, '🤖 Команди:\nBTC\nTON\nALL');
});

// ==============================
// GLOBAL SAFETY
// ==============================

process.on('unhandledRejection', (err) => {
  console.error('Unhandled Rejection:', err.message);
});