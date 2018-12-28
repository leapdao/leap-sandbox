const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { unspentForAddress, makeTransfer, periodOfTheBlock } = require('../src/helpers');
const { bufferToHex } = require('ethereumjs-util');

module.exports = async function(contracts, nodes, accounts, web3) {
    let unspents = [];
    unspents.push(await nodes[0].web3.getUnspent(accounts[0].addr));
    console.log(unspents[0]);
    unspents.push(await nodes[0].web3.getUnspent(accounts[1].addr));
    console.log(unspents[1]);
    const txHash = unspents[0][0].outpoint.hash;
    console.log(txHash);
    const txData = await nodes[0].web3.eth.getTransaction(bufferToHex(txHash));
    console.log(txData);
    const period = await periodOfTheBlock(nodes[0].web3, txData.blockNumber);
    console.log(period);
    console.log(period.proof(Tx.fromRaw(txData.raw)));
}