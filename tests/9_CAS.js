const chai = require("chai");
const chaiAsPromised = require("chai-as-promised");

const exitUnspent = require('./actions/exitUnspent');
const minePeriod = require('./actions/minePeriod');
const { sleep } = require('../src/helpers');

chai.use(chaiAsPromised);
const expect = chai.expect;


module.exports = async function(contracts, [node1, node2], accounts, wallet) {
  const alice = accounts[0];
  const submissions = [];

  contracts.operator.on("Submission", (...args) => {
    console.log(args);
    submissions.push(args);
  });

  console.log('Restarting node 2 with PeriodVote disabled..');
  node2.stop();
  await node2.start({ NO_PERIOD_VOTE: true });
  await minePeriod(node1, accounts);
  console.log('Try to exit..');
  await sleep(4000);
  expect(submissions.length).to.equal(0);
  await expect(exitUnspent(contracts, node1, wallet, alice)).to.eventually.be.rejectedWith("");

  console.log('Restarting node 2 normally..');
  node2.stop()
  await node2.start();
  await minePeriod(node1, accounts);
  console.log('Try to exit again..');
  expect(submissions.length).to.equal(1);
  await exitUnspent(contracts, node1, wallet, alice);
}
