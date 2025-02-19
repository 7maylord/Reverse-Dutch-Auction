// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Auction {
    address public seller;
    IERC20 public token;
    uint256 public initialPrice;
    uint256 public priceDecreasePerSecond;
    uint256 public auctionDuration;
    uint256 public startTime;
    uint256 public tokensForSale;

    event AuctionStarted(address indexed seller, uint256 initialPrice, uint256 auctionDuration, uint256 priceDecreasePerSecond);
    event AuctionEnded(address indexed buyer, uint256 price, uint256 tokensPurchased);
    event TokenPurchased(address indexed buyer, uint256 price, uint256 tokensPurchased);

    modifier onlySeller() {
        require(msg.sender == seller, "Not the seller");
        _;
    }

    modifier auctionOngoing() {
        require(block.timestamp < startTime + auctionDuration, "Auction has ended");
        _;
    }

    modifier auctionEnded() {
        require(block.timestamp >= startTime + auctionDuration, "Auction has not ended yet");
        _;
    }

    modifier hasTokens() {
        require(tokensForSale > 0, "No tokens available for sale");
        _;
    }

    constructor(
        address _token,
        uint256 _initialPrice,
        uint256 _priceDecreasePerSecond,
        uint256 _auctionDuration,
        uint256 _tokensForSale
    ) {
        seller = msg.sender;
        token = IERC20(_token);
        initialPrice = _initialPrice;
        priceDecreasePerSecond = _priceDecreasePerSecond;
        auctionDuration = _auctionDuration;
        tokensForSale = _tokensForSale;

        emit AuctionStarted(seller, initialPrice, auctionDuration, priceDecreasePerSecond);
    }

    function startAuction() external onlySeller hasTokens {
        require(startTime == 0, "Auction already started");
        
        startTime = block.timestamp;

        token.transferFrom(seller, address(this), tokensForSale);
    }

    function getCurrentPrice() public view returns (uint256) {
        uint256 elapsedTime = block.timestamp - startTime;
        if (elapsedTime >= auctionDuration) {
            return 0; 
        }
        uint256 priceDecrease = elapsedTime * priceDecreasePerSecond;
        if (initialPrice > priceDecrease) {
            return initialPrice - priceDecrease;
        }
        return 0;
    }

    function buyTokens(uint256 amount) external payable auctionOngoing {
        uint256 price = getCurrentPrice();
        require(price > 0, "Price is zero, auction has ended");
        require(amount <= tokensForSale, "Not enough tokens available");

        uint256 totalPrice = price * amount;
        require(msg.value >= totalPrice, "Insufficient funds");

        
        token.transfer(msg.sender, amount);

        payable(seller).transfer(msg.value);

        tokensForSale -= amount;

        emit TokenPurchased(msg.sender, price, amount);

        if (tokensForSale == 0) {
            endAuction();
        }
    }

    function endAuction() public auctionEnded {
        require(tokensForSale > 0, "Auction already ended");

        if (tokensForSale > 0) {
            token.transfer(seller, tokensForSale);
        }

        emit AuctionEnded(msg.sender, getCurrentPrice(), tokensForSale);
    }

    function withdrawTokens() external onlySeller {
        require(tokensForSale > 0, "No tokens to withdraw");
        token.transfer(seller, tokensForSale);
        tokensForSale = 0;
    }

    function withdrawFunds() external onlySeller {
        uint256 balance = address(this).balance;
        payable(seller).transfer(balance);
    }

    function getContractBalance() public view returns (uint256) {
    return token.balanceOf(address(this));
}
}
