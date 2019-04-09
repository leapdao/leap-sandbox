const debug = require('debug')('transfer');
const { makeTransfer, makeTransferUxto } = require('../../src/helpers');
const expect = require('chai').expect;

async function transfer(alice, alicePriv, bob, amount, node) {
    console.log(`------Transfering ${amount} tokens from ${alice} to ${bob}------`);
    debug("------Transfer data------");
    const transfer = await makeTransfer(
      node,
      alice,
      bob,
      amount,
      0,
      alicePriv
    );
    debug(transfer);
    expect(transfer).not.to.be.undefined;
    await node.sendTx(transfer);
    debug('Transfer:', transfer.hex());
    debug(transfer.hash());
    const txData = await node.web3.eth.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    debug(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    debug(`Block data: ${JSON.stringify(blockData, null, 2)}`);

    return transfer;
}

async function transferUtxo(utxo, bob, alicePriv, node) {
    console.log(`------Transfering UTXO: ${utxo.output.value} tokens from ${utxo.output.address} to ${bob}------`);
    debug("------Transfer data------");
    const transfer = makeTransferUxto([utxo], bob, alicePriv);
    debug(transfer);
    expect(transfer).not.to.be.undefined;
    debug("------Send Tx response------");
    await node.sendTx(transfer);
    debug('Transfer:', transfer.hex());
    debug(transfer.hash());
    const txData = await node.web3.eth.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    debug(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    debug(`Block data: ${JSON.stringify(blockData, null, 2)}`);

    return transfer;
}

module.exports = { transfer, transferUtxo };
