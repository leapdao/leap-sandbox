const fs = require('fs');
const ethers = require('ethers');
const { mine } = require('./helpers');

const { generatedConfigPath } = require('./getEnv');

const setValidator = require('leap-guardian/scripts/setValidator')

const heartbeatToken = require('../build/contracts/build/contracts/HeartbeatToken');

module.exports.setupValidators = async (
  { contracts, nodes, wallet, accounts, plasmaWallet, networkConfig }
) => {
  const msg = `\r${' '.repeat(100)}\rSetting up nodes...`;

  for (let i = 0; i < nodes.length; i++) {
    const validatorInfo = await nodes[i].getValidatorInfo();
    await setValidator(i, validatorInfo.tendermintAddress, validatorInfo.ethAddress, 0, {
      plasmaWallet, nodeConfig: networkConfig, rootWallet: wallet
    });
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

module.exports.setupPlasma = async ({ contracts, accounts, wallet }) => {
  const alice = accounts[0].addr;

  const msg = `\r${' '.repeat(100)}\rSetting up plasma contracts...`;
  let data;
  const noHeartbeat = !!process.argv.find(a => a === '--noHeartbeat');
  if (!noHeartbeat) {
    process.stdout.write(`${msg} mint heartbeat token`);
    const heartbeatColor = 32769;
    const { abi, bytecode } = heartbeatToken;
    const hbtFactory = new ethers.ContractFactory(abi, bytecode, wallet);
    const { contractAddress } = await hbtFactory.deploy().then(({ deployTransaction }) => deployTransaction.wait());
    
    process.stdout.write(`${msg} register heartbeat token`);
    data = contracts.exitHandler.interface.functions.registerToken.encode([contractAddress, 1]);
    await mine(contracts.governance.propose(contracts.exitHandler.address, data));
    data = contracts.operator.interface.functions.setHeartbeatParams.encode([1, heartbeatColor]);
    await mine(contracts.governance.propose(contracts.operator.address, data));
    await mine(contracts.governance.finalize());

    const config = require(generatedConfigPath);
    config.heartbeat = { color: heartbeatColor };
    fs.writeFileSync(generatedConfigPath, JSON.stringify(config, null, 2));
  }

  process.stdout.write(`${msg} add minter`);
  data = contracts.token.interface.functions.addMinter.encode([alice]);
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
