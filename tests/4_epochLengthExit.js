const debug = require('debug');
const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { mine, waitForChange } = require('../src/helpers');
chai.use(chaiAsPromised);

const log = debug('4_epochLengthExit');


module.exports = async function(env) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[7].addr;
    const alicePriv = accounts[7].privKey;
    const bob = accounts[6].addr;
    const amount = 10000000;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Change epochLength                     ║");
    console.log("║4. Exit Bob                               ║");
    console.log("╚══════════════════════════════════════════╝");
    
    await mintAndDeposit(accounts[7], amount, minter, contracts.token, 0, contracts.exitHandler, node, wallet, plasmaWallet);
    
    log("------Transfer from Alice to Bob------");
    let txAmount = Math.round(amount/(2000))+ Math.round(100 * Math.random());
    await transfer(
        alice, 
        alicePriv, 
        bob, 
        txAmount, 
        node);

    (await node.getState()).epochLength.should.be.equal(2);
    log("Changing epochLength...");
    const data = await contracts.operator.interface.functions.setEpochLength.encode([3]);
    const gov = contracts.governance.connect(wallet.provider.getSigner(minter));
    await mine(gov.propose(contracts.operator.address, data, { gasLimit: 2000000 }));

    // 2 weeks waiting period ;)
    await mine(gov.finalize({ gasLimit: 2000000 }));

    console.log('Waiting for epoch length to change..');
    await waitForChange(
        async () => (await node.getState()).epochLength,
        3,
        8000,
    );

    await minePeriod(env);
    log("------Exit Bob------");
    await exitUnspent(env, bob);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Exit after epochLength change    ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}
