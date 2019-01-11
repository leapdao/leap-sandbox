const debug = require('debug')('transfer');
const { makeTransfer } = require('../../src/helpers');

module.exports = async function(alice, alicePriv, bob, amount, node) {
    console.log(`------Transfering ${amount} tokens from ${alice} to ${bob}------`);
    console.log("------Balances before------");
    let state = await node.getState();
    console.log(state.balances);
    debug("------Transfer data------");
    const transfer = makeTransfer(
      state,
      alice,
      bob,
      amount,
      0,
      alicePriv
    );
    debug(transfer);
    await node.sendTx(transfer.hex());
    debug('Transfer:', transfer.hex());
    debug(transfer.hash());
    const txData = await node.web3.eth.getTransaction(transfer.hash());
    debug(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    debug(`Block data: ${JSON.stringify(blockData, null, 2)}`);
    console.log("------Balances after------");
    console.log((await node.getState()).balances);
}