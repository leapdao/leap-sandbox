const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');

require('chai').should();

module.exports = async function(env) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[3].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice and Bob                     ║");
    console.log("╚══════════════════════════════════════════╝");

    await mintAndDeposit(accounts[2], amount, minter, contracts.token, 0, contracts.exitHandler, node, wallet, plasmaWallet);

    console.log("------Will make some transactions to fill a block------");
    for (let i = 0; i < 5; i++) {
        let txAmount = Math.round(amount/(2000))+ Math.round(100 * Math.random());
        let balanceAlice = await node.getBalance(alice);
        let balanceBob = await node.getBalance(bob);

        await transfer(
            alice, 
            alicePriv, 
            bob, 
            txAmount, 
            node);
        
        (await node.getBalance(alice)).should.be.equal(balanceAlice - txAmount);
        (await node.getBalance(bob)).should.be.equal(balanceBob + txAmount);
    }
    await minePeriod(env);
    console.log("------Exit Alice------");
    await exitUnspent(env, alice);
    console.log("------Exit Bob------");
    await exitUnspent(env, bob);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}
