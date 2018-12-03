const { helpers, Output, Tx, Outpoint } = require('leap-core');
const Node = require('./client');

async function run() {
  console.log(Node);
  const node0 = new Node('localhost', 7000, 7001);
  console.log(await node0.getState());
  console.log(await node0.web3.getValidatorInfo());
  console.log(node0.id);

  const node1 = new Node('localhost', 7005, 7006);
  console.log(await node1.getState());
  console.log(await node1.web3.getValidatorInfo());
  console.log(node1.id);
}
run();