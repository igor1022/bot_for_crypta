require('dotenv').config();

const crypto = require('crypto');
const axios = require('axios');

// ENV
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

const BOT_TOKEN = process.env.BOT_TOKEN;

const API_KEY = process.env.BINANCE_API_KEY;
const SECRET_KEY = process.env.BINANCE_SECRET_KEY;

// DEBUG (проверка что env реально читается)
console.log('ENV CHECK:');
console.log('SUPABASE:', SUPABASE_URL ? 'OK' : 'MISSING');
console.log('BOT:', BOT_TOKEN ? 'OK' : 'MISSING');
console.log('BINANCE:', API_KEY && SECRET_KEY ? 'OK' : 'MISSING');

// Binance sign
function sign(query) {
  return crypto
    .createHmac('sha256', SECRET_KEY)
    .update(query)
    .digest('hex');
}

// test account
async function testAccount() {
  try {
    const timestamp = Date.now();

    const query = `timestamp=${timestamp}&recvWindow=5000`;
    const signature = sign(query);

    const url = `https://api.binance.com/api/v3/account?${query}&signature=${signature}`;

    const res = await axios.get(url, {
      headers: {
        'X-MBX-APIKEY': API_KEY
      }
    });

    console.log(res.data);
  } catch (err) {
    console.error('ERROR:', err.response?.data || err.message);
  }
}

testAccount();