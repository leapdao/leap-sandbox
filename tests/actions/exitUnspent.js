const debug = require('debug')('exitUnspent');
const { helpers, Output, Outpoint, Tx, Period } = require('leap-core');
const { sleep, unspentForAddress, makeTransfer, getLog } = require('../../src/helpers');
const { bufferToHex } = require('ethereumjs-util');
const should = require('chai').should();

module.exports = async function(contracts, node, bob, validator, sleepTime = 5000, noLog = false) {
    const log = getLog(noLog);
    
    let txHash;
    let txData;

    log(`------Unspents of ${bob}------`);
    const unspents = await node.web3.getUnspent(bob);
    log(unspents);
    debug("------Looking for unspent from submitted period------");
    const latestBlockNumber = (await node.web3.eth.getBlock('latest')).number;
    debug("Latest Block number: ", latestBlockNumber);
    const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    debug("Latest submitted block number: ", latestSubmittedBlock);
    if (latestSubmittedBlock === 0) {
        throw new Error("Can't exit, no periods were submitted yet");
    };
    const unspentIndex = unspents.findIndex(async (unspent) => {
        txHash = unspent.outpoint.hash;
        txData = await node.web3.eth.getTransaction(bufferToHex(txHash));
        return txData.blockNumber < latestSubmittedBlock;
    });
    txHash = unspents[unspentIndex].outpoint.hash;
    txData = await node.web3.eth.getTransaction(bufferToHex(txHash));
    log(`------Will attept to exit unspent ${unspentIndex} of ${bob}------`);
    const amount = unspents[unspentIndex].output.value;
    log("Unspent amount: ", amount);
    debug(`------Transaction hash for Bob's unspent ${unspentIndex}------`);
    debug(txHash);
    debug("------Transaction data------");
    debug(txData);
    debug("------Period------");
    const period = await Period.periodForTx(node.web3, txData);
    debug(period);
    debug("------Proof------");
    const validatorInfo = await node.web3.getValidatorInfo();
    period.setValidatorData(0, validatorInfo.ethAddress);
    const proof = period.proof(Tx.fromRaw(txData.raw));
    debug(proof);
    debug("------Youngest Input------");
    const youngestInput = await helpers.getYoungestInputTx(node.web3, Tx.fromRaw(txData.raw));
    debug(youngestInput);
    let youngestInputProof;
    if(youngestInput.tx){
        debug("------Youngest Input Period------");
        const youngestInputPeriod = await Period.periodForTx(node.web3, youngestInput.tx);
        debug(youngestInputPeriod);
        debug("------Youngest Input Proof------");
        youngestInputPeriod.setValidatorData(0, validatorInfo.ethAddress);
        youngestInputProof = youngestInputPeriod.proof(Tx.fromRaw(youngestInput.tx.raw));
        debug(youngestInputProof);
    } else {
        debug("No youngest input found. Will try to exit deposit");
        youngestInputProof = [];
    }
    debug("------Period from the contract by merkle root------");
    debug(await contracts.bridge.methods.periods(proof[0]).call());
    log("------Balance before exit------");
    const balanceBefore = await contracts.token.methods.balanceOf(bob).call();
    const plasmaBalanceBefore = await node.web3.eth.getBalance(bob);
    log("Account mainnet balance: ", balanceBefore);
    log("Account plasma balance: ", plasmaBalanceBefore);
    log("Attempting exit...");
    await contracts.exitHandler.methods.startExit(
        youngestInputProof,
        proof,
        unspents[unspentIndex].outpoint.index,
        youngestInput.index
    ).send({from: bob, value: 0, gas: 2000000});
    log("Finalizing exit...");
    await contracts.exitHandler.methods.finalizeTopExit(0).send({from: bob, gas: 2000000});
    log("------Balance after exit------");
    const balanceAfter = await contracts.token.methods.balanceOf(bob).call();
    log("Account mainnet balance: ", balanceAfter);
    await sleep(sleepTime * 2);
    const plasmaBalanceAfter = (await node.web3.eth.getBalance(bob)) * 1;
    log("Account plasma balance: ", plasmaBalanceAfter);

    const unspentsAfter = await node.web3.getUnspent(bob);
    const unspentsValue = unspentsAfter.reduce((sum, unspent) => sum + unspent.output.value, 0);
    unspentsAfter.length.should.be.equal(unspents.length - 1);
    unspentsValue.should.be.equal(plasmaBalanceAfter);
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore - amount);
    (+ balanceAfter).should.be.equal(+ balanceBefore + amount);

    return unspents[unspentIndex];
}