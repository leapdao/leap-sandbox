const { sleep, advanceBlocks } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer, transferUtxo } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");
chai.use(chaiAsPromised);
const expect = chai.expect;

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const admin = accounts[1].addr;
    const alice = accounts[7].addr;
    const alicePriv = accounts[7].privKey;
    const bob = accounts[6].addr;
    const zzz = accounts[9].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Change epochLength                     ║");
    console.log("║4. Exit Bob                               ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await advanceBlocks(10,web3);
    await sleep(4000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(`${alice} balance after deposit: ${plasmaBalanceAfter}`);
    console.log("------Transfer from Alice to Bob------");
    let txAmount = Math.round(amount/(2000))+ Math.round(100 * Math.random());
    await transfer(
        alice, 
        alicePriv, 
        bob, 
        txAmount, 
        nodes[0]);
    console.log("Changing epochLength...");
    const data = await contracts.operator.methods.setEpochLength(2).encodeABI();
    await contracts.governance.methods.propose(contracts.operator.options.address, data).send({
        from: minter,
        gas: 2000000
    });
    // 2 weeks waiting period ;)
    await contracts.governance.methods.finalize().send({
      from: minter,
      gas: 2000000
    });

    console.log("Make some more deposits to make sure the block is submitted (with log is off)...")
    for (let i = 0; i < 32; i++) {
        await mintAndDeposit(zzz, i + 1, minter, contracts.token, contracts.exitHandler, true);
        await advanceBlocks(10,web3);
        await sleep(4000);
    }
    await advanceBlocks(10,web3);
    await sleep(3000);
    console.log("------Exit Bob------");
    const validatorInfo = await nodes[0].web3.getValidatorInfo();
    const utxo = await exitUnspent(contracts, nodes[0], bob, {slotId: 0, addr: validatorInfo.ethAddress}, web3);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}