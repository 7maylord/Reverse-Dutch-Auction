import { time, loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("Auction", function () {
  async function AuctionContractFixture() {
    const [owner, buyer1, buyer2] = await ethers.getSigners();
    console.log("Deploying contracts with the account:", owner.address);

    // Deploy ERC20 Token
    const Token = await ethers.getContractFactory("TokenX");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddress = token.target;
    console.log("ERC20 Token deployed at:", tokenAddress);

    // Deploy the Auction contract
    const initialPrice = ethers.parseUnits("100", 18); 
    const priceDecreasePerSecond = ethers.parseUnits("0.1", 18); 
    const auctionDuration = 86400; // 24 hours
    const tokensForSale = ethers.parseUnits("1000", 18); // Tokens for sale

    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy(
        tokenAddress,
        initialPrice,
        priceDecreasePerSecond,
        auctionDuration,
        tokensForSale
    );

    console.log("Auction contract deployed at:", auction.target);

    // Transfer tokens to the auction contract
    await token.transfer(auction.target, tokensForSale);
    console.log(`${tokensForSale} tokens transferred to the auction contract.`);

    return { auction, token, initialPrice, priceDecreasePerSecond, auctionDuration, tokensForSale, owner, buyer1, buyer2 };
  }

  describe("Deployment", function () {
    it("Should deploy the contract", async function () {
      const { auction, token } = await loadFixture(AuctionContractFixture);

      expect(await token.name()).to.equal("TokenX");
      expect(await token.symbol()).to.equal("TKX");
    });

    it("Should correctly report contract balance", async function () {
      const { auction, token, tokensForSale } = await loadFixture(AuctionContractFixture);
      const contractBalance = await auction.getContractBalance();
      expect(contractBalance).to.equal(tokensForSale);
    });
  });

  describe("Auction Behavior", function () {
    it("should decrease price correctly over time", async function () {
      const { auction, initialPrice, priceDecreasePerSecond, auctionDuration } = await loadFixture(AuctionContractFixture);

      await auction.startAuction();
      const initialTimestamp = await time.latest();

      await time.increase(10);
      const priceAfter10Seconds = await auction.getCurrentPrice();
      expect(priceAfter10Seconds).to.equal(initialPrice.sub(priceDecreasePerSecond.mul(10)));

      await time.increase(30);
      const priceAfter40Seconds = await auction.getCurrentPrice();
      expect(priceAfter40Seconds).to.equal(initialPrice.sub(priceDecreasePerSecond.mul(40)));

      await time.increase(auctionDuration - 40); 
      const priceAtEnd = await auction.getCurrentPrice();
      expect(priceAtEnd).to.equal(0); 
    });

    it("should allow only one buyer to purchase per auction", async function () {
      const { auction, buyer1, buyer2, token } = await loadFixture(AuctionContractFixture);

      await auction.startAuction();
      const priceAtPurchase1 = await auction.getCurrentPrice();

      // Approve tokens for the buyer
      await token.connect(buyer1).approve(auction.target, priceAtPurchase1.mul(10));

      await auction.connect(buyer1).buyTokens(10, { value: priceAtPurchase1.mul(10) });

      const tokensForSaleAfterPurchase = await auction.tokensForSale();
      expect(tokensForSaleAfterPurchase).to.equal(ethers.parseUnits("990", 18)); 

      await expect(
        auction.connect(buyer2).buyTokens(10, { value: priceAtPurchase1.mul(10) })
      ).to.be.revertedWith("Auction ended or all tokens sold");
    });

    it("should swap funds and tokens correctly", async function () {
      const { auction, buyer1, token, owner } = await loadFixture(AuctionContractFixture);

      await auction.startAuction();

      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      const initialBuyerBalance = await ethers.provider.getBalance(buyer1.address);
      const priceAtPurchase = await auction.getCurrentPrice();

      // Approve tokens for buyer1
      await token.connect(buyer1).approve(auction.target, priceAtPurchase.mul(10));

      await auction.connect(buyer1).buyTokens(10, { value: priceAtPurchase.mul(10) });

      const buyerTokenBalance = await token.balanceOf(buyer1.address);
      expect(buyerTokenBalance).to.equal(ethers.parseUnits("10", 18));

      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.equal(initialOwnerBalance.add(priceAtPurchase.mul(10)));

      const auctionBalance = await ethers.provider.getBalance(auction.target);
      expect(auctionBalance).to.equal(0);
    });

    it("should not allow a buyer to purchase before auction starts", async function () {
      const { auction, buyer1 } = await loadFixture(AuctionContractFixture);

      await expect(
        auction.connect(buyer1).buyTokens(10, { value: ethers.parseUnits("10", 18) })
      ).to.be.revertedWith("Auction not started yet");

      await auction.startAuction();

      const priceAtPurchase = await auction.getCurrentPrice();
      await auction.connect(buyer1).buyTokens(10, { value: priceAtPurchase.mul(10) });

      await expect(
        auction.connect(buyer1).buyTokens(10, { value: priceAtPurchase.mul(10) })
      ).to.be.revertedWith("Auction ended or all tokens sold");
    });
  });
});
