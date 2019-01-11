const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const transfer = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[3].addr;
    const zzz = accounts[9].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice and Bob                     ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(5000);
    console.log(`${alice} balance after deposit: ${await nodes[0].web3.eth.getBalance(alice)}`);
    console.log("------Will make some transactions to fill a block------");
    for (let i = 0; i < 20; i++) {
        await transfer(
            alice, 
            alicePriv, 
            bob, 
            Math.round(amount/(2000))+ Math.round(100 * Math.random()), 
            nodes[0]);
    }
    console.log("Make some more deposits to make sure the block is submitted (with log is off)...")
    for (let i = 0; i < 20; i++) {
        await mintAndDeposit(zzz, 1, minter, contracts.token, contracts.exitHandler, true);
        await sleep(1000);
    }
    await sleep(3000);
    console.log("------Exit Alice------");
    await exitUnspent(contracts, nodes[0], alice);
    console.log("------Exit Bob------");
    await exitUnspent(contracts, nodes[0], bob);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}