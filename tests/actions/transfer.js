const debug = require('debug')('transfer');
const { makeTransfer, makeTransferUxto } = require('../../src/helpers');
const expect = require('chai').expect;

async function transfer(alice, alicePriv, bob, amount, node) {
    console.log(`------Transfering ${amount} tokens from ${alice} to ${bob}------`);
    console.log("------Balances before------");
    let state = await node.getState();
    console.log(state.balances);
    debug("------Transfer data------");
    const transfer = makeTransfer(
      state,
      alice,
      bob,
      amount,
      0,
      alicePriv
    );
    debug(transfer);
    expect(transfer).not.to.be.undefined;
    const response = await node.sendTx(transfer.hex());
    let errCode
    if(response.data.result) {
        errCode = response.data.result.check_tx.code;  
    } else {
        errCode = 9;
        console.log(response);
    }
    if(errCode) {
        throw new Error(`Non zero error code returned: ${errCode}`);
    }
    debug('Transfer:', transfer.hex());
    debug(transfer.hash());
    const txData = await node.web3.eth.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    debug(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    debug(`Block data: ${JSON.stringify(blockData, null, 2)}`);
    console.log("------Balances after------");
    console.log((await node.getState()).balances);
}

async function transferUtxo(utxo, bob, alicePriv, node) {
    console.log(`------Transfering UTXO: ${utxo.output.value} tokens from ${utxo.output.address} to ${bob}------`);
    console.log(utxo);
    console.log("------Balances before------");
    let state = await node.getState();
    console.log(state.balances);
    debug("------Transfer data------");
    const transfer = makeTransferUxto([utxo], bob, alicePriv);
    debug(transfer);
    expect(transfer).not.to.be.undefined;
    debug("------Send Tx response------");
    const response = await node.sendTx(transfer.hex());
    const errCode = response.data.result.check_tx.code;
    if(errCode) {
        console.log(`Transaction is not accepted. Non zero error code returned: ${errCode}`);
        throw new Error(`Non zero error code returned: ${errCode}`);
    }
    debug('Transfer:', transfer.hex());
    debug(transfer.hash());
    const txData = await node.web3.eth.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    debug(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    debug(`Block data: ${JSON.stringify(blockData, null, 2)}`);
    console.log("------Balances after------");
    console.log((await node.getState()).balances);
}

module.exports = { transfer, transferUtxo };