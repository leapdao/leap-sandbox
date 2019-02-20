const { sleep, sendRawTx } = require('../src/helpers');
const mintAndDeposit = require('./actions/mintAndDeposit');
const { transfer } = require('./actions/transfer');
const exitUnspent = require('./actions/exitUnspent');
const should = require('chai').should();
const ethUtil = require('ethereumjs-util');
const spendingConditionABI = require('../src/spendingConditionABI');
const { helpers, Tx, Outpoint, Input, Output } = require('leap-core');

module.exports = async function(contracts, nodes, accounts, web3) {
    const minter = accounts[0].addr;
    const alice = accounts[2].addr;
    const alicePriv = accounts[2].privKey;
    const bob = accounts[3].addr;
    const bobPriv = accounts[3].privKey;
    const zzz = accounts[9].addr;
    const amount = 10000000;
    const spCode = '0x608060405234801561001057600080fd5b506004361061002e5760e060020a600035046341c9a5ea8114610033575b600080fd5b61006e6004803603608081101561004957600080fd5b50803590602081013590604081013560ff169060600135600160a060020a0316610070565b005b60408051600080825260208083018085526001606060020a0319606060020a300216905260ff86168385015260608301889052608083018790529251909260019260a080820193601f1981019281900390910190855afa1580156100d8573d6000803e3d6000fd5b505060408051601f1981015160e060020a6370a082310282523060048301529151919350849250600091600160a060020a038416916370a08231916024808301926020929190829003018186803b15801561013257600080fd5b505afa158015610146573d6000803e3d6000fd5b505050506040513d602081101561015c57600080fd5b50519050600060048204905082600160a060020a031663a9059cbb85836040518363ffffffff1660e060020a0281526004018083600160a060020a0316600160a060020a0316815260200182815260200192505050602060405180830381600087803b1580156101cb57600080fd5b505af11580156101df573d6000803e3d6000fd5b505050506040513d60208110156101f557600080fd5b505081036000811115610281576040805160e060020a63a9059cbb028152306004820152602481018390529051600160a060020a0385169163a9059cbb9160448083019260209291908290030181600087803b15801561025457600080fd5b505af1158015610268573d6000803e3d6000fd5b505050506040513d602081101561027e57600080fd5b50505b505050505050505056fea165627a7a723058202a26c66e256a60aa809db9f665a264a777d3d2cb2a88a3fbf6ee337e00796c9e0029';
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
    await mintAndDeposit(alice, amount, minter, contracts.token, contracts.exitHandler);
    await sleep(8000);
    let plasmaBalanceAfter = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(`${alice} balance after deposit: ${plasmaBalanceAfter}`);
    plasmaBalanceAfter.should.be.equal(plasmaBalanceBefore + amount);
    console.log("------Will make a transaction to spending condition------");
    let txAmount = amount;
    let balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    let balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;

    const transferTx = await transfer(
        alice, 
        alicePriv, 
        spAddr, 
        txAmount, 
        nodes[0]);

    console.log(transferTx);
        
    ((await nodes[0].web3.eth.getBalance(alice)) * 1).should.be.equal(balanceAlice - txAmount);
    ((await nodes[0].web3.eth.getBalance(spAddr)) * 1).should.be.equal(balanceSp + txAmount);
    console.log("------Will claim some part of SP balance by Bob------")
    const hash = Buffer.alloc(32);
    spAddrBuf.copy(hash);
    const sig = ethUtil.ecsign(
      hash,
      Buffer.from(bobPriv.replace('0x', ''), 'hex'),
    );
    const condition = new web3.eth.Contract(spendingConditionABI, spAddr);
    console.log("Balances before SP TX:");
    balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(balanceAlice);
    let balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log(balanceBob);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log(balanceSp);
    const msgData = (await condition.methods.fulfil(`0x${sig.r.toString('hex')}`, `0x${sig.s.toString('hex')}`, sig.v, contracts.token.options.address))
        .encodeABI();

    const condTx = Tx.spendCond(
        [
          new Input({
            prevout: new Outpoint(transferTx.hash(), 0),
            gasPrice: 0,
            script: spCode,
          }),
        ],
        [new Output(amount / 5, bob, 0),
        new Output(balanceSp - (amount / 5), spAddr, 0)]
      );

    
      //const condSig = condition.getConditionSig(PRIV);
  
      // msgData that satisfies the spending condition
      //const vBuf = utils.setLengthLeft(utils.toBuffer(condSig.v), 32);
      //const amountBuf = utils.setLengthLeft(utils.toBuffer(amount), 32);
    condTx.inputs[0].setMsgData(msgData);
    console.log(condTx.toJSON());
  
    resp = await sendRawTx(nodes[0].web3, condTx.hex());
    console.log(resp);
    await sleep(3000);  

    console.log("Balances after SP TX:");
    balanceAlice = (await nodes[0].web3.eth.getBalance(alice)) * 1;
    console.log(balanceAlice);
    balanceBob = (await nodes[0].web3.eth.getBalance(bob)) * 1;
    console.log(balanceBob);
    balanceSp = (await nodes[0].web3.eth.getBalance(spAddr)) * 1;
    console.log(balanceSp);

    console.log("╔══════════════════════════════════════════╗");
    console.log("║    Test: Fund SP and claim from it       ║");
    console.log("║             Completed                    ║");                     
    console.log("╚══════════════════════════════════════════╝");
}