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
    const admin = accounts[1].addr;
    const alice = accounts[7].addr;
    const zzz = accounts[9].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Change epochLength                     ║");
    console.log("║3. Exit Alice                             ║");
    console.log("╚══════════════════════════════════════════╝");
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(5000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(`${alice} balance after deposit: ${plasmaBalanceAfter}`);
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
        await sleep(1000);
    }
    await sleep(3000);
    console.log("------Exit Alice------");
    const utxo = await exitUnspent(contracts, nodes[0], alice);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}