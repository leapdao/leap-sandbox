module.exports = async function({contracts, nodes, accounts, web3}) {
  const alice = accounts[0].addr;

  await contracts.token.methods.approve(contracts.exitHandler.options.address, 500000000000).send({from: alice});
  await contracts.token.methods.approve(contracts.operator.options.address, 500000000000).send({from: alice});

  let slotId = 0;
  for (let i = 0; i < nodes.length; i++) { 
    let node = nodes[i];
    const validatorInfo = await node.web3.getValidatorInfo();
    await contracts.operator.methods.bet(
        slotId, 
        1, 
        validatorInfo.ethAddress, 
        '0x' + validatorInfo.tendermintAddress
      ).send({
        from: alice,
        gas: 2000000
    });
    slotId++;
    await web3.eth.sendTransaction({
      from: alice,
      to: validatorInfo.ethAddress, 
      value: web3.utils.toWei('1', "ether")
    });
  }

  await contracts.exitHandler.methods.deposit(alice, 200000000000, 0).send({
    from: alice,
    gas: 2000000
  });
}