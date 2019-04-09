const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const should = require('chai').should();
const ethUtil = require('ethereumjs-util');
const spendingConditionABI = require('../src/spendingConditionABI');
const { helpers, Tx, Outpoint, Input, Output } = require('leap-core');

module.exports = async function(contracts, nodes, accounts, web3) {
  const alice = accounts[0].addr;
  const alicePriv = accounts[0].privKey;
  const bob = accounts[1].addr;
  const bobPriv = accounts[1].privKey;
  const amount = 10000000;
  const spCode = '0x608060405234801561001057600080fd5b506004361061002e5760e060020a600035046341c9a5ea8114610033575b600080fd5b61006e6004803603608081101561004957600080fd5b50803590602081013590604081013560ff169060600135600160a060020a0316610070565b005b60408051600080825260208083018085526c010000000000000000000000006bffffffffffffffffffffffff193082021604905260ff86168385015260608301889052608083018790529251909260019260a080820193601f1981019281900390910190855afa1580156100e8573d6000803e3d6000fd5b505060408051601f198101517f70a082310000000000000000000000000000000000000000000000000000000082523060048084018290529351919550869450926000929091600160a060020a038616916370a08231916024808301926020929190829003018186803b15801561015e57600080fd5b505afa158015610172573d6000803e3d6000fd5b505050506040513d602081101561018857600080fd5b505181151561019357fe5b04905060008184600160a060020a03166370a08231856040518263ffffffff1660e060020a0281526004018082600160a060020a0316600160a060020a0316815260200191505060206040518083038186803b1580156101f257600080fd5b505afa158015610206573d6000803e3d6000fd5b505050506040513d602081101561021c57600080fd5b5051604080517fa9059cbb000000000000000000000000000000000000000000000000000000008152600160a060020a03898116600483015260248201879052915193909203935086169163a9059cbb916044808201926020929091908290030181600087803b15801561028f57600080fd5b505af11580156102a3573d6000803e3d6000fd5b505050506040513d60208110156102b957600080fd5b505060008111156103545783600160a060020a031663a9059cbb84836040518363ffffffff1660e060020a0281526004018083600160a060020a0316600160a060020a0316815260200182815260200192505050602060405180830381600087803b15801561032757600080fd5b505af115801561033b573d6000803e3d6000fd5b505050506040513d602081101561035157600080fd5b50505b50505050505050505056fea165627a7a723058208007f5a72195df8bb6daad1a81961769daceaf4d35b9944529bb957a6b3be8050029';
  const codeBuf = Buffer.from(spCode.replace('0x', ''), 'hex');
  const spAddrBuf = ethUtil.ripemd160(codeBuf);
  const spAddr = `0x${spAddrBuf.toString('hex')}`;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Test: Fund SP and claim from it       ║");
  console.log("║Steps:                                    ║");
  console.log("║1. Fund SP by Alice                       ║");
  console.log("║2. Claim from SP by Bob                   ║");
  console.log("╚══════════════════════════════════════════╝");

  let balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
  let balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;

  const transferTx = await transfer(
    alice, 
    alicePriv, 
    spAddr, 
    amount, 
    nodes[0]);

  ((await nodes[0].web3.eth.getBalance(alice)) * 1).should.be.equal(balanceAlice - amount);
  ((await nodes[0].web3.eth.getBalance(spAddr)) * 1).should.be.equal(balanceSp + amount);
  console.log("Balances before SP TX:");
  let balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
  console.log('bob: ', balanceBob);
  balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
  console.log('sp: ', balanceSp);

  const unspents = await nodes[0].web3.getUnspent(spAddr);
  const condTx = Tx.spendCond(
    [
      new Input({
        prevout: unspents[0].outpoint,
        gasPrice: 0,
        script: spCode,
      }),
    ],
    [new Output(amount / 4, bob, 0),
      new Output(balanceSp - (amount / 4), spAddr, 0)]
  );

  const sig = condTx.getConditionSig(bobPriv);
  const condition = new web3.eth.Contract(spendingConditionABI, spAddr);
  const msgData = (await condition.methods.fulfil(`0x${sig.r.toString('hex')}`, `0x${sig.s.toString('hex')}`, sig.v, contracts.token.options.address))
    .encodeABI();
  condTx.inputs[0].setMsgData(msgData);

  await nodes[0].sendTx(condTx);

  console.log("Balances after SP TX:");
  balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
  console.log('bob: ', balanceBob);
  balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
  console.log('sp: ', balanceSp);

  if (balanceBob == 0) {
    throw Error('transfer failed');
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Test: Fund SP and claim from it       ║");
  console.log("║             Completed                    ║");
  console.log("╚══════════════════════════════════════════╝");
}
