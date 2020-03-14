const debug = require('debug');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { helpers, Tx, Util, Input, Output, Outpoint } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');

require('chai').should();

const log = debug('challengeExit');

module.exports = async function(env, addr, color) {
    const { contracts, nodes, accounts, wallet, plasmaWallet } = env;
    const node = nodes[0];
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[6].addr;
    const bobPriv = accounts[6].privKey;
    const charlie = accounts[4].addr;
    const charliePriv = accounts[6].privKey;
    const amount = 10000000;
    
    console.log("╔══════════════════════════════════════════╗");
    console.log("║   Test: Challenge exit after Transfer    ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Deposit to Alice                       ║");
    console.log("║2. Trasfer from Alice to Bob              ║");
    console.log("║3. Exit Alice                    ║");
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

       const spendTx = Tx.transfer(
          [new Input(new Outpoint(t1.hash(), 0))],
          [new Output(50, charlie)]
        ).sign([bobPriv]);
    
      const period = await submitNewPeriod([t1, spendTx]);

       const spendProof = period.proof(spendTx);
       
       const event = await exitHandler.startExit(proofOfTransfer1, spendProof, 0, 0, { from: bob, value: exitStake })
       
       const utxoId = exitUtxoId(event);
       assert.equal(utxoId, spendTx.inputs[0].prevout.getUtxoId());
    
       assert.equal((await exitHandler.exits(utxoId))[2], bob);
    
       await exitHandler.challengeExit(proofOfTransfer1, spendProof, 0, 0, alice);
       
        // check exit was evicted from PriorityQueue
        assert.equal((await exitHandler.tokens(0))[1], 0);
}


