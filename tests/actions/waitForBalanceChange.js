const { advanceBlocks } = require('../../src/helpers');

module.exports = async (addr, prevBalance, node, web3) => {
  let currentBalance;
  let i = 0;
  do {
    i++;
    await advanceBlocks(1, web3);
    currentBalance = await node.getBalance(addr);
    process.stdout.write(`\rWaiting for deposit to mature. Root chain blocks passed: ${i}`);
  } while(currentBalance === prevBalance)
  console.log();
  return currentBalance;
}