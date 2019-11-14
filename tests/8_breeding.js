
const ethers = require('ethers');
const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const debug = require('debug');
const { Tx, Input, Output, Outpoint } = require('leap-core');

const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { mine } = require('../src/helpers');

const log = debug('8_breeding');

const TOKEN = require('../build/contracts/build/contracts/ERC1949.json');

const BreedingCondition =
  '6080604052348015600f57600080fd5b5060043610602b5760e060020a6000350463689dcafc81146030575b600080fd5b606960048036036080811015604457600080fd5b50803590600160a060020a03602082013581169160408101359160609091013516606b565b005b6040805160e060020a63451da9f902815260048101869052600160a060020a038581166024830152604482018590529151839283169163451da9f991606480830192600092919082900301818387803b15801560c657600080fd5b505af115801560d9573d6000803e3d6000fd5b50505050505050505056fea165627a7a72305820ff50695e9e2f7357f76cac1b8adb0d5d43b7930e23a23bdae6c9f81c5fcddfcc0029';
  '608060405234801561001057600080fd5b506004361061002e5760e060020a6000350463451da9f98114610033575b600080fd5b6100656004803603606081101561004957600080fd5b50803590600160a060020a036020820135169060400135610067565b005b6040805160e060020a63451da9f902815260048101859052600160a060020a038416602482015260448101839052905173123333333333333333333333333333333333332191829163451da9f99160648082019260009290919082900301818387803b1580156100d657600080fd5b505af11580156100ea573d6000803e3d6000fd5b505060408051600160a060020a038716815290518793507f8693a8d4f4b468f54fa30f7e254ab2a8c338a23009da9882c3df9b34f3bd093492509081900360200190a25050505056fea165627a7a723058208d4050b06c2068c074ee5cdbb3453d4189d18cd37d8cc60e1d45920aef078df70029';

module.exports = async function(env) {
  const { contracts, nodes, accounts, wallet } = env;
  const node = nodes[0];

  const minter = accounts[0].addr;
  const minterPriv = accounts[0].privKey;

  console.log("\nTest: Breeding");
  console.log('Plan:');
  console.log('  1. Mint and deposit ERC1949 Queen');
  console.log('  2. Execute BreedingCondition');
  console.log('  3. Exit');

  console.log("Registering ERC1949..");

  const beforeColors = (await node.getColors('nst'));
  console.log('Initial state');
  console.log('   Token count:', beforeColors.length);
  console.log('   Tokens:', JSON.stringify(beforeColors));

  console.log('Deploying ERC1949 token..');
  let factory = new ethers.ContractFactory(
    TOKEN.abi,
    TOKEN.bytecode,
    wallet
  );
  let deployedToken = await factory.deploy("qwe", "QWE");
  await deployedToken.deployed();
  console.log('   Address:', deployedToken.address);

  console.log('Submitting registerToken proposal..');
  const data = contracts.exitHandler.interface.functions.registerToken.encode([deployedToken.address, 2]);
  log('   Subject:', contracts.exitHandler.address);
  log('   Data:', data);
  const gov = contracts.governance.connect(wallet.provider.getSigner(minter));
  await mine(
    gov.propose(
      contracts.exitHandler.address, data,
      { gasLimit: 2000000, gasPrice: 100000000000 }
    )
  );

  console.log('Finalizing proposal..');
  await mine(contracts.governance.finalize({ gasLimit: 1000000, gasPrice: 100000000000 }));

  // wait for event buffer
  await node.advanceUntilChange(wallet);

  const afterColors = (await node.getColors('nst'));

  console.log('Checking..', afterColors);

  assert.equal(afterColors.length, beforeColors.length + 1, 'Token count');
  console.log('   ✅ Token count:', afterColors.length);

  assert.deepEqual(
    beforeColors.concat([deployedToken.address]),
    afterColors,
    "getColors()"
  );
  console.log('   ✅ getColors(): ' + afterColors);

  const nstColor = ((2 ** 14) + (2 ** 15)) + afterColors.length;
  assert.equal(
    await node.getColor(deployedToken.address),
    nstColor,
    "getColor()"
  );
  console.log(`   ✅ getColor(${deployedToken.address}): 1`);

  console.log('   Minting..');
  let res = await deployedToken.mintDelegate(minter);
  res = await res.wait();
  let tokenId = res.events[0].args.tokenId.toHexString();
  let tokenData = res.events[1].args.newData;
  log({ tokenId, tokenData });

  console.log('   Approving..');
  await mine(deployedToken.approve(contracts.exitHandler.address, tokenId));
  console.log('   Depositing..');
  await mine(
    contracts.exitHandler.depositBySender(
      tokenId, nstColor,
      {
        gasLimit: 2000000,
      }
    )
  );

  await node.advanceUntilChange(wallet);

  let unspents = (await node.getUnspent(minter, nstColor));
  assert.equal(unspents[0].output.data, tokenData, 'tokenData should match');

  const script = Buffer.from(BreedingCondition, 'hex');
  const scriptHash = ethUtil.ripemd160(script);
  const spAddr = `0x${scriptHash.toString('hex')}`;
  // XXX: add support for approval in ERC1949
  let transferTx = Tx.transfer(
    [
      new Input({
        prevout: new Outpoint(unspents[0].outpoint.hash, 0),
      }),
    ],
    [
      new Output(
        unspents[0].output.value,
        spAddr,
        unspents[0].output.color,
        unspents[0].output.data,
      ),
    ],
  );
  transferTx.signAll(minterPriv);
  await node.sendTx(transferTx);

  const unspentsLEAP = (await node.getUnspent(minter, 0));
  const unspentsSp = (await node.getUnspent(spAddr, nstColor));
  const depositInput = new Outpoint(unspentsSp[0].outpoint.hash, 0);

  let gasInput;
  unspentsLEAP.forEach(
    (unspent) => {
      if (unspent.output.value > 1000000000) {
        gasInput = new Outpoint(unspent.outpoint.hash, unspent.outpoint.index);
      }
    }
  );
  const condTx = Tx.spendCond(
    [
      new Input({
        prevout: gasInput,
        script,
      }),
      new Input({
        prevout: depositInput,
      }),
    ],
    []
  );
  const msgData =
    '0x689dcafc' + // function called
    `${tokenId.replace('0x', '')}000000000000000000000000${
    minter.replace('0x','').toLowerCase()
    }0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000` +
    `${deployedToken.address.replace('0x', '').toLowerCase()}`;

  condTx.inputs[0].setMsgData(msgData);
  condTx.signAll(minterPriv);

  let computedOutputs = (await node.checkSpendingCondition(condTx));
  computedOutputs.outputs.forEach(
    (output) => {
      condTx.outputs.push(Output.fromJSON(output));
    }
  );
  condTx.signAll(minterPriv);

  console.log('sending breeding condition');
  await node.sendTx(condTx);
  const rsp = await node.send('eth_getTransactionReceipt', [condTx.hash()]);
  assert(rsp.logs && rsp.logs.length > 0, 'no events emitted');

  log('-----------------unspents--------------');
  await minePeriod(env);

  unspents = (await node.getUnspent(minter, nstColor));
  log(unspents);
  const utxo = await exitUnspent(env, minter, nstColor);
  log(utxo);
}
