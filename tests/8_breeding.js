const assert = require('assert');
const ethUtil = require('ethereumjs-util');
const { Tx, Input, Output, Outpoint } = require('leap-core');

const { advanceBlocks } = require('../src/helpers');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');

const TOKEN = require('../build/contracts/build/contracts/ERC1949.json');

const BreedingCondition =
  '6080604052348015600f57600080fd5b5060043610602b5760e060020a6000350463689dcafc81146030575b600080fd5b606960048036036080811015604457600080fd5b50803590600160a060020a03602082013581169160408101359160609091013516606b565b005b6040805160e060020a63451da9f902815260048101869052600160a060020a038581166024830152604482018590529151839283169163451da9f991606480830192600092919082900301818387803b15801560c657600080fd5b505af115801560d9573d6000803e3d6000fd5b50505050505050505056fea165627a7a72305820ff50695e9e2f7357f76cac1b8adb0d5d43b7930e23a23bdae6c9f81c5fcddfcc0029';

module.exports = async function(contracts, [node], accounts, web3) {
  const minter = accounts[0].addr;
  const minterPriv = accounts[0].privKey;

  console.log("Registering ERC1949");

  const beforeColors = (await node.send('plasma_getColors', [false, true])).result;
  console.log('Initial state');
  console.log('   Token count:', beforeColors.length);
  console.log('   Tokens:', beforeColors);

  console.log('Deploying ERC1949 token..');
  const contract = new web3.eth.Contract(TOKEN.abi);
  const deployedToken = await contract.deploy({ data: TOKEN.bytecode }).send({
    from: accounts[0].addr,
    gas: 1712388,
    gasPrice: 100000000000
  });
  console.log('   Address:', deployedToken.options.address);

  console.log('Submitting registerToken proposal..');
  const data = contracts.exitHandler.methods.registerNST(deployedToken.options.address).encodeABI();
  console.log('   Subject:', contracts.exitHandler.options.address)
  console.log('   Data:', data)
  await contracts.governance.methods.propose(contracts.exitHandler.options.address, data).send({
    from: minter, gas: 2000000, gasPrice: 100000000000
  });

  console.log('Finalizing proposal..');
  await contracts.governance.methods.finalize().send({
    from: minter, gas: 1000000, gasPrice: 100000000000 
  });

  // wait for event buffer
  await advanceBlocks(128, web3);

  const afterColors = (await node.send('plasma_getColors', [false, true])).result;
  console.log('Checking..', afterColors);

  assert.equal(afterColors.length, beforeColors.length + 1, 'Token count');
  console.log('   ✅ Token count:', afterColors.length);

  assert.deepEqual(
    beforeColors.concat([deployedToken.options.address]),
    afterColors,
    "getColors()"
  );
  console.log('   ✅ getColors(): ' + afterColors);

  const nstColor = ((2 ** 14) + (2 ** 15)) + afterColors.length;
  assert.equal(
    await node.web3.getColor(deployedToken.options.address),
    nstColor,
    "getColor()"
  );
  console.log(`   ✅ getColor(${deployedToken.options.address}): 1`);

  console.log('   Minting..');
  let res = await deployedToken.methods.mintQueen(minter).send({ from: minter, gas: 200000 });
  let tokenId = `0x${new ethUtil.BN(res.events.Transfer.returnValues.tokenId).toString('hex')}`;
  let tokenData = res.events.DataUpdated.returnValues.newData;
  console.log({ tokenId, tokenData });

  console.log('   Approving..');
  await deployedToken.methods.approve(contracts.exitHandler.options.address, tokenId).send({ from: minter });
  console.log('   Depositing..');
  await contracts.exitHandler.methods.depositBySender(tokenId, nstColor)
    .send(
      {
        from: minter,
        gas: 2000000,
      }
    );

  // why does it take so long?
  console.log('    advanceBlocks');
  await advanceBlocks(512, web3);

  let unspents = (await node.send('plasma_unspent', [minter, nstColor])).result;
  const unspentsLEAP = (await node.send('plasma_unspent', [minter, 0])).result;
  assert.equal(unspents[0].output.data, tokenData, 'tokenData should match');

  const script = Buffer.from(BreedingCondition, 'hex');
  const scriptHash = ethUtil.ripemd160(script);
  const spAddr = `0x${scriptHash.toString('hex')}`;
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
        spAddr,
        unspents[0].output.color,
        unspents[0].output.data,
      ),
    ],
  );
  transferTx.signAll(minterPriv);
  await node.sendTx(transferTx);

  const unspentsSp = (await node.send('plasma_unspent', [spAddr, nstColor])).result;
  const depositInput = new Outpoint(unspentsSp[0].outpoint.slice(0, -2), 0);
  const gasInput = new Outpoint(unspentsLEAP[0].outpoint.slice(0, -2), 0);
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
    `${deployedToken.options.address.replace('0x', '').toLowerCase()}`;

  condTx.inputs[0].setMsgData(msgData);
  condTx.signAll(minterPriv);

  let computedOutputs = (await node.send('checkSpendingCondition', [condTx.hex()])).result;
  computedOutputs.outputs.forEach(
    (output) => {
      condTx.outputs.push(Output.fromJSON(output));
    }
  );
  condTx.signAll(minterPriv);

  console.log('sending breeding condition');
  await node.sendTx(condTx);

  unspents = (await node.send('plasma_unspent', [minter, nstColor])).result;
  console.log('-----------------unspents--------------');
  console.log(unspents);
  console.log('what a bullshit, circumventing proof bug with youngestInputIndex > 0');
  transferTx = Tx.transfer(
    [
      new Input({
        prevout: new Outpoint(unspents[0].outpoint.slice(0, -2), parseInt(unspents[0].outpoint.slice(-2), 16)),
      }),
    ],
    [
      new Output(
        unspents[0].output.value,
        minter,
        unspents[0].output.color,
        unspents[0].output.data,
      ),
    ],
  );
  transferTx.signAll(minterPriv);
  await node.sendTx(transferTx);
  await minePeriod(node, accounts);

  unspents = (await node.send('plasma_unspent', [minter])).result;
  console.log(unspents);
  const utxo = await exitUnspent(contracts, node, web3, minter, unspents.length - 1);
  console.log(utxo);
}
