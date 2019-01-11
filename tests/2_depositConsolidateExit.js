const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const consolidate = require('./actions/consolidate');
const exitUnspent = require('./actions/exitUnspent');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const zzz = accounts[9].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Deposit, consolidate, then exit  ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice 2x                    ║");
    console.log("║2. Consolidate Alice                      ║");
    console.log("║3. Exit Alice                             ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(5000);
    console.log(`${alice} balance after deposit: ${await nodes[0].web3.eth.getBalance(alice)}`);
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler); //second deposit so there will be 2 utxo to consolidate
    await sleep(5000);
    console.log(`${alice} balance after deposit: ${await nodes[0].web3.eth.getBalance(alice)}`);
    await consolidate(nodes[0], alice);
    console.log(`${alice} balance after consolidate: ${await nodes[0].web3.eth.getBalance(alice)}`);
    console.log("Make some more deposits to make sure the block is submitted (with log is off)...")
    for (let i = 0; i < 32; i++) {
        await mintAndDeposit(zzz, 1, minter, contracts.token, contracts.exitHandler, true);
        await sleep(1000);
    }
    await sleep(3000);
    console.log("------Exit Alice------");
    await exitUnspent(contracts, nodes[0], alice);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Deposit, consolidate, then exit  ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}