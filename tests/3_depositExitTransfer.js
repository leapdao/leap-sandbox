const mintAndDeposit = require('./actions/mintAndDeposit');
const { transferUtxo } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;

module.exports = async function(contracts, [node], accounts, web3) {
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
    
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler, node, web3);
    
    await minePeriod(node, accounts);
    
    console.log("------Exit Alice------");
    const utxo = await exitUnspent(contracts, node, web3, alice);
    console.log("------Attemp to transfer exited utxo from Alice to Bob (should fail)------");
    let plasmaBalanceBefore = await node.getBalance(alice);
    const bobBalanceBefore = await node.getBalance(bob);
    await expect(transferUtxo(utxo, bob, alicePriv, node)).to.eventually.be.rejectedWith("Non zero error code returned: 2");
    plasmaBalanceAfter = await node.getBalance(alice);
    const bobBalanceAfter = await node.getBalance(bob);
    console.log("Alice balance after: ", plasmaBalanceAfter);
    expect(plasmaBalanceAfter).to.be.equal(plasmaBalanceBefore);
    expect(bobBalanceAfter).to.be.equal(bobBalanceBefore);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║Test: Transfer utxo after exit (negative) ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}