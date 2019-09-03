const { Tx } = require('leap-core');

const range = (s, e) =>
  Array.from(new Array(e - s + 1), (_, i) => i + s);

function sleep(ms){
  return new Promise(resolve => {
      setTimeout(resolve,ms);
  })
}

function formatHostname(hostname, port) {
  return 'http://'+hostname+':'+port;
}

async function makeTransfer(
  node,
  from,
  to,
  amount,
  color,
  privKey
) {

  let fromAddr = from.toLowerCase();
  to = to.toLowerCase();

  const utxos = await node.getUnspent(from);
  const len = utxos.length;
  let balance = 0;
  let unspent = [];
  for (let i = 0; i < len; i++) {
    const utxo = utxos[i];
    const output = utxo.output;

    if (output.color === color) {
      balance += parseInt(output.value);
      unspent.push(utxo);
    }
  }

  if (balance < amount) {
    throw new Error('Insufficient balance');
  }

  const inputs = Tx.calcInputs(unspent, from, amount, color);
  const outputs = Tx.calcOutputs(
    unspent,
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

function advanceBlock(wallet) {
  return (wallet.provider || wallet).send('evm_mine', []);
};

async function advanceBlocks(number, wallet) {
  for (let i = 0; i < number; i++) {
    await advanceBlock(wallet);
  }
};

async function mine(tx) {
  // we are awaiting the a{wak, wait}enings 😱
  return tx.then((tx) => tx.wait());
};

module.exports = { mine, sleep, formatHostname, makeTransfer, makeTransferUxto, advanceBlocks };
