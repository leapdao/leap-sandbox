const Web3 = require('web3');
const axios = require('axios');
const { helpers } = require('leap-core');

const { formatHostname } = require('./helpers');

let idCounter = 0;

class Node {
  constructor(hostname, port, jsonrpcPort) {
    this.id = idCounter++;
    this.web3 = helpers.extendWeb3(new Web3(formatHostname(hostname, jsonrpcPort)));
    this.httpUrl = formatHostname(hostname, port);
  }

  async getState() {
    const { data } = await axios.get(this.httpUrl+'/state');
    return data;
  }

  async sendTx(rawTx) {
    return axios.post(this.httpUrl+'/txs', { encoded: rawTx });
  };

  async getBalance(addr) {
    return this.web3.eth.getBalance(addr).then(res => Number(res));
  }
}

module.exports = Node;