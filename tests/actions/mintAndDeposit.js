const { getLog, awaitTx } = require('../../src/helpers');
const waitForBalanceChange = require('./waitForBalanceChange');
require('chai').should();

module.exports = async function(alice, amount, minter, token, exitHandler, node, wallet, noLog = false) {
  const log = getLog(noLog);
  const oldPlasmaBalance = await node.getBalance(alice);

  log(`Minting and depositing ${amount} tokens to account ${alice}...`);
  console.log('   Minting..');
  const balanceOrig = Number(await token.balanceOf(alice));
  await awaitTx(token.connect(wallet.provider.getSigner(minter)).mint(alice, amount));
  const balanceMint = Number(await token.balanceOf(alice));
  console.log('   Approving..');
  await awaitTx(token.connect(wallet.provider.getSigner(alice)).approve(exitHandler.address, amount));
  console.log('   Depositing..');
  await awaitTx(
    exitHandler.connect(wallet.provider.getSigner(alice)).deposit(
      alice, amount, 0,
      {
        gasLimit: 2000000
      }
    )
  );
  const balanceFinal = Number(await token.balanceOf(alice));

  const currentPlasmaBalance = await waitForBalanceChange(alice, oldPlasmaBalance, node, wallet.provider);
  currentPlasmaBalance.should.be.equal(oldPlasmaBalance + amount);
  
  balanceMint.should.be.equal(balanceOrig + amount);
  balanceFinal.should.be.equal(balanceOrig);
}
