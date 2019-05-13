module.exports = [
    {
      "constant": false,
      "inputs": [
        {
          "name": "to",
          "type": "address"
        },
        {
          "name": "_r1",
          "type": "bytes32"
        },
        {
          "name": "_s1",
          "type": "bytes32"
        },
        {
          "name": "_v1",
          "type": "uint8"
        },
        {
          "name": "_r2",
          "type": "bytes32"
        },
        {
          "name": "_s2",
          "type": "bytes32"
        },
        {
          "name": "_v2",
          "type": "uint8"
        },
        {
          "name": "_tokenAddr",
          "type": "address"
        }
      ],
      "name": "fulfil",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "constant": false,
      "inputs": [
        {
          "name": "_proof",
          "type": "bytes32[]"
        },
        {
          "name": "_oindex",
          "type": "uint256"
        }
      ],
      "name": "startExit",
      "outputs": [],
      "payable": false,
      "stateMutability": "nonpayable",
      "type": "function"
    }
  ]
  