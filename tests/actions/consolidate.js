const debug = require('debug')('consolidate');
const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { sleep, unspentForAddress, makeTransfer, } = require('../../src/helpers');

module.exports = async function(node, account) {

    const chunk = (arr, size) => arr.reduce((chunks, el, i) => (
        i % size 
        ? chunks[chunks.length - 1].push(el) 
        : chunks.push([el])) && chunks, []);
    
    const consolidateAddress = async address => {
        console.log("------Consolidating unspents------");
        console.log("Address: ", address);
        console.log("------Unspents before consolidate------");
        let unspentsAll = await node.web3.getUnspent(bob);
        let unspents = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log("Number of UTXOs: ", unspents.length);
        console.log(unspents);
        let balance = await node.web3.eth.getBalance(address);
        console.log("Balance: ", balance);
        debug("Will split unspents to chunks of 15"); //15 is maximum number of inputs in one transaction
        const chunkedUnspents = chunk(unspents, 15);
        for (let i = 0; i < chunkedUnspents.length; i++) {
            debug(`------Consolidatating chunk ${i+1}------`);
            debug(chunkedUnspents[i]);
            const chunkBalance = chunkedUnspents[i].reduce((sum, unspent) => sum + unspent.output.value, 0);
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
        unspentsAll = await node.web3.getUnspent(bob);
        unspents = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log(unspents);
        balance = await node.web3.eth.getBalance(address);
        console.log("Balance: ", balance);
    };
  
    await consolidateAddress(account);
}