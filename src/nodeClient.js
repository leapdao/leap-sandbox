const Web3 = require('web3');
const { helpers } = require('leap-core');

const { formatHostname } = require('./helpers');

let idCounter = 0;

class Node {
  constructor(hostname, port, jsonrpcPort) {
    this.id = idCounter++;
    this.web3 = helpers.extendWeb3(new Web3(formatHostname(hostname, jsonrpcPort)));
    this.httpUrl = formatHostname(hostname, port);
  }

  async sendTx(tx) {
    try {
      // web3 hangs here on invalid txs, trying to get receipt?
      // await this.web3.eth.sendSignedTransaction(tx.hex());
      await new Promise(
        (resolve, reject) => {
          this.web3.currentProvider.send(
            { jsonrpc: '2.0', id: 42, method: 'eth_sendRawTransaction', 'params': [tx.hex()] },
            (err, res) => { if (err) { return reject(err); } resolve(res); }
          );
        }
      );
    } catch(e) {
      console.log(e);
    }

    let rounds = 50;
    while (rounds--) {
      let res = await this.web3.eth.getTransaction(tx.hash())

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
}

module.exports = Node;
