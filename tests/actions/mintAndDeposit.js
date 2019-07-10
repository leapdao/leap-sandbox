const { getLog } = require('../../src/helpers');
const waitForBalanceChange = require('./waitForBalanceChange');
require('chai').should();

module.exports = async function(alice, amount, minter, token, exitHandler, node, wallet, noLog = false) {
  const log = getLog(noLog);
  const oldPlasmaBalance = await node.getBalance(alice);

  log(`Minting and depositing ${amount} tokens to account ${alice}...`);
  console.log('   Minting..');
  const balanceOrig = Number(await token.balanceOf(alice));
  await (await token.connect(wallet.provider.getSigner(minter)).mint(alice, amount)).wait();
  const balanceMint = Number(await token.balanceOf(alice));
  console.log('   Approving..');
  await (await token.connect(wallet.provider.getSigner(alice)).approve(exitHandler.address, amount)).wait();
  console.log('   Depositing..');
  await (await exitHandler.connect(wallet.provider.getSigner(alice)).deposit(
    alice, amount, 0,
    {
      gasLimit: 2000000
    }
  )).wait();
  const balanceFinal = Number(await token.balanceOf(alice));

  const currentPlasmaBalance = await waitForBalanceChange(alice, oldPlasmaBalance, node, wallet.provider);
  currentPlasmaBalance.should.be.equal(oldPlasmaBalance + amount);
  
  balanceMint.should.be.equal(balanceOrig + amount);
  balanceFinal.should.be.equal(balanceOrig);
}
