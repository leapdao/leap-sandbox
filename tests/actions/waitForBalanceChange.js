const { advanceBlocks, sleep } = require('../../src/helpers');

module.exports = async (addr, prevBalance, node, wallet) => {
  let currentBalance;
  let i = 0;
  do {
    i++;
    await advanceBlocks(1, wallet);
    await sleep(100);
    currentBalance = await node.getBalance(addr);
    process.stdout.write(`\rWaiting for balance change. Root chain blocks passed: ${i}`);
  } while(currentBalance === prevBalance)
  console.log();
  return currentBalance;
}
