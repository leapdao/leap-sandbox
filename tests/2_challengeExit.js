const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const minePeriod = require('./actions/minePeriod');
const { helpers, Tx, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');

const log = debug('challengeExit');

module.exports = async function(env, addr, color) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[6].addr;
    const amount = 10000000;
    
    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Challenge exit after Transfer    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice                             ║");
    console.log("║4. Challenge Alice exit                   ║");
    console.log("╚══════════════════════════════════════════╝");

    await mintAndDeposit(accounts[2], amount, contracts.token, 0, contracts.exitHandler, wallet, plasmaWallet);
      
    // Alice makes a transfer to Bob
    const t1 = await transfer(alice, alicePriv, bob, '1000', node);   
    await minePeriod(env);


    const transfer1 = await node.getTransaction(bufferToHex(t1.hash()));
    const proofOfTransfer1 = await helpers.getProof( 
        plasmaWallet.provider, 
        transfer1, 
        {excludePrevHashFromProof: true }
    );


    // Now:
    // 1. Bob spends the utxo he got from Alice in transfer1.
    // 2. Bob starts an exit with the utxo he just sent to alice, using contract.exitHandler.startExit
    // 3. But we know the unspent-transaction-output (utxo) he is trying to exit is NOT unspent (he sent it to Alice)
    // 4. We use the proof that he spent the utxo in contract.exitHandler.challengeExit
    // 5. In the end, we make sure the Exit struct in the exitHandler contract was deleted (this means the challenge was successful)


    
}


