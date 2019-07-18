const ethers = require('ethers');
const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const { Tx, Input, Output, Outpoint } = require('leap-core');

const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { mine } = require('../src/helpers');

const ERC1949 = require('../build/contracts/build/contracts/ERC1949.json');
const ERC20 = require('../build/contracts/build/contracts/NativeToken.json');

const BreedingCondition =
  '6080604052348015600f57600080fd5b5060043610602b5760e060020a6000350463689dcafc81146030575b600080fd5b606960048036036080811015604457600080fd5b50803590600160a060020a03602082013581169160408101359160609091013516606b565b005b6040805160e060020a63451da9f902815260048101869052600160a060020a038581166024830152604482018590529151839283169163451da9f991606480830192600092919082900301818387803b15801560c657600080fd5b505af115801560d9573d6000803e3d6000fd5b50505050505050505056fea165627a7a72305820ff50695e9e2f7357f76cac1b8adb0d5d43b7930e23a23bdae6c9f81c5fcddfcc0029';

module.exports = async function(contracts, [node], accounts, wallet) {
  const minter = accounts[0].addr;
  const minterPriv = accounts[0].privKey;

  // passports
  let factory = new ethers.ContractFactory(
    ERC1949.abi,
    ERC1949.bytecode,
    wallet
  );
  let countryToken = await factory.deploy({ gasLimit: 1712388, gasPrice: 100000000000 });
  await countryToken.deployed();
  let data = contracts.exitHandler.interface.functions.registerToken.encode([countryToken.address, 2]);
  await mine(
    contracts.governance.propose(
      contracts.exitHandler.address, data,
      { gasLimit: 2000000, gasPrice: 100000000000 }
    )
  );
  await mine(contracts.governance.finalize({ gasLimit: 1000000, gasPrice: 100000000000 }));

  // co2
  factory = new ethers.ContractFactory(
    ERC20.abi,
    ERC20.bytecode,
    wallet
  );
  const co2Token = await factory.deploy(
    'CO2', 'CO2', 18,
    {
      gasLimit: 1712388,
      gasPrice: 100000000000,
    }
  );
  await co2Token.deployed();
  data = contracts.exitHandler.interface.functions.registerToken.encode([co2Token.address, 0]);
  await mine(
    contracts.governance.propose(
      contracts.exitHandler.address, data,
      { gasLimit: 2000000, gasPrice: 100000000000 }
    )
  );
  await mine(contracts.governance.finalize({ gasLimit: 1000000, gasPrice: 100000000000 }));

  // goellars
  const goellarsToken = await factory.deploy(
    'Goellars', 'goe', 18,
    {
      gasLimit: 1712388,
      gasPrice: 100000000000,
    }
  );
  await goellarsToken.deployed();
  data = contracts.exitHandler.interface.functions.registerToken.encode([goellarsToken.address, 0]);
  await mine(
    contracts.governance.propose(
      contracts.exitHandler.address, data,
      { gasLimit: 2000000, gasPrice: 100000000000 }
    )
  );
  await mine(contracts.governance.finalize({ gasLimit: 1000000, gasPrice: 100000000000 }));
  // wait for event buffer
  await node.advanceUntilChange(wallet);

  // read results
  const afterColors = (await node.provider.send('plasma_getColors', [false, false]));
  const leapColor = afterColors.length - 3;
  const co2Color = afterColors.length - 2;
  const goellarsColor = afterColors.length - 1;
  console.log('LEAP: ', afterColors[leapColor], leapColor);
  console.log('CO2: ', afterColors[co2Color], co2Color);
  console.log('GOELLERS: ', afterColors[goellarsColor], goellarsColor);

  const nstAfterColors = (await node.provider.send('plasma_getColors', [false, true]));
  const nstColor = ((2 ** 14) + (2 ** 15)) + nstAfterColors.length;
  console.log('Passports: ', nstAfterColors[nstAfterColors.length - 1], nstColor);

  // minting and depositing passport A
  let res = await countryToken.mintDelegate(minter, { gasLimit: 200000 });
  res = await res.wait();
  let tokenIdA = res.events[0].args.tokenId.toHexString();
  let tokenData = res.events[1].args.newData;
  
  await mine(countryToken.approve(contracts.exitHandler.address, tokenIdA));
  await mine(
    contracts.exitHandler.depositBySender(
      tokenIdA, nstColor,
      {
        gasLimit: 2000000,
      }
    )
  );
  // minting and depositing passport B
  res = await countryToken.mintDelegate(minter, { gasLimit: 200000 });
  res = await res.wait();
  let tokenIdB = res.events[0].args.tokenId.toHexString();
  tokenData = res.events[1].args.newData;
  
  await mine(countryToken.approve(contracts.exitHandler.address, tokenIdB));
  await mine(
    contracts.exitHandler.depositBySender(
      tokenIdB, nstColor,
      {
        gasLimit: 2000000,
      }
    )
  );
  console.log('passportA', tokenIdA);
  console.log('passportB', tokenIdB);

  // minting and depositing tokens
  const co2Amount = 20000000000;
  res = await co2Token.mint(minter, co2Amount, { gasLimit: 200000 });
  res = await res.wait();
  await mine(co2Token.approve(contracts.exitHandler.address, co2Amount));
  await mine(
    contracts.exitHandler.depositBySender(
      co2Amount, co2Color,
      {
        gasLimit: 2000000,
      }
    )
  );
  const goellarsAmount = 20000000000;
  res = await goellarsToken.mint(minter, goellarsAmount, { gasLimit: 200000 });
  res = await res.wait();
  await mine(goellarsToken.approve(contracts.exitHandler.address, goellarsAmount));
  await mine(
    contracts.exitHandler.depositBySender(
      goellarsAmount, goellarsColor,
      {
        gasLimit: 2000000,
      }
    )
  );
  await node.advanceUntilChange(wallet);
  console.log('priv: ', minterPriv);
  console.log(node);
}
