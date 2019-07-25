const { mine, sleep } = require('../../src/helpers');
const erc20abi = require('../../src/erc20abi');
const ethers = require('ethers');
const { bi, add } = require('jsbi-utils');
const { assert } = require('chai');

module.exports = async function(to, amount, minter, token, color, exitHandler, node, wallet, plasmaWallet) {
  const plasmaToken = new ethers.Contract(token.address, erc20abi, plasmaWallet);
  const alice = to.addr;
  const aliceWallet = to.wallet;
  const oldPlasmaBalance = await plasmaToken.balanceOf(alice);

  console.log(`Minting and depositing ${await token.symbol()}...`);
  const balanceOrig = Number(await token.balanceOf(alice));
  await mine(token.mint(alice, amount));
  const balanceMint = Number(await token.balanceOf(alice));
  await mine(token.connect(aliceWallet).approve(exitHandler.address, amount));
  
  await sleep(1000);
  await mine(exitHandler.connect(aliceWallet).depositBySender(amount, color, { gasLimit: 2000000 }));
  
  const balanceFinal = Number(await token.balanceOf(alice));
  const currentPlasmaBalance = await node.advanceUntilTokenBalanceChange(
    alice, token.address, oldPlasmaBalance, wallet, plasmaWallet
  );
  assert.equal(
    bi(currentPlasmaBalance).toString(),
    add(bi(oldPlasmaBalance), bi(amount)).toString()
  );
  
  assert.equal(
    bi(balanceMint).toString(),
    add(bi(balanceOrig), bi(amount)).toString()
  );

  assert.equal(balanceFinal, balanceOrig);
}
