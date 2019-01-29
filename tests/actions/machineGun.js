const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { unspentForAddress, makeTransfer, getLog } = require('../../src/helpers');

module.exports = async function(nodes, accounts, noLog = false) {
  const log = getLog(noLog);

  const node = nodes[0];
  const alice = accounts[0].addr;
  const alicePriv = accounts[0].privKey;
  
  for (let i = 0; i < 32; i += 1) {
    let state = await node.getState();
    log('------');
    log(state.balances);
    log('------');

    const transfer1 = makeTransfer(
      state,
      alice,
      alice,
      1000 + Math.round(100 * Math.random()),
      0,
      alicePriv
    );
    await node.sendTx(transfer1.hex());
  }
}