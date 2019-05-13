const { sleep, sendRawTx } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const should = require('chai').should();
const ethUtil = require('ethereumjs-util');
const hashLockConditionABI = require('../src/hashLockConditionABI');
const { helpers, Tx, Outpoint, Input, Output } = require('leap-core');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = '0xD6E3f12F578d2c9FcdEBc18E734bA50a5598E4eA';
    const bobPriv = accounts[3].privKey;
    const zzz = accounts[9].addr;
    const amount = 10000000;
    const spCode = '0x6080604052600436106100215760e060020a600035046344e03a1f8114610026575b600080fd5b61003961003436600461018a565b61003b565b005b60405160e060020a6370a082310281528190600090600160a060020a038316906370a082319061006f903090600401610204565b60206040518083038186803b15801561008757600080fd5b505afa15801561009b573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052506100bf91908101906101ce565b60405160e060020a63a9059cbb028152909150600160a060020a0383169063a9059cbb906101079073d6e3f12f578d2c9fcdebc18e734ba50a5598e4ea908590600401610218565b602060405180830381600087803b15801561012157600080fd5b505af1158015610135573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525061015991908101906101b0565b50505050565b600061016b8235610233565b9392505050565b600061016b8251610247565b600061016b8251610244565b60006020828403121561019c57600080fd5b60006101a8848461015f565b949350505050565b6000602082840312156101c257600080fd5b60006101a88484610172565b6000602082840312156101e057600080fd5b60006101a8848461017e565b6101f581610233565b82525050565b6101f581610244565b6020810161021282846101ec565b92915050565b6040810161022682856101ec565b61016b60208301846101fb565b6000600160a060020a038216610212565b90565b15159056fea265627a7a7230582016eb7dfab34ffb06a4f8e1f3e8d907783781990e5ab6687539e643253249c6f06c6578706572696d656e74616cf50037';
    const codeBuf = Buffer.from(spCode.replace('0x', ''), 'hex');
    const spAddrBuf = ethUtil.ripemd160(codeBuf);
    const spAddr = `0x${spAddrBuf.toString('hex')}`;

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Fund SP and claim from it       ║");
    console.log("║Steps:                                    ║");
    console.log("║1. Fund SP by Alice                       ║");
    console.log("║2. Claim from SP by Bob                   ║");
    console.log("╚══════════════════════════════════════════╝");
    let plasmaBalanceBefore = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler, true);
    await sleep(8000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore + amount);
    let txAmount = amount;
    let balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    let balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;

    const transferTx = await transfer(
        alice, 
        alicePriv, 
        spAddr, 
        txAmount, 
        nodes[0]);
        
    ((await nodes[0].web3.eth.getBalance(alice)) * 1).should.be.equal(balanceAlice - txAmount);
    ((await nodes[0].web3.eth.getBalance(spAddr)) * 1).should.be.equal(balanceSp + txAmount);
    console.log("Balances before SP TX:");
    let balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log('bob: ', balanceBob);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log('sp: ', balanceSp);


    const condTx = Tx.spendCond(
        [
          new Input({
            prevout: new Outpoint(transferTx.hash(), 0),
            gasPrice: 0,
            script: spCode,
          }),
        ],
        [new Output(amount, bob, 0)]
      );

    
    //const sig = condTx.getConditionSig(bobPriv);
    const condition = new web3.eth.Contract(hashLockConditionABI, spAddr);
    const msgData = (await condition.methods.fulfill(contracts.token.options.address))
        .encodeABI();
    console.log(msgData);  
    condTx.inputs[0].setMsgData(msgData);
    console.log(condTx.hex());
  
    resp = await sendRawTx(nodes[0].web3, condTx.hex());
    console.log(resp);
    await sleep(3000);  

    console.log("Balances after SP TX:");
    balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log('bob: ', balanceBob);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log('sp: ', balanceSp);

    if (balanceBob == 0) {
        throw Error('transfer failed');
    }

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Fund SP and claim from it       ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}