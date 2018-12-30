const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { unspentForAddress, makeTransfer, periodOfTheBlock, getYoungestInputTx } = require('../src/helpers');
const { bufferToHex } = require('ethereumjs-util');

module.exports = async function(contracts, nodes, accounts, web3) {
    const alice = accounts[0].addr;
    const bob = accounts[2].addr;

    let unspents = [];
    console.log("------Unspents Alice------");
    unspents.push(await nodes[0].web3.getUnspent(alice));
    console.log(unspents[0]);
    console.log("------Unspents Bob------");
    unspents.push(await nodes[0].web3.getUnspent(bob));
    console.log(unspents[1]);
    console.log("------Will attepmp to exit unspent 1 of Bob------");
    console.log("------Transaction hash for Bob's unspent 1------");
    console.log("Unspent amount: ", unspents[1][0].output.value);
    const txHash = unspents[1][0].outpoint.hash;
    console.log(txHash);
    console.log("------Transaction data------");
    const txData = await nodes[0].web3.eth.getTransaction(bufferToHex(txHash));
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
    console.log("------Balance before exit------");
    const balanceBefore = await contracts.token.methods.balanceOf(bob).call();
    console.log("Bob mainnet balance: ", balanceBefore);
    console.log("Attempting exit...");
    await contracts.exitHandler.methods.startExit(
        youngestInputProof,
        proof,
        unspents[1][0].outpoint.index,
        youngestInput.index
    ).send({from: bob, value: 0});
    console.log("Finilizing exit...");
    await contracts.exitHandler.methods.finalizeTopExit(0).send({from: bob});
    console.log("------Balance after exit------");
    const balanceAfter = await contracts.token.methods.balanceOf(bob).call();
    console.log("Bob mainnet balance: ", balanceAfter);
}