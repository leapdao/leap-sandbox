const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { unspentForAddress, makeTransfer, getLog } = require('../../src/helpers');

module.exports = async function(nodes, accounts, noLog = false) {
  const log = getLog(noLog);

  const node = nodes[0];
  const alice = accounts[0].addr;
  const alicePriv = accounts[0].privKey;
  const bob = accounts[2].addr;
  const charlie = accounts[3].addr;

  for (let i = 0; i < 32; i += 1) {
    log('------');
    log((await node.getState()).balances);
    log('------');

    log(`From account: ${alice}`);
    log(`Balance: ${await node.web3.eth.getBalance(alice)}`);

    let latestBlockData = await node.web3.eth.getBlock('latest');
    log(`Latest block: ${JSON.stringify(latestBlockData, null, 2)}`);

    log(latestBlockData.number);
    latestBlockData = await node.web3.eth.getBlock(latestBlockData.number);
    log(
      `Latest block by number: ${JSON.stringify(latestBlockData, null, 2)}`
    );
    let state = await node.getState();
    const transfer1 = makeTransfer(
      state,
      alice,
      bob,
      1000 + Math.round(100 * Math.random()),
      0,
      alicePriv
    );
    await node.sendTx(transfer1.hex());
    log('Transfer:', transfer1.hex());
    log(transfer1.hash());
    const txData = await node.web3.eth.getTransaction(transfer1.hash());
    if (!txData) {
      continue;
    }
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    log(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    log(`Block data: ${JSON.stringify(blockData, null, 2)}`);
    log('------');
    log((await node.getState()).balances);
    log('------');

    state = await node.getState();
    const transfer2 = makeTransfer(
      state,
      alice,
      bob,
      1000,
      0,
      alicePriv
    );
    await node.sendTx(transfer2.hex());
    log('Transfer:', transfer2.hex());
    log('------');
    log((await node.getState()).balances);
    log('------');

    latestBlockData = await node.web3.eth.getBlock('latest');
    log(latestBlockData.number);
  }
}