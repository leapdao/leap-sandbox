const debug = require('debug');
const ethers = require('ethers');
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
    
    await minePeriod(env);
    
    const unspents = await node.getUnspent(addr, color);
    const latestBlockNumber = (await node.getBlock('latest')).number;
    log("Latest Block number: ", latestBlockNumber);
    const latestSubmittedBlock = latestBlockNumber - latestBlockNumber % 32;
    log("Latest submitted block number: ", latestSubmittedBlock);
    if (latestSubmittedBlock === 0) {
        throw new Error("Can't exit, no periods were submitted yet");
    };
    
      const getIndex = async (unspents, lastBlock) =>{
        for(let i=0; i<unspents.length; i++) {
            txHash = unspents[i].outpoint.hash;
            txData = await node.getTransaction(bufferToHex(txHash));
            log("Unspent", i, "blocknumber:", txData.blockNumber);
            log("Is submitted?", txData.blockNumber < lastBlock);
            if (txData.blockNumber < lastBlock) return i;
        }
    
        return -1;
    };

    
    const unspentIndex = await getIndex(unspents, latestSubmittedBlock);

    if (unspentIndex === -1) {
        throw new Error("Can't exit, no unspents are in submitted periods found");
    };
    
    const unspent = unspents[unspentIndex];

    
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
    
    //await minePeriod(env);
    
    const youngestInput = await helpers.getYoungestInputTx(node, Tx.fromRaw(transfer1.raw));
   /*
    const youngestInputProof = await helpers.getProof( 
        plasmaWallet.provider, 
        youngestInput,  
        {excludePrevHashFromProof: true }
    );
    */
    
   // await minePeriod(env);
    
   // console.log('youngest input', youngestInput);
   // console.log('transfer 1' , transfer1);
   // console.log('proofOfTransfer1', proofOfTransfer1);

    // Now:
    // 1. Bob spends the utxo he got from Alice in transfer1.
    // 2. Bob starts an exit with the utxo he just sent to alice, using contract.exitHandler.startExit
    // 3. But we know the unspent-transaction-output (utxo) he is trying to exit is NOT unspent (he sent it to Alice)
    // 4. We use the proof that he spent the utxo in contract.exitHandler.challengeExit
    // 5. In the end, we make sure the Exit struct in the exitHandler contract was deleted (this means the challenge was successful)

      const t2 = await transfer(bob, bobPriv, charlie, '200', node);   
      await minePeriod(env);
    
      const transfer2 = await node.getTransaction(bufferToHex(t2.hash()));
       const proofOfTransfer2 = await helpers.getProof( 
        plasmaWallet.provider, 
        transfer2, 
        {excludePrevHashFromProof: true }
     );
   
  /* 
    let startExitResult =
      await contracts.exitHandler.connect(wallet.provider.getSigner(addr)).startExit(
        youngestInputProof,
        proofOfTransfer2,
        unspent.outpoint.index,
        youngestInput.index,
        { value: ethers.utils.parseEther('1'), gasLimit: 2000000 }
    );
    console.log(await startExitResult.wait());
    */
   
       //const utxoId = exitUtxoId(event);
       //console.log('transfer 1', transfer1);
       //assert.equal(utxoId, spendTx.inputs[0].prevout.getUtxoId());
    
       //assert.equal((await contracts.exitHandler.exits(utxoId))[2], bob);
    
      // await contracts.exitHandler.challengeExit(proofOfTransfer1, proofOfTransfer1, 0, 0, alice);
       
        // check exit was evicted from PriorityQueue
        //assert.equal((await contracts.exitHandler.tokens(0))[1], 0);
}


