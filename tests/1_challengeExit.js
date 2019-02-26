const { Tx, Input, Output, Outpoint, Period, helpers } = require('leap-core');
const assert = require("assert");

const challenge = require('../scripts/challenge');

const mintAndDeposit = require('./actions/mintAndDeposit');
const { sleep, unspentForAddress } = require('../src/helpers');

module.exports = async function(contracts, nodes, accounts, web3) {

  const minter = accounts[0].addr;
  const alice = accounts[2].addr;
  const alicePriv = accounts[2].privKey;
  const challenger = accounts[3].addr;
  const challengerPriv = accounts[3].privKey;
  const zzz = accounts[9].addr;
  const amount = 10000000;
  const color = 0;
  const node = nodes[0];

  await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
  await sleep(8000);

  // Make first transfer
  let state = await node.getState();
  let aliceUnspent = unspentForAddress(state.unspent, alice, color).map(u => ({
    output: u.output,
    outpoint: Outpoint.fromRaw(u.outpoint),
  }));
  let inputs = [new Input(aliceUnspent[0].outpoint)];
  let outputs = [new Output(amount, alice.toLowerCase(), color)];
  let firstTransfer = Tx.transfer(inputs, outputs).signAll(alicePriv);

  await node.sendTx(firstTransfer.hex());
  await sleep(3000);

  // Make second transfer
  state = await node.getState();
  aliceUnspent = unspentForAddress(state.unspent, alice, color).map(u => ({
    output: u.output,
    outpoint: Outpoint.fromRaw(u.outpoint),
  }));
  inputs = [new Input(aliceUnspent[0].outpoint)];
  outputs = [new Output(amount, alice.toLowerCase(), color)];
  let secondTransfer = Tx.transfer(inputs, outputs).signAll(alicePriv);

  await node.sendTx(secondTransfer.hex());
  await sleep(3000);

  state = await node.getState();

  console.log("Make some more deposits to make sure the block is submitted (with log is off)...")
  for (let i = 0; i < 20; i++) {
    await mintAndDeposit(zzz, i + 1, minter, contracts.token, contracts.exitHandler, true);
    await sleep(1000);
  }
  await sleep(3000);

  // Make sure the period was submitted
  const latestBlockNumber = (await node.web3.eth.getBlock('latest')).number;
  const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
  if (latestSubmittedBlock === 0) {
    throw new Error("Can't exit, no periods were submitted yet");
  };

  //exit
  let txData = await node.web3.eth.getTransaction(firstTransfer.hash());
  const validatorInfo = await node.web3.getValidatorInfo();
  const proof = await helpers.getProof(node.web3, txData, 0, validatorInfo.ethAddress);
  const youngestInputTx = await helpers.getYoungestInputTx(node.web3, Tx.fromRaw(txData.raw));
  const inputProof = await helpers.getProof(node.web3, youngestInputTx.tx, 0, validatorInfo.ethAddress);

  console.log("Attempting exit...");
  const exitTx = await contracts.exitHandler.methods.startExit(
      inputProof,
      proof,
      0,
      youngestInputTx.index
  ).send({from: alice, value: 100000000000000000, gas: 2000000});
  const utxoId = new Outpoint(firstTransfer.hash(), 0).getUtxoId();
  let exit = await contracts.exitHandler.methods.exits(utxoId).call();
  
  assert(exit.owner.toLowerCase() === alice.toLowerCase());

  await challenge(firstTransfer.hash(), 
    secondTransfer.hash(), 
    node.web3.currentProvider.host, 
    web3.currentProvider.host, 
    challengerPriv,
    validatorInfo.ethAddress);

  exit = await contracts.exitHandler.methods.exits(utxoId).call();

  assert(exit.owner !== alice);

}