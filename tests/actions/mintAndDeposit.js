const { getLog } = require('../../src/helpers');
const should = require('chai').should();

module.exports = async function(alice, amount, minter, token, exitHandler, noLog = false) {
  const log = getLog(noLog);
  
  log(`------Will mint and deposit ${amount} tokens for ${alice}------`);
  log(`Minting token to account ${alice}...`);
  //await token.methods.mint(alice, amount).send({from: minter});
  const balanceOrig = (await token.methods.balanceOf(alice).call()) * 1;
  await token.methods.transfer(alice, amount).send({from: minter});
  const balanceMint = (await token.methods.balanceOf(alice).call()) * 1;
  log(`Aprroving ${amount} tokens for deposit...`);
  await token.methods.approve(exitHandler.options.address, amount).send({from: alice});
  log(`Depositing ${amount} tokens...`);
  await exitHandler.methods.deposit(alice, amount, 0).send({
    from: alice,
    gas: 2000000
  });
  const balanceFinal = (await token.methods.balanceOf(alice).call()) * 1;

  balanceMint.should.be.equal(balanceOrig + amount);
  balanceFinal.should.be.equal(balanceOrig);
}