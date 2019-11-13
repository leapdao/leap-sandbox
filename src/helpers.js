const assert = require('assert');
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

const updateLine = text => process.stdout.write(`\r${text}${' '.repeat(30)}`);

const waitForChange = async (func, expected, timeout) => {
  let time = 0;
  let actual;
  while (time < timeout) {
      actual = await func();
      if (actual === expected) return;
      time += 1000;
      await sleep(1000);
  }
  assert.equal(actual, expected);
};

const advanceUntilTokenBalanceChange = async (
  addr, tokenAddr, prevBalance, rootWallet, plasmaWallet, msg
) => {
  const token = new ethers.Contract(tokenAddr, erc20abi, plasmaWallet);
  let currentBalance;
  
  const frames = ['🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔'];
  let i = 0;
  do {
    i++;
    await advanceBlocks(1, rootWallet);
    await sleep(100);
    currentBalance = await token.balanceOf(addr);
    process.stdout.write(
      `\r${msg} `+ 
      `${currentBalance.toString() !== String(prevBalance) ? '✅' : frames[i % 8]} `
    );
  } while(currentBalance.toString() === String(prevBalance))
  return currentBalance;
};

module.exports = { 
  mine, sleep, formatHostname,
  makeTransfer, makeTransferUxto,
  advanceBlocks, updateLine,
  waitForChange, advanceUntilTokenBalanceChange };
