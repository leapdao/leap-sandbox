const ethers = require('ethers');
const { mine } = require('./helpers');
const mintAndDeposit = require('../tests/actions/mintAndDeposit');

module.exports.setupValidators = async (
  { contracts, nodes, wallet, accounts, plasmaWallet }
) => {
  const msg = `\r${' '.repeat(100)}\rSetting up nodes...`;
  for (let i = 0; i < nodes.length; i++) {
    
    const validatorInfo = await nodes[i].getValidatorInfo();
    const overloadedSlotId = `${contracts.operator.address}00000000000000000000000${i}`;

    process.stdout.write(`${msg} set slot ${i}`);
    await mine(
      contracts.governance.setSlot(
        overloadedSlotId,
        validatorInfo.ethAddress,
        `0x${validatorInfo.tendermintAddress}`,
        { gasLimit: 2000000 }
      )
    );

    process.stdout.write(`${msg} fund validator ${i}`);
    await mine(
      wallet.sendTransaction({
        to: validatorInfo.ethAddress,
        value: ethers.utils.parseEther('1'),
      })
    );
  }

  process.stdout.write(`${msg} set epoch length`);
  data = contracts.operator.interface.functions.setEpochLength.encode([nodes.length]);
  await mine(
    contracts.governance.propose(
      contracts.operator.address, data,
      {
        gasLimit: 2000000
      }
    )
  );

  process.stdout.write(`${msg} finalize`);
  await mine(contracts.governance.finalize({ gasLimit: 2000000 }));
  process.stdout.write(`${msg} done\n`);
};

module.exports.setupPlasma = async ({ contracts, accounts }) => {
  const alice = accounts[0].addr;

  const msg = `\r${' '.repeat(100)}\rSetting up plasma contracts...`;
  process.stdout.write(`${msg} add minter`);
  let data = contracts.token.interface.functions.addMinter.encode([alice]);
  await mine(contracts.governance.propose(contracts.token.address, data, { gasLimit: 2000000 }));
  await mine(contracts.governance.finalize());
  process.stdout.write(`${msg} mint token`);
  await mine(contracts.token.mint(alice, '500000000000000000000'));
  process.stdout.write(`${msg} set allowance for exitHandler`);
  await mine(contracts.token.approve(contracts.exitHandler.address, '500000000000000000000'));
  process.stdout.write(`${msg} set allowance for operator`);
  await mine(contracts.token.approve(contracts.operator.address, '500000000000000000000'));

  process.stdout.write(`${msg} set exit duration`);
  data = contracts.exitHandler.interface.functions.setExitDuration.encode([0]);
  await mine(
    contracts.governance.propose(
      contracts.exitHandler.address, data,
      {
        gasLimit: 2000000
      }
    )
  );
  process.stdout.write(`${msg} finalize`);
  await mine(contracts.governance.finalize({ gasLimit: 2000000 }));
  process.stdout.write(`${msg} done\n`);

}
