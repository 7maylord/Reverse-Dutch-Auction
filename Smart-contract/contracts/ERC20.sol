// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract TokenX is ERC20 {
    constructor() ERC20("TokenX", "TKX") {
        _mint(msg.sender, 10000 * 10**decimals()); 
    }
}