/**
 * Mock data for testing Etherscan API responses
 */

/**
 * Mock contract ABI response
 */
export const mockContractAbiResponse = {
  status: "1",
  message: "OK",
  result: JSON.stringify([
    {
      inputs: [],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [],
      name: "name",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "symbol",
      outputs: [
        {
          internalType: "string",
          name: "",
          type: "string",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ]),
};

/**
 * Mock proxy contract ABI response
 */
export const mockProxyContractAbiResponse = {
  status: "1",
  message: "OK",
  result: JSON.stringify([
    {
      inputs: [
        {
          internalType: "address",
          name: "logic",
          type: "address",
        },
        {
          internalType: "bytes",
          name: "data",
          type: "bytes",
        },
      ],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      anonymous: false,
      inputs: [
        {
          indexed: false,
          internalType: "address",
          name: "implementation",
          type: "address",
        },
      ],
      name: "Upgraded",
      type: "event",
    },
    {
      stateMutability: "payable",
      type: "fallback",
    },
  ]),
};

/**
 * Mock implementation contract ABI response
 */
export const mockImplementationAbiResponse = {
  status: "1",
  message: "OK",
  result: JSON.stringify([
    {
      inputs: [],
      stateMutability: "nonpayable",
      type: "constructor",
    },
    {
      inputs: [],
      name: "decimals",
      outputs: [
        {
          internalType: "uint8",
          name: "",
          type: "uint8",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
    {
      inputs: [],
      name: "totalSupply",
      outputs: [
        {
          internalType: "uint256",
          name: "",
          type: "uint256",
        },
      ],
      stateMutability: "view",
      type: "function",
    },
  ]),
};

/**
 * Mock contract source code response for a regular contract
 */
export const mockContractSourceCodeResponse = {
  status: "1",
  message: "OK",
  result: [
    {
      SourceCode:
        '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract SimpleContract {\n    string public name = "Simple Contract";\n    string public symbol = "SIMPLE";\n}',
      ABI: '[{"inputs":[],"stateMutability":"nonpayable","type":"constructor"},{"inputs":[],"name":"name","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},{"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"}]',
      ContractName: "SimpleContract",
      CompilerVersion: "v0.8.0+commit.c7dfd78e",
      OptimizationUsed: "1",
      Runs: "200",
      ConstructorArguments: "",
      EVMVersion: "Default",
      Library: "",
      LicenseType: "MIT",
      Proxy: "0",
      Implementation: "",
      SwarmSource: "",
    },
  ],
};

/**
 * Mock contract source code response for a proxy contract
 */
export const mockProxySourceCodeResponse = {
  status: "1",
  message: "OK",
  result: [
    {
      SourceCode:
        "// SPDX-License-Identifier: MIT\npragma solidity ^0.8.0;\n\ncontract ProxyContract {\n    address public implementation;\n    \n    constructor(address _implementation) {\n        implementation = _implementation;\n    }\n    \n    fallback() external payable {\n        // Forward call to implementation\n    }\n}",
      ABI: '[{"inputs":[{"internalType":"address","name":"logic","type":"address"},{"internalType":"bytes","name":"data","type":"bytes"}],"stateMutability":"nonpayable","type":"constructor"},{"anonymous":false,"inputs":[{"indexed":false,"internalType":"address","name":"implementation","type":"address"}],"name":"Upgraded","type":"event"},{"stateMutability":"payable","type":"fallback"}]',
      ContractName: "ProxyContract",
      CompilerVersion: "v0.8.0+commit.c7dfd78e",
      OptimizationUsed: "1",
      Runs: "200",
      ConstructorArguments: "",
      EVMVersion: "Default",
      Library: "",
      LicenseType: "MIT",
      Proxy: "1",
      Implementation: "0x123456789abcdef123456789abcdef123456789a",
      SwarmSource: "",
    },
  ],
};
