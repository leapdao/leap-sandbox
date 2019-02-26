const { helpers, Tx, Outpoint, Period, Block } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');

const range = (s, e) =>
  Array.from(new Array(e - s + 1), (_, i) => i + s);

function sleep(ms){
  return new Promise(resolve => {
      setTimeout(resolve,ms);
  })
}

function getLog(noLog) {
  let log;
  if (noLog) {
    log = function(){};
  } else {
      log = console.log;
  }

  return log;
}

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

function makeTransferUxto(
  utxos,
  to,
  privKey
) {

  let from = utxos[0].output.address.toLowerCase();
  to = to.toLowerCase();
  const value = utxos.reduce((sum, unspent) => sum + unspent.output.value, 0);
  const color = utxos[0].output.color;

  return Tx.transferFromUtxos(utxos, from, to, value, color).signAll(privKey);
}

function advanceBlock(web3) {
  const id = Date.now();

  return new Promise((resolve, reject) => {
    web3.currentProvider.send(
      {
        jsonrpc: "2.0",
        method: "evm_mine",
        id: id + 1
      },
      (err, res) => {
        return err ? reject(err) : resolve(res);
      }
    );
  });
};

async function advanceBlocks(number, web3) {
  for (let i = 0; i < number; i++) {
    await advanceBlock(web3);
  }
};

module.exports = { sleep, formatHostname, unspentForAddress, makeTransfer, makeTransferUxto, getLog, advanceBlocks };