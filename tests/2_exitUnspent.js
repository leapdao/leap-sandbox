const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { sleep, unspentForAddress, makeTransfer, periodOfTheBlock, getYoungestInputTx } = require('../src/helpers');
const { bufferToHex } = require('ethereumjs-util');

module.exports = async function(contracts, nodes, accounts, web3) {
    const alice = accounts[0].addr;
    const bob = accounts[2].addr;
    let unspentIndex = -1;
    let txHash;
    let txData;

    let unspents = [];
    console.log("------Unspents Alice------");
    unspents.push(await nodes[0].web3.getUnspent(alice));
    console.log(unspents[0]);
    console.log("------Unspents Bob------");
    unspents.push(await nodes[0].web3.getUnspent(bob));
    console.log(unspents[1]);
    console.log("------Looking for unspent from submitted period------");
    const latestBlockNumber = (await nodes[0].web3.eth.getBlock('latest')).number;
    console.log("Latest Block number: ", latestBlockNumber);
    const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    console.log("Latest submitted block number: ", latestSubmittedBlock);
    do {
        unspentIndex++;
        txHash = unspents[1][unspentIndex].outpoint.hash;
        txData = await nodes[0].web3.eth.getTransaction(bufferToHex(txHash));
    } while (txData.blockNumber > latestSubmittedBlock);
    console.log(`------Will attepmp to exit unspent ${unspentIndex} of Bob------`);
    console.log(`------Transaction hash for Bob's unspent ${unspentIndex}------`);
    console.log("Unspent amount: ", unspents[1][unspentIndex].output.value);
    console.log(txHash);
    console.log("------Transaction data------");
    console.log(txData);
    console.log("------Period------");
    const period = await periodOfTheBlock(nodes[0].web3, txData.blockNumber);
    console.log(period);
    console.log("------Proof------");
    const proof = period.proof(Tx.fromRaw(txData.raw));
    console.log(proof);
    console.log("------Youngest Input------");
    const youngestInput = await getYoungestInputTx(nodes[0].web3, Tx.fromRaw(txData.raw));
    console.log(youngestInput);
    console.log("------Youngest Input Period------");
    const youngestInputPeriod = await periodOfTheBlock(nodes[0].web3, youngestInput.tx.blockNumber);
    console.log(youngestInputPeriod);
    console.log("------Youngest Input Proof------");
    const youngestInputProof = youngestInputPeriod.proof(Tx.fromRaw(youngestInput.tx.raw));
    console.log(youngestInputProof);
    console.log("------Period from the contract by merkle root------");
    console.log(await contracts.bridge.methods.periods(proof[0]).call());
    console.log("------Balance before exit------");
    const balanceBefore = await contracts.token.methods.balanceOf(bob).call();
    console.log("Bob mainnet balance: ", balanceBefore);
    console.log("Bob plasma balance: ", await nodes[0].web3.eth.getBalance(bob));
    console.log("Attempting exit...");
    await contracts.exitHandler.methods.startExit(
        youngestInputProof,
        proof,
        unspents[1][0].outpoint.index,
        youngestInput.index
    ).send({from: bob, value: 0, gas: 2000000});
    console.log("Finilizing exit...");
    await contracts.exitHandler.methods.finalizeTopExit(0).send({from: bob, gas: 2000000});
    console.log("------Balance after exit------");
    const balanceAfter = await contracts.token.methods.balanceOf(bob).call();
    console.log("Bob mainnet balance: ", balanceAfter);
    await sleep(5000);
    console.log("Bob plasma balance: ", await nodes[0].web3.eth.getBalance(bob));
}