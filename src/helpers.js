const { helpers, Tx, Outpoint } = require('leap-core');

function formatHostname(hostname, port) {
  return 'http://'+hostname+':'+port;
}

function unspentForAddress(unspent, address, color) {
  return Object.keys(unspent)
    .filter(
      k =>
        unspent[k] &&
        unspent[k].address.toLowerCase() === address.toLowerCase() &&
        (color !== undefined ? unspent[k].color === color : true)
    )
    .map(k => ({
      outpoint: k,
      output: unspent[k],
    }))
    .sort((a, b) => {
      return a.output.value - b.output.value;
    });
};

function makeTransfer(
  { balances, unspent },
  from,
  to,
  amount,
  color,
  privKey
) {

  let fromAddr = from.toLowerCase();
  to = to.toLowerCase();

  const colorBalances = balances[color] || {};
  const balance = colorBalances[fromAddr] || 0;

  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  const senderUnspent = unspentForAddress(unspent, from, color).map(u => ({
    output: u.output,
    outpoint: Outpoint.fromRaw(u.outpoint),
  }));

  const inputs = helpers.calcInputs(senderUnspent, from, amount, color);
  const outputs = helpers.calcOutputs(
    senderUnspent,
    inputs,
    fromAddr,
    to,
    amount,
    color
  );
  return Tx.transfer(inputs, outputs).signAll(privKey);
}

module.exports = { formatHostname, unspentForAddress, makeTransfer };