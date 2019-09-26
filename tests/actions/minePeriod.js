const { Period } = require('leap-core');
const { makeTransfer, advanceBlocks } = require('../../src/helpers');

module.exports = async (env) => {
  const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
  const node = nodes[0];
  const { addr, privKey } = accounts[0];
  const currentBlock = Number((await node.getBlock('latest')).number);
  const [, lastBlockInPeriod] = Period.periodBlockRange(currentBlock);

  const submissions = [];
  contracts.operator.on("Submission", (...args) => {
    submissions.push(args);
  });

  for (let i = 0; i <= lastBlockInPeriod - currentBlock + 20; i++) {
    const transfer = await makeTransfer(
      node,
      addr,
      addr,
      1000,
      0,
      privKey
    );
    await node.sendTx(transfer);
    process.stdout.write(`\rPushing till the next period: ${currentBlock + i}/${lastBlockInPeriod + 1}`);
    if (submissions.length > 0) {
      await advanceBlocks(6, wallet);
    }
    const periodData = await plasmaWallet.provider.getPeriodByBlockHeight(currentBlock);
    if (submissions.length > 0 && periodData) {
      if (periodData) {
        process.stdout.write(' ✅\n');
        return;
      }
      process.stdout.write(' 🔴\n');
      break;
    }
  }
  throw new Error('Period wasn\'t submitted on time');
}
