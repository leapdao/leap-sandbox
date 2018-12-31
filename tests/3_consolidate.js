const { helpers, Output, Outpoint, Tx } = require('leap-core');
const { sleep, unspentForAddress, makeTransfer, } = require('../src/helpers');

module.exports = async function(contracts, nodes, accounts, web3) {
    const bob = accounts[2].addr;

    const chunk = (arr, size) => arr.reduce((chunks, el, i) => (
        i % size 
        ? chunks[chunks.length - 1].push(el) 
        : chunks.push([el])) && chunks, []);
    
    const consolidateAddress = async address => {
        console.log("Address: ", address);
        console.log("------Unspents before consolidate------");
        let unspentsAll = await nodes[0].web3.getUnspent(bob);
        let unspents = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log("Number of UTXOs: ", unspents.length);
        console.log(unspents);
        let balance = await nodes[0].web3.eth.getBalance(address);
        console.log("Balance: ", balance);
        console.log("Will split unspents to chunks of 15"); //15 is maximum number of inputs in one transaction
        const chunkedUnspents = chunk(unspents, 15);
        for (let i = 0; i < chunkedUnspents.length; i++) {
            console.log(`------Consolidatating chunk ${i+1}------`);
            console.log(chunkedUnspents[i]);
            const chunkBalance = chunkedUnspents[i].reduce((sum, unspent) => sum + unspent.output.value, 0);
            console.log(`Balance of chunk ${i+1}: ${chunkBalance}`);
            const consolidateInputs = helpers.calcInputs(
                chunkedUnspents[i],
                address,
                chunkBalance,
                0
            );
            const consolidateOutput = new Output(chunkBalance, address, 0);
            console.log(`------Consolidatate transaction (chunk ${i+1})------`);
            const consolidate = Tx.consolidate(consolidateInputs, consolidateOutput);
            console.log(consolidate);
            console.log("Hex: ", consolidate.hex());
            await nodes[0].sendTx(consolidate.hex());
        }
        console.log("------Unspents after consolidate------");
        unspentsAll = await nodes[0].web3.getUnspent(bob);
        unspents = unspentsAll.filter(unspent => unspent.output.color === 0);
        console.log(unspents);
        balance = await nodes[0].web3.eth.getBalance(address);
        console.log("Balance: ", balance);
    };
  
    await consolidateAddress(bob);
}