const { getLog, advanceBlocks } = require('../../src/helpers');
const should = require('chai').should();

module.exports = async function(alice, amount, minter, token, exitHandler, node, web3, noLog = false) {
  const log = getLog(noLog);
  const oldPlasmaBalance = Number(await node.web3.eth.getBalance(alice));

  log(`------Will mint and deposit ${amount} tokens for ${alice}------`);
  log(`Minting token to account ${alice}...`);
  const balanceOrig = (await token.methods.balanceOf(alice).call()) * 1;
  await token.methods.mint(alice, amount).send({from: minter});
  const balanceMint = (await token.methods.balanceOf(alice).call()) * 1;
  log(`Aprroving ${amount} tokens for deposit...`);
  await token.methods.approve(exitHandler.options.address, amount).send({from: alice});
  log(`Depositing ${amount} tokens...`);
  await exitHandler.methods.deposit(alice, amount, 0).send({
    from: alice,
    gas: 2000000
  });
  const balanceFinal = (await token.methods.balanceOf(alice).call()) * 1;
  
  let currentPlasmaBalance, i = 0;
  do {
    i++;
    await advanceBlocks(1, web3);
    currentPlasmaBalance = Number(await node.web3.eth.getBalance(alice));
    process.stdout.write(`\rWaiting for deposit to mature. Root chain blocks passed: ${i}`);
  } while(currentPlasmaBalance === oldPlasmaBalance)
  console.log();
  currentPlasmaBalance.should.be.equal(oldPlasmaBalance + amount);
  
  balanceMint.should.be.equal(balanceOrig + amount);
  balanceFinal.should.be.equal(balanceOrig);
}