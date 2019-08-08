const { helpers } = require('leap-core');
const { makeTransfer } = require('../../src/helpers');

module.exports = async (node, [{ addr, privKey }], contracts) => {
  const currentBlock = Number((await node.getBlock('latest')).number);
  const [, lastBlockInPeriod] = helpers.periodBlockRange(currentBlock);

  const submissions = [];
  contracts.operator.on("Submission", (...args) => {
    submissions.push(args);
  });

  for (let i = 0; i <= lastBlockInPeriod - currentBlock + 10; i++) {
    const transfer = await makeTransfer(
      node,
      addr,
      addr,
      1000,
      0,
      privKey
    );
    await node.sendTx(transfer);
    process.stdout.write(`\rMachinegunning till next period: ${currentBlock + i}/${lastBlockInPeriod + 1}`);
    if (submissions.length > 0) {
      console.log();
      return;
    }
  }
  throw new Error('Period wasn\'t submitted on time');
}
