const { unspentForAddress } = require('../client');
const { helpers, Tx, Outpoint, Output } = require('leap-core');

module.exports = async function machineGun(contracts, nodes, accounts, web3) {
  const node = nodes[0];
  const alice = accounts[0].addr;
  const alicePriv = accounts[0].privKey;
  const bob = accounts[1].addr;
  const charlie = accounts[2].addr;

  for (let i = 0; i < 100; i += 1) {
    console.log('------');
    console.log((await node.getState()).balances);
    console.log('------');

    console.log(`From account: ${alice}`);
    console.log(`Balance: ${await node.web3.eth.getBalance(alice)}`);

    let latestBlockData = await node.web3.eth.getBlock('latest');
    console.log(`Latest block: ${JSON.stringify(latestBlockData, null, 2)}`);

    console.log(latestBlockData.number);
    latestBlockData = await node.web3.eth.getBlock(latestBlockData.number);
    console.log(
      `Latest block by number: ${JSON.stringify(latestBlockData, null, 2)}`
    );
    const transfer1 = await node.makeTransfer(
      alice,
      bob,
      1000 + Math.round(100 * Math.random()),
      0,
      alicePriv
    );
    await node.sendTx(transfer1.hex());
    console.log('Transfer:', transfer1.hex());
    console.log(transfer1.hash());
    const txData = await node.web3.eth.getTransaction(transfer1.hash());
    const blockData = await node.web3.eth.getBlock(txData.blockHash);
    console.log(`getTransaction: ${JSON.stringify(txData, null, 2)}`);
    console.log(`Block data: ${JSON.stringify(blockData, null, 2)}`);
    console.log('------');
    console.log((await node.getState()).balances);
    console.log('------');

    const transfer2 = await node.makeTransfer(
      alice,
      bob,
      1000,
      0,
      alicePriv
    );
    await node.sendTx(transfer2.hex());
    console.log('Transfer:', transfer2.hex());
    console.log('------');
    console.log((await node.getState()).balances);
    console.log('------');

    const consolidateAddress = async address => {
      console.log(await node.getState());
      const balance = await node.web3.eth.getBalance(address);
      const unspent = unspentForAddress(
        (await node.getState()).unspent,
        address,
        0
      ).map(u => ({
        output: u.output,
        outpoint: Outpoint.fromRaw(u.outpoint),
      }));
      const consolidateInputs = helpers.calcInputs(
        unspent,
        address,
        balance,
        0
      );
      const consolidateOutput = new Output(balance, address, 0);
      const consolidate = Tx.consolidate(consolidateInputs, consolidateOutput);
      await node.sendTx(consolidate.hex());
      console.log(await node.getState());
    };

    await consolidateAddress(charlie);

    latestBlockData = await node.web3.eth.getBlock('latest');
    console.log(latestBlockData.number);
  }
}