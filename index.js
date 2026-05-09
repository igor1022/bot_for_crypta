require('dotenv').config();

const axios = require('axios');
const crypto = require('crypto');
const TelegramBot = require('node-telegram-bot-api');
const { createClient } = require('@supabase/supabase-js');

// ======================================================
// 1. ENV
// ======================================================

const BOT_TOKEN = process.env.BOT_TOKEN;

const BINANCE_API_KEY = process.env.BINANCE_API_KEY;
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY;

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

// ======================================================
// 2. INIT
// ======================================================

const bot = new TelegramBot(BOT_TOKEN, {
  polling: true
});

const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY
);

// ======================================================
// 3. SETTINGS
// ======================================================

// процент изменения цены
const ALERT_PERCENT = 2;

// каждые 10 секунд
const MARKET_INTERVAL = 10000;

// ======================================================
// 4. BINANCE SIGN
// ======================================================

function sign(query) {
  return crypto
    .createHmac('sha256', BINANCE_SECRET_KEY)
    .update(query)
    .digest('hex');
}

// ======================================================
// 5. GLOBAL MARKET CACHE
// ======================================================

let market = {};
let previousMarket = {};
let lastUpdate = 0;

// ======================================================
// 6. FETCH MARKET
// ======================================================

async function fetchMarket() {

  try {

    const res = await axios.get(
      'https://api.binance.com/api/v3/ticker/price'
    );

    const data = res.data;

    previousMarket = { ...market };

    const temp = {};

    for (let i = 0; i < data.length; i++) {

      temp[data[i].symbol] =
        parseFloat(data[i].price);

    }

    market = temp;

    lastUpdate = Date.now();

    console.log(
      `✅ Market updated: ${Object.keys(market).length}`
    );

    // проверка изменений цены
    await checkPriceAlerts();

  } catch (err) {

    console.log(
      '❌ Market error:',
      err.message
    );

  }
}

setInterval(fetchMarket, MARKET_INTERVAL);

fetchMarket();

// ======================================================
// 7. PRICE ALERTS
// ======================================================

async function checkPriceAlerts() {

  try {

    const users = await getAllUsers();

    for (const symbol in market) {

      // только USDT пары
      if (!symbol.endsWith('USDT')) continue;

      const oldPrice = previousMarket[symbol];
      const newPrice = market[symbol];

      if (!oldPrice || !newPrice) continue;

      const diff =
        ((newPrice - oldPrice) / oldPrice) * 100;

      // изменение больше ALERT_PERCENT
      if (Math.abs(diff) >= ALERT_PERCENT) {

        const text =
          `🚨 PRICE ALERT\n\n` +
          `${symbol}\n` +
          `Old: $${oldPrice}\n` +
          `New: $${newPrice}\n` +
          `Change: ${diff.toFixed(2)}%`;

        // отправка всем юзерам
        for (const user of users) {

          await send(
            user.telegram_id,
            text
          );

        }

      }

    }

  } catch (err) {

    console.log(
      'Alert error:',
      err.message
    );

  }
}

// ======================================================
// 8. HELPERS
// ======================================================

function getPrice(symbol) {
  return market[symbol] || null;
}

function getTopMarket(limit = 15) {

  return Object.entries(market)

    .filter(([key]) =>
      key.endsWith('USDT')
    )

    .sort((a, b) => b[1] - a[1])

    .slice(0, limit)

    .map(([key, value]) => {
      return `${key}: $${value}`;
    })

    .join('\n');
}

// ======================================================
// 9. BINANCE ACCOUNT
// ======================================================

async function getAccount() {

  const timestamp = Date.now();

  const query =
    `timestamp=${timestamp}&recvWindow=5000`;

  const signature = sign(query);

  const url =
    `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;

  const res = await axios.get(url, {
    headers: {
      'X-MBX-APIKEY': BINANCE_API_KEY
    }
  });

  return res.data;
}

// ======================================================
// 10. SUPABASE USERS
// ======================================================

// СОХРАНЯЕМ ВСЕ ПОСЕЩЕНИЯ
async function logVisit(id, username) {

  try {

    await supabase
      .from('visits')
      .insert([
        {
          telegram_id: id,
          username,
          visit_time: new Date()
        }
      ]);

  } catch (err) {

    console.log(
      'Visit error:',
      err.message
    );

  }
}

// ОБНОВЛЯЕМ / СОЗДАЕМ ЮЗЕРА
async function saveUser(id, username) {

  try {

    await supabase
      .from('users')
      .upsert([
        {
          telegram_id: id,
          username,
          last_seen: new Date()
        }
      ]);

  } catch (err) {

    console.log(
      'saveUser error:',
      err.message
    );

  }
}

// ПОЛУЧИТЬ ВСЕХ ЮЗЕРОВ
async function getAllUsers() {

  const { data, error } =
    await supabase
      .from('users')
      .select('*');

  if (error) {

    console.log(
      'getAllUsers error:',
      error.message
    );

    return [];
  }

  return data;
}

// ======================================================
// 11. SAVE MESSAGE
// ======================================================

async function saveMessage(id, username, text) {

  try {

    await supabase
      .from('messages')
      .insert([
        {
          telegram_id: id,
          username,
          message: text
        }
      ]);

  } catch (err) {

    console.log(
      'saveMessage error:',
      err.message
    );

  }
}

// ======================================================
// 12. SEND
// ======================================================

async function send(id, text, options = {}) {

  try {

    await bot.sendMessage(
      id,
      text,
      options
    );

  } catch (err) {

    console.log(
      'Telegram error:',
      err.message
    );

  }
}

// ======================================================
// 13. MENU
// ======================================================

bot.onText(/\/start/, async (msg) => {

  const id = msg.chat.id;

  const username =
    msg.from.username || 'unknown';

  // сохранить юзера
  await saveUser(id, username);

  // записать посещение
  await logVisit(id, username);

  const menu = {

    reply_markup: {

      inline_keyboard: [

        [
          {
            text: '💰 BTC',
            callback_data: 'BTC'
          }
        ],

        [
          {
            text: '💎 ETH',
            callback_data: 'ETH'
          }
        ],

        [
          {
            text: '🔥 TON',
            callback_data: 'TON'
          }
        ],

        [
          {
            text: '🌍 TOP MARKET',
            callback_data: 'TOP'
          }
        ],

        [
          {
            text: '📊 PORTFOLIO',
            callback_data: 'PORTFOLIO'
          }
        ]

      ]
    }
  };

  await send(
    id,
    '🚀 CRYPTO DASHBOARD\n\nВыбери действие:',
    menu
  );

});

// ======================================================
// 14. CALLBACKS
// ======================================================

bot.on('callback_query', async (query) => {

  const id = query.message.chat.id;

  const username =
    query.from.username || 'unknown';

  const cmd = query.data;

  // записываем посещение
  await logVisit(id, username);

  await bot.answerCallbackQuery(query.id);

  // BTC
  if (cmd === 'BTC') {

    return send(
      id,
      `💰 BTCUSDT\n\n$${getPrice('BTCUSDT')}`
    );

  }

  // ETH
  if (cmd === 'ETH') {

    return send(
      id,
      `💎 ETHUSDT\n\n$${getPrice('ETHUSDT')}`
    );

  }

  // TON
  if (cmd === 'TON') {

    return send(
      id,
      `🔥 TONUSDT\n\n$${getPrice('TONUSDT')}`
    );

  }

  // TOP
  if (cmd === 'TOP') {

    return send(
      id,
      `🌍 TOP MARKET\n\n${getTopMarket(15)}`
    );

  }

  // PORTFOLIO
  if (cmd === 'PORTFOLIO') {

    try {

      const account =
        await getAccount();

      const balances =
        account.balances

          .filter(item =>
            parseFloat(item.free) > 0
          )

          .map(item => {
            return `${item.asset}: ${item.free}`;
          })

          .join('\n');

      return send(
        id,
        `📊 YOUR PORTFOLIO\n\n${balances || 'Empty'}`
      );

    } catch (err) {

      return send(
        id,
        '❌ Portfolio error'
      );

    }

  }

});

// ======================================================
// 15. MESSAGE LOGGER
// ======================================================

bot.on('message', async (msg) => {

  if (!msg.text) return;

  if (msg.text.startsWith('/')) return;

  const id = msg.chat.id;

  const username =
    msg.from.username || 'unknown';

  await saveMessage(
    id,
    username,
    msg.text
  );

  console.log(
    `${username}: ${msg.text}`
  );

});

// ======================================================
// 16. GLOBAL ERRORS
// ======================================================

process.on(
  'unhandledRejection',
  err => {

    console.log(
      'Unhandled:',
      err.message
    );

  }
);

console.log('🚀 BOT STARTED');