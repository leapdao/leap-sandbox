const Web3 = require('web3');
const axios = require('axios');
const { helpers, Tx, Outpoint } = require('leap-core');

let idCounter = 0;

function formatHostname(hostname, port) {
  return 'http://'+hostname+':'+port;
}

function unspentForAddress(unspent, address, color) {
  return Object.keys(unspent)
    .filter(
      k =>
        unspent[k] &&
        unspent[k].address.toLowerCase() === address.toLowerCase() &&
        (color !== undefined ? unspent[k].color === color : true)
    )
    .map(k => ({
      outpoint: k,
      output: unspent[k],
    }))
    .sort((a, b) => {
      return a.output.value - b.output.value;
    });
};

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

  async makeTransfer(
    from,
    to,
    amount,
    color,
    privKey
  ) {

    const state = await this.getState();
    const balances = state.balances;
    const unspent = state.unspent;

    let fromAddr = from.toLowerCase();
    to = to.toLowerCase();

    const colorBalances = balances[color] || {};
    const balance = colorBalances[fromAddr] || 0;

    if (balance < amount) {
      throw new Error('Insufficient balance');
    }

    const senderUnspent = unspentForAddress(unspent, from, color).map(u => ({
      output: u.output,
      outpoint: Outpoint.fromRaw(u.outpoint),
    }));

    const inputs = helpers.calcInputs(senderUnspent, from, amount, color);
    const outputs = helpers.calcOutputs(
      senderUnspent,
      inputs,
      fromAddr,
      to,
      amount,
      color
    );
    return Tx.transfer(inputs, outputs).signAll(privKey);
  }

  async sendTx(rawTx) {
    return axios.post(this.httpUrl+'/txs', { encoded: rawTx });
  };
}

module.exports = {Node, formatHostname, unspentForAddress};