const Web3 = require('web3');
const { helpers } = require('leap-core');

const { formatHostname, advanceBlocks, sleep } = require('./helpers');

let idCounter = 0;

class Node {
  constructor(hostname, jsonrpcPort) {
    this.id = idCounter++;
    this.web3 = helpers.extendWeb3(new Web3(formatHostname(hostname, jsonrpcPort)));
  }

  async send(method, params) {
    return await new Promise(
      (resolve, reject) => {
        this.web3.currentProvider.send(
          { jsonrpc: '2.0', id: 42, method: method, 'params': params },
          (err, res) => { if (err) { return reject(err); } resolve(res); }
        );
      }
    );
  }

  async sendTx(tx) {
    // workaround different transaction hashes (leap-core bug)
    let txHash;

    try {
      // web3 hangs here on invalid txs, trying to get receipt?
      // await this.web3.eth.sendSignedTransaction(tx.hex());
      const resp = await new Promise(
        (resolve, reject) => {
          this.web3.currentProvider.send(
            { jsonrpc: '2.0', id: 42, method: 'eth_sendRawTransaction', 'params': [tx.hex()] },
            (err, res) => { if (err) { return reject(err); } resolve(res); }
          );
        }
      );
      txHash = resp.result;
    } catch(e) {
      console.log(e);
    }

    if (txHash !== tx.hash()) {
      console.warn(`txHash(${txHash}) from rpc does not match local tx.hash(${tx.hash()})`);
    }

    let rounds = 50;
    while (rounds--) {
      let res = await this.web3.eth.getTransaction(txHash)

      if (res && res.blockHash) {
        return;
      }

      // wait ~100ms
      await new Promise((resolve) => setTimeout(() => resolve(), 100));
    }

    throw new Error('transaction not included in time');
  };

  async getBalance(addr) {
    return this.web3.eth.getBalance(addr).then(res => Number(res));
  }

  async advanceUntilChange(web3) {
    const currentBlock = await this.web3.eth.getBlockNumber();

    let colors = (await this.send('plasma_getColors', [true, false])).result;
    colors = colors.concat((await this.send('plasma_getColors', [false, true])).result);
    colors = colors.concat((await this.send('plasma_getColors', [false, false])).result);

    while (true) {
      const blockNumber = await this.web3.eth.getBlockNumber();

      if (blockNumber > currentBlock) {
        break;
      }

      let c = (await this.send('plasma_getColors', [true, false])).result;
      c = c.concat((await this.send('plasma_getColors', [false, true])).result);
      c = c.concat((await this.send('plasma_getColors', [false, false])).result);

      if (c.length !== colors.length) {
        break;
      }

      await advanceBlocks(1, web3);
      await sleep(100);
    }
  }
}

module.exports = Node;
