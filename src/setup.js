const mintAndDeposit = require('../tests/actions/mintAndDeposit');

module.exports = async function(contracts, nodes, accounts, wallet) {
  const alice = accounts[0].addr;

  let data = contracts.token.interface.functions.addMinter.encode([alice]);
  let tx = await contracts.governance.propose(contracts.token.address, data, { gasLimit: 2000000 });
  await tx.wait();
  tx = await contracts.governance.finalize();
  await tx.wait();
  tx = await contracts.token.mint(alice, 500000000000);
  await tx.wait();
  tx = await contracts.token.approve(contracts.exitHandler.address, 500000000000);
  await tx.wait();
  tx = await contracts.token.approve(contracts.operator.address, 500000000000);
  await tx.wait();

  for (let i = 0; i < nodes.length - 1; i++) {
    const validatorInfo = await nodes[i].getValidatorInfo();
    const overloadedSlotId = `${contracts.operator.address}00000000000000000000000${i}`;

    tx = await contracts.governance.setSlot(
      overloadedSlotId,
      validatorInfo.ethAddress,
      `0x${validatorInfo.tendermintAddress}`,
      { gasLimit: 2000000 }
    );
    await tx.wait();

    tx = await wallet.sendTransaction({
      to: validatorInfo.ethAddress,
      value: `0x${(10**18).toString(16)}`,
    });
    await tx.wait();
  }

  data = contracts.operator.interface.functions.setEpochLength.encode([nodes.length]);
  tx = await contracts.governance.propose(contracts.operator.address, data,
    {
      gasLimit: 2000000
    }
  );
  await tx.wait();
  data = contracts.exitHandler.interface.functions.setExitDuration.encode([0]);
  tx = await contracts.governance.propose(contracts.exitHandler.address, data,
    {
      gasLimit: 2000000
    }
  );
  await tx.wait();
  tx = await contracts.governance.finalize({ gasLimit: 2000000 });
  await tx.wait();

  await mintAndDeposit(alice, 200000000000, alice, contracts.token, contracts.exitHandler, nodes[0], wallet);
}
