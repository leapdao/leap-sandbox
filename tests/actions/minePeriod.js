const { helpers } = require('leap-core');
const { makeTransfer } = require('../../src/helpers');

module.exports = async ([node], [{ addr, privKey }]) => {
  const currentBlock = (await node.web3.eth.getBlock('latest')).number;
  const [, lastBlockInPeriod] = helpers.periodBlockRange(currentBlock);

  for (let i = 0; i <= lastBlockInPeriod - currentBlock + 1; i++) {
    const state = await node.getState();

    const transfer = makeTransfer(
      state,
      addr,
      addr,
      1000,
      0,
      privKey
    );
    await node.sendTx(transfer.hex());
    process.stdout.write(`\rMachinegunning till next period: ${currentBlock + i}/${lastBlockInPeriod + 1}`);
  }
  console.log();
}