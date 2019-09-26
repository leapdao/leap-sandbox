const debug = require('debug');
const { makeTransfer, makeTransferUxto } = require('../../src/helpers');
const expect = require('chai').expect;

const log = debug('transfer');

async function transfer(alice, alicePriv, bob, amount, node) {
    log(`------Transfering ${amount} tokens from ${alice} to ${bob}------`);
    log("------Transfer data------");
    const transfer = await makeTransfer(
      node,
      alice,
      bob,
      amount,
      0,
      alicePriv
    );
    log(transfer);
    expect(transfer).not.to.be.undefined;
    await node.sendTx(transfer);
    log('Transfer:', transfer.hex());
    log(transfer.hash());
    const txData = await node.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    log(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.getBlock(txData.blockHash);
    log(`Block data: ${JSON.stringify(blockData, null, 2)}`);

    return transfer;
}

async function transferUtxo(utxo, bob, alicePriv, node) {
    log(`------Transfering UTXO: ${utxo.output.value} tokens from ${utxo.output.address} to ${bob}------`);
    log("------Transfer data------");
    const transfer = makeTransferUxto([utxo], bob, alicePriv);
    log(transfer);
    expect(transfer).not.to.be.undefined;
    log("------Send Tx response------");
    await node.sendTx(transfer);
    log('Transfer:', transfer.hex());
    log(transfer.hash());
    const txData = await node.getTransaction(transfer.hash());
    expect(txData, "Transaction not found").to.exist;
    log(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    const blockData = await node.getBlock(txData.blockHash);
    log(`Block data: ${JSON.stringify(blockData, null, 2)}`);

    return transfer;
}

module.exports = { transfer, transferUtxo };
