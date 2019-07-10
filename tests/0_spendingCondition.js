const { transfer } = require('./actions/transfer');
const ethUtil = require('ethereumjs-util');
const spendingConditionABI = require('../src/spendingConditionABI');
const { Tx, Input, Output } = require('leap-core');

module.exports = async function(contracts, nodes, accounts, wallet) {
  const alice = accounts[0].addr;
  const alicePriv = accounts[0].privKey;
  const bob = accounts[1].addr;
  const bobPriv = accounts[1].privKey;
  const spCode = '0x608060405234801561001057600080fd5b506004361061002e5760e060020a6000350463d01a81e18114610033575b600080fd5b61005f6004803603604081101561004957600080fd5b50600160a060020a038135169060200135610061565b005b6040805160e060020a6370a08231028152306004820152905173111111111111111111111111111111111111111191600091849184916370a0823191602480820192602092909190829003018186803b1580156100bd57600080fd5b505afa1580156100d1573d6000803e3d6000fd5b505050506040513d60208110156100e757600080fd5b50516040805160e060020a63a9059cbb028152600160a060020a03888116600483015260248201889052915193909203935084169163a9059cbb916044808201926020929091908290030181600087803b15801561014457600080fd5b505af1158015610158573d6000803e3d6000fd5b505050506040513d602081101561016e57600080fd5b505060008111156101f8576040805160e060020a63a9059cbb028152306004820152602481018390529051600160a060020a0384169163a9059cbb9160448083019260209291908290030181600087803b1580156101cb57600080fd5b505af11580156101df573d6000803e3d6000fd5b505050506040513d60208110156101f557600080fd5b50505b5050505056fea165627a7a72305820b6375cb3c7f659844afea0adf999ea78d73fd047f5823fbe1447f8051fe0189b0029'.replace('1111111111111111111111111111111111111111', contracts.token.address.replace('0x', '').toLowerCase());
  const codeBuf = Buffer.from(spCode.replace('0x', ''), 'hex');
  const spAddrBuf = ethUtil.ripemd160(codeBuf);
  const spAddr = `0x${spAddrBuf.toString('hex')}`;

  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Test: Fund SP and claim from it       ║");
  console.log("║Steps:                                    ║");
  console.log("║1. Fund SP by Alice                       ║");
  console.log("║2. Claim from SP by Bob                   ║");
  console.log("╚══════════════════════════════════════════╝");

  let balanceAlice = await nodes[0].getBalance(alice);
  let balanceSp = await nodes[0].getBalance(spAddr);
  let amount = 100000000;

  // for gas
  await transfer(
    alice, 
    alicePriv, 
    spAddr, 
    amount, 
    nodes[0]);

  // for the actual transfer
  await transfer(
    alice, 
    alicePriv, 
    spAddr, 
    amount, 
    nodes[0]);

  (await nodes[0].getBalance(alice)).should.be.equal(balanceAlice - (amount * 2));
  (await nodes[0].getBalance(spAddr)).should.be.equal(balanceSp + (amount * 2));

  console.log("Balances before SP TX:");
  let balanceBob = await nodes[0].getBalance(bob);
  console.log('bob: ', balanceBob);
  balanceSp = await nodes[0].getBalance(spAddr);
  console.log('sp: ', balanceSp);

  const unspents = await nodes[0].getUnspent(spAddr);
  const condTx = Tx.spendCond(
    [
      // gas
      new Input({
        prevout: unspents[0].outpoint,
        gasPrice: 0,
        script: spCode,
      }),
      // actual token input
      new Input({
        prevout: unspents[1].outpoint,
      }),
    ],
    [
      new Output(amount, bob, 0),
      // the leftover from gas input
      new Output(94177716, spAddr, 0),
    ]
  );

  const amountBuf = ethUtil.setLengthLeft(ethUtil.toBuffer(amount), 32);
  const msgData =
    '0xd01a81e1' + // function called
    `000000000000000000000000${bob.replace('0x', '').toLowerCase()}${amountBuf.toString(
        'hex'
      )}`; // outputs

  condTx.inputs[0].setMsgData(msgData);
  // XXX: leap-core bug
  // not if that makes a difference, but if the input is not signed we later get problems in exit (needs fixing)
  condTx.signAll(bobPriv);

  // let computedOutputs = await nodes[0].provider.send('checkSpendingCondition', [condTx.hex()]);
  // console.log(computedOutputs);
  // console.log(computedOutputs.outputs);
  // computedOutputs.outputs.forEach(
  //  (output) => {
  //    condTx.outputs.push(Output.fromJSON(output));
  //  }
  // );

  await nodes[0].sendTx(condTx);

  console.log("Balances after SP TX:");
  balanceBob = await nodes[0].getBalance(bob);
  console.log('bob: ', balanceBob);
  balanceSp = await nodes[0].getBalance(spAddr);
  console.log('sp: ', balanceSp);

  if (balanceBob == 0) {
    throw Error('transfer failed');
  }

  console.log("╔══════════════════════════════════════════╗");
  console.log("║    Test: Fund SP and claim from it       ║");
  console.log("║             Completed                    ║");
  console.log("╚══════════════════════════════════════════╝");
}
