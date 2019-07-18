const ethers = require('ethers');
const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const { Tx, Input, Output, Outpoint } = require('leap-core');

const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { mine } = require('../src/helpers');

const ERC1949 = require('../build/contracts/build/contracts/ERC1949.json');
const ERC20 = require('../build/contracts/build/contracts/NativeToken.json');

let GameCondition =
  '608060405234801561001057600080fd5b50600436106100445760e060020a60003504637f565aab8114610049578063c521fbac1461011e578063e3fa500f146101c2575b600080fd5b61011c600480360360e081101561005f57600080fd5b813591602081013591810190606081016040820135602060020a81111561008557600080fd5b82018360208201111561009757600080fd5b803590602001918460018302840111602060020a831117156100b857600080fd5b91908080601f01602080910402602001604051908101604052809392919081815260200183838082843760009201919091525092955050823593505050602081013563ffffffff16906040810135600160a060020a0390811691606001351661026d565b005b61011c6004803603602081101561013457600080fd5b810190602081018135602060020a81111561014e57600080fd5b82018360208201111561016057600080fd5b803590602001918460018302840111602060020a8311171561018157600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550610797945050505050565b61011c600480360360408110156101d857600080fd5b81359190810190604081016020820135602060020a8111156101f957600080fd5b82018360208201111561020b57600080fd5b803590602001918460018302840111602060020a8311171561022c57600080fd5b91908080601f016020809104026020016040519081016040528093929190818152602001838380828437600092019190915250929550610937945050505050565b6000829050600081600160a060020a03166337ebbc038a6040518263ffffffff1660e060020a0281526004018082815260200191505060206040518083038186803b1580156102bb57600080fd5b505afa1580156102cf573d6000803e3d6000fd5b505050506040513d60208110156102e557600080fd5b50516040805160e160020a6331a9108f028152600481018c90529051919250828a039173234111111111111111111111111111111111123491829163a9059cbb91600160a060020a03881691636352211e91602480820192602092909190829003018186803b15801561035757600080fd5b505afa15801561036b573d6000803e3d6000fd5b505050506040513d602081101561038157600080fd5b50516040805160e060020a63ffffffff8516028152600160a060020a039092166004830152602482018690525160448083019260209291908290030181600087803b1580156103cf57600080fd5b505af11580156103e3573d6000803e3d6000fd5b505050506040513d60208110156103f957600080fd5b50506040805160e160020a6331a9108f028152600481018a905290518691600160a060020a038085169263a9059cbb9291851691636352211e916024808301926020929190829003018186803b15801561045257600080fd5b505afa158015610466573d6000803e3d6000fd5b505050506040513d602081101561047c57600080fd5b50516040805163ffffffff84811660e060020a028252600160a060020a039093166004820152918c1660248301525160448083019260209291908290030181600087803b1580156104cc57600080fd5b505af11580156104e0573d6000803e3d6000fd5b505050506040513d60208110156104f657600080fd5b81019080805190602001909291905050505084600160a060020a03166336c9c4578d8d8d6040518463ffffffff1660e060020a0281526004018084815260200183815260200180602001828103825283818151815260200191508051906020019080838360005b8381101561057557818101518382015260200161055d565b50505050905090810190601f1680156105a25780820380516001836020036101000a031916815260200191505b50945050505050600060405180830381600087803b1580156105c357600080fd5b505af11580156105d7573d6000803e3d6000fd5b50505050600081600160a060020a03166337ebbc038b6040518263ffffffff1660e060020a0281526004018082815260200191505060206040518083038186803b15801561062457600080fd5b505afa158015610638573d6000803e3d6000fd5b505050506040513d602081101561064e57600080fd5b50516040805160e060020a63a983d43f028152600481018d905263ffffffff8c16830160248201529051919250600160a060020a0384169163a983d43f9160448082019260009290919082900301818387803b1580156106ad57600080fd5b505af11580156106c1573d6000803e3d6000fd5b5050505060648411806106da575060648963ffffffff16115b15610788576040805160e060020a63a9059cbb028152734561111111111111111111111111111111111456600482015263ffffffff8b1686016024820152905173123111111111111111111111111111111111112391829163a9059cbb916044808201926020929091908290030181600087803b15801561075a57600080fd5b505af115801561076e573d6000803e3d6000fd5b505050506040513d602081101561078457600080fd5b5050505b50505050505050505050505050565b60006107b96001606060020a0319606060020a3002168363ffffffff610a3e16565b9050600160a060020a0381167356711111111111111111111111111111111115671461082a576040805160e560020a62461bcd0281526020600482015260156024820152605b60020a740e6d2cedccae440c8decae640dcdee840dac2e8c6d02604482015290519081900360640190fd5b6040805160e060020a6370a0823102815230600482015290517312311111111111111111111111111111111111239160009183916370a08231916024808301926020929190829003018186803b15801561088357600080fd5b505afa158015610897573d6000803e3d6000fd5b505050506040513d60208110156108ad57600080fd5b50516040805160e060020a63a9059cbb028152306004820152602481018390529051919250600160a060020a0384169163a9059cbb916044808201926020929091908290030181600087803b15801561090557600080fd5b505af1158015610919573d6000803e3d6000fd5b505050506040513d602081101561092f57600080fd5b505050505050565b60006109596001606060020a0319606060020a3002168363ffffffff610a3e16565b9050600160a060020a038116735671111111111111111111111111111111111567146109ca576040805160e560020a62461bcd0281526020600482015260156024820152605b60020a740e6d2cedccae440c8decae640dcdee840dac2e8c6d02604482015290519081900360640190fd5b6040805160e060020a63a9059cbb028152734561111111111111111111111111111111111456600482015260248101859052905173123111111111111111111111111111111111112391829163a9059cbb916044808201926020929091908290030181600087803b15801561090557600080fd5b60008060008084516041141515610a5b5760009350505050610b10565b50505060208201516040830151606084015160001a601b60ff82161015610a8057601b015b8060ff16601b14158015610a9857508060ff16601c14155b15610aa95760009350505050610b10565b6040805160008152602080820180845289905260ff8416828401526060820186905260808201859052915160019260a0808401939192601f1981019281900390910190855afa158015610b00573d6000803e3d6000fd5b5050506020604051035193505050505b9291505056fea165627a7a72305820feaf3bf059276dcc45b2f77ccb7777c0fc048cf6644a001ea38f4c7f6ccbcd6c0029';

function replaceAll(str, find, replace) {
    return str.replace(new RegExp(find, 'g'), replace.replace('0x', ''));
}

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
  await node.advanceUntilChange(wallet);

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
  await node.advanceUntilChange(wallet);
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
  GameCondition = replaceAll(GameCondition, '1231111111111111111111111111111111111123', co2Token.address);
  GameCondition = replaceAll(GameCondition, '2341111111111111111111111111111111111234', goellarsToken.address);
  GameCondition = replaceAll(GameCondition, '4561111111111111111111111111111111111456', minter);
  const script = Buffer.from(GameCondition, 'hex');
  const scriptHash = ethUtil.ripemd160(script);
  const earthAddr = `0x${scriptHash.toString('hex')}`;

  let unspents = (await node.provider.send('plasma_unspent', [minter, co2Color]));
  // XXX: add support for approval in ERC1949
  let transferTx = Tx.transfer(
    [
      new Input({
        prevout: new Outpoint(unspents[0].outpoint.slice(0, -2), 0),
      }),
    ],
    [
      new Output(
        unspents[0].output.value,
        earthAddr,
        unspents[0].output.color,
      ),
    ],
  );
  transferTx.signAll(minterPriv);
  await node.sendTx(transferTx);

  unspents = (await node.provider.send('plasma_unspent', [minter, goellarsColor]));
  // XXX: add support for approval in ERC1949
  transferTx = Tx.transfer(
    [
      new Input({
        prevout: new Outpoint(unspents[0].outpoint.slice(0, -2), 0),
      }),
    ],
    [
      new Output(
        unspents[0].output.value,
        earthAddr,
        unspents[0].output.color,
      ),
    ],
  );
  transferTx.signAll(minterPriv);
  await node.sendTx(transferTx);


  console.log('earth address: ', earthAddr);
  console.log('priv: ', minterPriv);
  console.log(node);
}
