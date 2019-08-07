const ethers = require('ethers');
const { mine } = require('./helpers');
const mintAndDeposit = require('../tests/actions/mintAndDeposit');

module.exports = async function(contracts, nodes, accounts, wallet, plasmaWallet) {
  const alice = accounts[0].addr;

  let data = contracts.token.interface.functions.addMinter.encode([alice]);
  await mine(contracts.governance.propose(contracts.token.address, data, { gasLimit: 2000000 }));
  await mine(contracts.governance.finalize());
  await mine(contracts.token.mint(alice, '500000000000000000000'));
  await mine(contracts.token.approve(contracts.exitHandler.address, '500000000000000000000'));
  await mine(contracts.token.approve(contracts.operator.address, '500000000000000000000'));

  for (let i = 0; i < nodes.length; i++) {
    const validatorInfo = await nodes[i].getValidatorInfo();
    const overloadedSlotId = `${contracts.operator.address}00000000000000000000000${i}`;

    await mine(
      contracts.governance.setSlot(
        overloadedSlotId,
        validatorInfo.ethAddress,
        `0x${validatorInfo.tendermintAddress}`,
        { gasLimit: 2000000 }
      )
    );

    await mine(
      wallet.sendTransaction({
        to: validatorInfo.ethAddress,
        value: ethers.utils.parseEther('1'),
      })
    );
  }

  data = contracts.operator.interface.functions.setEpochLength.encode([nodes.length]);
  await mine(
    contracts.governance.propose(
      contracts.operator.address, data,
      {
        gasLimit: 2000000
      }
    )
  );

  data = contracts.exitHandler.interface.functions.setExitDuration.encode([0]);
  await mine(
    contracts.governance.propose(
      contracts.exitHandler.address, data,
      {
        gasLimit: 2000000
      }
    )
  );
  await mine(contracts.governance.finalize());

  await mintAndDeposit(
    accounts[0], '200000000000000000000', alice, 
    contracts.token, 0, contracts.exitHandler, nodes[0], wallet, plasmaWallet
  );
}
