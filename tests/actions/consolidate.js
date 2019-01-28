const debug = require('debug')('consolidate');
const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { sleep, unspentForAddress, makeTransfer, } = require('../../src/helpers');
const { bi, equal, add } = require('jsbi-utils');
const { should, assert } = require('chai');

module.exports = async function(node, account) {

    const chunk = (arr, size) => arr.reduce((chunks, el, i) => (
        i % size 
        ? chunks[chunks.length - 1].push(el) 
        : chunks.push([el])) && chunks, []);
    
    const consolidateAddress = async address => {
        console.log("------Consolidating unspents------");
        console.log("Address: ", address);
        console.log("------Unspents before consolidate------");
        let unspentsAll = await node.web3.getUnspent(address);
        const unspents = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log("Number of UTXOs: ", unspents.length);
        console.log(unspents);
        const balanceBefore = await node.web3.eth.getBalance(address);
        console.log("Balance: ", balanceBefore);
        debug("Will split unspents to chunks of 15"); //15 is maximum number of inputs in one transaction
        const chunkedUnspents = chunk(unspents, 15);
        for (let i = 0; i < chunkedUnspents.length; i++) {
            debug(`------Consolidatating chunk ${i+1}------`);
            debug(chunkedUnspents[i]);
            const chunkBalance = chunkedUnspents[i].reduce((sum, unspent) => add(bi(sum), bi(unspent.output.value)), 0);
            debug(`Balance of chunk ${i+1}: ${chunkBalance}`);
            const consolidateInputs = helpers.calcInputs(
                chunkedUnspents[i],
                address,
                chunkBalance,
                0
            );
            const consolidateOutput = new Output(chunkBalance, address, 0);
            debug(`------Consolidatate transaction (chunk ${i+1})------`);
            const consolidate = Tx.consolidate(consolidateInputs, consolidateOutput);
            debug(consolidate);
            debug("Hex: ", consolidate.hex());
            await node.sendTx(consolidate.hex());
        }
        console.log("------Unspents after consolidate------");
        unspentsAll = await node.web3.getUnspent(address);
        const unspentsAfter = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log(unspentsAfter);
        const balanceAfter = await node.web3.eth.getBalance(address);
        console.log("Balance: ", balanceAfter);

        balanceAfter.should.be.equal(balanceBefore);
        const some = unspentsAfter.reduce((sum, unspent) => add(bi(sum), bi(unspent.output.value)), 0);
        const other = unspents.reduce((sum, unspent) => add(bi(sum), bi(unspent.output.value)), 0);
        assert(equal(some, other));
    };
  
    await consolidateAddress(account);
}