const { sleep } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer, transferUtxo } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[6].addr;
    const alicePriv = accounts[6].privKey;
    const bob = accounts[3].addr;
    const bobPriv = accounts[3].privKey;
    const zzz = accounts[9].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║Test: Transfer utxo after exit (negative) ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Exit Alice                             ║");
    console.log("║3. Try to transfer exited utxo            ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(5000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(`${alice} balance after deposit: ${plasmaBalanceAfter}`);
    console.log("Make some more deposits to make sure the block is submitted (with log is off)...")
    for (let i = 0; i < 32; i++) {
        await mintAndDeposit(zzz, i + 1, minter, contracts.token, contracts.exitHandler, true);
        await sleep(1000);
    }
    await sleep(3000);
    console.log("------Exit Alice------");
    const utxo = await exitUnspent(contracts, nodes[0], alice, accounts[0].addr);
    console.log("------Attemp to transfer exited utxo from Alice to Bob (should fail)------");
    let plasmaBalanceBefore = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    const bobBalanceBefore = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    await expect(transferUtxo(utxo, bob, alicePriv, nodes[0])).to.eventually.be.rejectedWith("Non zero error code returned: 2");
    plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    const bobBalanceAfter = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log("Alice balance after: ", plasmaBalanceAfter);
    expect(plasmaBalanceAfter).to.be.equal(plasmaBalanceBefore);
    expect(bobBalanceAfter).to.be.equal(bobBalanceBefore);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║Test: Transfer utxo after exit (negative) ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}