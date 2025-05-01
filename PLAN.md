# defi-stuff plan

We are going to make a general-use project to interact with defi protocols across multiple blockchains.

We are going to interact with smart contracts directly, using the ethers.js library. We will use the Alchemy RPC for this. We are also going to use APIs such as Debank, Defillama, and Etherscan.

This will be a node project, written in TypeScript. We will use ES6 import syntax and type=module.

We will integrate with Discord to send notifications to a channel.

We will run on a schedule using Macos's scheduling tools. We may run multiple different commands on different schedules. We will want to be able to control these schedules easily.

We will use Commander to create a CLI interface into our program. We want to keep this CLI interface well organized, because we expect there to be many different kinds of functionality. We want to keep these commands well documented.

We want some of the functionality to be a daily check, and some to be exploratory that we run manually. We want it to be easy to add new commands, pointing to new code; the Commander definitions should not contain their own functionality, they should simply call into code implemented elsewhere.

Ideally we will keep a sensible object-oriented structure across our code.

We will need to store ABI files, as JSON, and import them in our code when we connect to contracts. We should keep this clean and organized, and well-named.

We will keep secrets in a `.env` file which is included in `.gitignore` and never committed. We will have a `.env.template` file that shows the possible fields but without real/secret values.

It is essential that we keep our code clean, readable, and extensible.
