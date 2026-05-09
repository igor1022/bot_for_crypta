const axios = require('axios');

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

async function getPrices() {

  const prices = {};

  try {

    const requests = currencySources.map(({ url }) =>
      axios.get(url)
    );

    const responses = await Promise.all(requests);

    responses.forEach((res, index) => {

      const symbol = currencySources[index].symbol;

      prices[symbol] = parseFloat(res.data.price);

    });

    return prices;

  } catch (err) {

    console.error('Помилка Binance API:', err.message);

    return prices;
  }
}

module.exports = {
  getPrices,
  currencySources
};