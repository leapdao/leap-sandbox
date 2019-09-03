const ethers = require('ethers');
const debug = require('debug');
const { helpers, Tx, Util } = require('leap-core');
const { bufferToHex } = require('ethereumjs-util');
const { bi, equal, subtract } = require('jsbi-utils');
const { assert } = require('chai');

const log = debug('exitUnspent');

const ERC20_ERC721_TRANSFER_EVENT = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const ERC1948_DATA_UPDATED_EVENT = '0x8ec06c2117d45dcb6bcb6ecf8918414a7ff1cb1ed07da8175e2cf638d0f4777f';

module.exports = async function(env, addr, uIndex) {
  const { contracts, nodes, wallet, plasmaWallet } = env;
  const node = nodes[0];

    let txHash;
    let txData;

    const msg = '\rExiting UTXO...';
    log(`------Unspents of ${addr}------`);
    const unspents = await node.getUnspent(addr);
    log(unspents);
    log("------Looking for unspent from submitted period------");
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

    const unspentIndex = uIndex === undefined || uIndex === null ? await getIndex(unspents, latestSubmittedBlock) : uIndex;

    if (unspentIndex === -1) {
        throw new Error("Can't exit, no unspents are in submitted periods found");
    };
    log(`------Will attept to exit unspent ${unspentIndex} of ${addr}------`);
    process.stdout.write(`${msg} getting tx proof`);
    const unspent = unspents[unspentIndex];
    txHash = unspent.outpoint.hash;
    txData = await node.getTransaction(bufferToHex(txHash));
    const amount = unspent.output.value;
    const txColor = unspent.output.color;
    log("Unspent amount: ", amount);
    log(`------Transaction hash for Bob's unspent ${unspentIndex}------`);
    log(txHash);
    log("------Transaction data------");
    log(txData);
    log("------Proof------");
    const proof = await helpers.getProof(plasmaWallet.provider, txData);
    log(proof);
    log("------Youngest Input------");
    process.stdout.write(`${msg} getting input proof`);
    const youngestInput = await helpers.getYoungestInputTx(node, Tx.fromRaw(txData.raw));
    log(youngestInput);
    let youngestInputProof;
    if (youngestInput.tx) {
        log("------Youngest Input Proof------");
        youngestInputProof = await helpers.getProof(plasmaWallet.provider, youngestInput.tx);
        log(youngestInputProof);
    } else {
        log("No youngest input found. Will try to exit deposit");
        youngestInputProof = [];
    }
    log("------Period from the contract by merkle root------");
    log(await contracts.bridge.periods(proof[0]));
    log("------Balance before exit------");
    const balanceBefore = await contracts.token.balanceOf(addr);
    const plasmaBalanceBefore = await node.getBalanceNum(addr);
    log("Account mainnet balance: ", balanceBefore);
    log("Account plasma balance: ", plasmaBalanceBefore);
    log("Attempting exit...");
    process.stdout.write(`${msg} submitting exit`);
    let startExitResult =
      await contracts.exitHandler.connect(wallet.provider.getSigner(addr)).startExit(
        youngestInputProof,
        proof,
        unspent.outpoint.index,
        youngestInput.index,
        { value: ethers.utils.parseEther('1'), gasLimit: 2000000 }
    );
    await startExitResult.wait();

    log("Finalizing exit...");
    process.stdout.write(`${msg} finalizing exit`);
    let exitResult =
      await contracts.exitHandler.connect(wallet.provider.getSigner(addr))
        .finalizeExits(txColor, { gasLimit: 2000000 });
    exitResult = await exitResult.wait();

    if (Util.isNFT(txColor) || Util.isNST(txColor)) {
      process.stdout.write(`${msg} checking events`);
      let nstUpdated = false;
      let nstTransferred = false;

      exitResult.events.forEach(
        (event) => {
          // update data
          if (event.topics[0] === ERC1948_DATA_UPDATED_EVENT) {
            if (equal(bi(event.topics[1]), bi(unspent.output.value))) {
              nstUpdated = true;
            }
            return;
          }

          // nft/nst transfer
          if (event.topics[0] === ERC20_ERC721_TRANSFER_EVENT) {
            if (equal(bi(event.topics[3]), bi(unspent.output.value))) {
              nstTransferred = true;
            }
            return;
          }
        }
      );
      console.log({nstUpdated, nstTransferred});
      // TODO: nst need a writedata event, or a breed
      if (Util.isNST(txColor)) {
        assert.equal(nstUpdated, true, 'nst should have data updated event');
      }
      assert.equal(nstTransferred, true, 'nft/nst should have been transferred');

      return unspent;
    }
    log("------Balance after exit------");
    const balanceAfter = await contracts.token.balanceOf(addr);
    log("Account mainnet balance: ", balanceAfter);
    
    const plasmaBalanceAfter = await node.advanceUntilTokenBalanceChange(
      addr, contracts.token.address, plasmaBalanceBefore, wallet, plasmaWallet, 
      `${msg} waiting for balance change`
    );
  
    log("Account plasma balance: ", plasmaBalanceAfter);

    const unspentsAfter = await node.getUnspent(addr);
    unspentsAfter.length.should.be.equal(unspents.length - 1);
    assert.equal(
      bi(plasmaBalanceAfter).toString(),
      subtract(bi(plasmaBalanceBefore), bi(amount)).toString()
    );
    process.stdout.write(`${msg} ✅ ${' '.repeat(50)}\n`);
    return unspent;
}
