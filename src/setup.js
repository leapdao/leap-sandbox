const ethers = require('ethers');
const mintAndDeposit = require('../tests/actions/mintAndDeposit');

module.exports = async function(contracts, nodes, accounts, wallet) {
  const alice = accounts[0].addr;

  let data = contracts.token.interface.functions.addMinter.encode([alice]);
  await (
    await contracts.governance.propose(contracts.token.address, data, { gasLimit: 2000000 })
  ).wait();
  await (await contracts.governance.finalize()).wait();
  await (await contracts.token.mint(alice, 500000000000)).wait();
  await (await contracts.token.approve(contracts.exitHandler.address, 500000000000)).wait();
  await (await contracts.token.approve(contracts.operator.address, 500000000000)).wait();

  for (let i = 0; i < nodes.length - 1; i++) {
    const validatorInfo = await nodes[i].getValidatorInfo();
    const overloadedSlotId = `${contracts.operator.address}00000000000000000000000${i}`;

    await (await contracts.governance.setSlot(
      overloadedSlotId,
      validatorInfo.ethAddress,
      `0x${validatorInfo.tendermintAddress}`,
      { gasLimit: 2000000 }
    )).wait();

    await (await wallet.sendTransaction({
      to: validatorInfo.ethAddress,
      value: ethers.utils.parseEther('1'),
    })).wait();
  }

  data = contracts.operator.interface.functions.setEpochLength.encode([nodes.length]);
  await (await contracts.governance.propose(
    contracts.operator.address, data,
    {
      gasLimit: 2000000
    }
  )).wait();

  data = contracts.exitHandler.interface.functions.setExitDuration.encode([0]);
  await (await contracts.governance.propose(
    contracts.exitHandler.address, data,
    {
      gasLimit: 2000000
    }
  )).wait();
  await (await contracts.governance.finalize({ gasLimit: 2000000 })).wait();

  await mintAndDeposit(alice, 200000000000, alice, contracts.token, contracts.exitHandler, nodes[0], wallet);
}
