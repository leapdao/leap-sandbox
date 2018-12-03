const Web3 = require('web3');
const axios = require('axios');
const { helpers } = require('leap-core');

let idCounter = 0;

function formatHostname(hostname, port) {
  return 'http://'+hostname+':'+port;
}

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
}

module.exports = Node;