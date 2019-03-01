const { sleep, advanceBlocks } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const should = require('chai').should();

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

    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler, nodes[0], web3);

    console.log("------Will make some transactions to fill a block------");
    for (let i = 0; i < 20; i++) {
        let txAmount = Math.round(amount/(2000))+ Math.round(100 * Math.random());
        let balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
        let balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;

        await transfer(
            alice, 
            alicePriv, 
            bob, 
            txAmount, 
            nodes[0]);
        
        ((await nodes[0].web3.eth.getBalance(alice)) * 1).should.be.equal(balanceAlice - txAmount);
        ((await nodes[0].web3.eth.getBalance(bob)) * 1).should.be.equal(balanceBob + txAmount);
    }
    await minePeriod(nodes, accounts);
    console.log("------Exit Alice------");
    const validatorInfo = await nodes[0].web3.getValidatorInfo();
    await exitUnspent(contracts, nodes[0], alice, {slotId: 0, addr: validatorInfo.ethAddress}, web3);
    console.log("------Exit Bob------");
    await exitUnspent(contracts, nodes[0], bob, {slotId: 0, addr: validatorInfo.ethAddress}, web3);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Deposit, trasfer, then exit     ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}