module.exports = async function(contracts, nodes, accounts, web3) {
  const alice = accounts[0].addr;

  await contracts.token.methods.approve(contracts.exitHandler.options.address, 500000000000).send({from: alice});
  await contracts.token.methods.approve(contracts.operator.options.address, 500000000000).send({from: alice});

  let slotId = 0;
  for (let i = 0; i < nodes.length; i++) { 
    let node = nodes[i];
    const validatorInfo = await node.web3.getValidatorInfo();
    const payload = await contracts.operator.methods.setSlot(
      slotId, validatorInfo.ethAddress, '0x' + validatorInfo.tendermintAddress
    ).encodeABI();

    await contracts.governance.methods
      .propose(contracts.operator.options.address, payload)
      .send({
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

  await contracts.governance.methods.finalize()
    .send({
      from: alice,
      gas: 2000000
    });

    await contracts.exitHandler.methods.deposit(alice, 200000000000, 0).send({
    from: alice,
    gas: 2000000
  });
}