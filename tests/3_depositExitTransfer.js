const debug = require('debug');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const mintAndDeposit = require('./actions/mintAndDeposit');
const { transferUtxo } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
chai.use(chaiAsPromised);
const expect = chai.expect;

const log = debug('3_depositExitTransfer');


module.exports = async function(env) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[6].addr;
    const alicePriv = accounts[6].privKey;
    const bob = accounts[3].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║Test: Transfer utxo after exit (negative) ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Exit Alice                             ║");
    console.log("║3. Try to transfer exited utxo            ║");
    console.log("╚══════════════════════════════════════════╝");
    
    await mintAndDeposit(accounts[6], amount, minter, contracts.token, 0, contracts.exitHandler, wallet, plasmaWallet);
    
    await minePeriod(env);
    
    log("------Exit Alice------");
    const utxo = await exitUnspent(env, alice);
    log("------Attemp to transfer exited utxo from Alice to Bob (should fail)------");
    let plasmaBalanceBefore = await node.getBalance(alice);
    const bobBalanceBefore = await node.getBalance(bob);
    await expect(transferUtxo(utxo, bob, alicePriv, node)).to.eventually.be.rejectedWith("Transaction not included in block after 5 secs.");
    plasmaBalanceAfter = await node.getBalance(alice);
    const bobBalanceAfter = await node.getBalance(bob);
    log("Alice balance after: ", plasmaBalanceAfter);
    expect(plasmaBalanceAfter.toString()).to.be.equal(plasmaBalanceBefore.toString());
    expect(bobBalanceAfter.toString()).to.be.equal(bobBalanceBefore.toString());

    console.log("╔══════════════════════════════════════════╗");
    console.log("║Test: Transfer utxo after exit (negative) ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}
