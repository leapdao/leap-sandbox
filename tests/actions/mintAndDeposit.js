module.exports = async function(alice, amount, minter, token, exitHandler) {
  
  console.log(`------Will mint and deposit ${amount} tokens for ${alice}------`);
  console.log(`Minting token to account ${alice}...`);
  //await token.methods.mint(alice, amount).send({from: minter});
  await token.methods.transfer(alice, amount).send({from: minter});
  console.log(`Aprroving ${amount} tokens for deposit...`);
  await token.methods.approve(exitHandler.options.address, amount).send({from: alice});
  console.log(`Depositing ${amount} tokens...`);
  await exitHandler.methods.deposit(alice, amount, 0).send({
    from: alice,
    gas: 2000000
  });
}