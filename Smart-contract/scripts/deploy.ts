import { ethers, run } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log(`Deploying contracts with account: ${deployer.address}`);

    // Deploy ERC20 Token
    const Token = await ethers.getContractFactory("TokenX");
    const token = await Token.deploy();
    await token.waitForDeployment();
    const tokenAddress = await token.getAddress();
    console.log(`TokenX deployed at: ${tokenAddress}`);

    // Deploy Auction contract
    const initialPrice = ethers.parseUnits("100", 18);
    const priceDecreasePerSecond = ethers.parseUnits("0.1", 18);
    const auctionDuration = 86400; 
    const tokensForSale = 1000;

    const Auction = await ethers.getContractFactory("Auction");
    const auction = await Auction.deploy(
        tokenAddress,
        initialPrice,
        priceDecreasePerSecond,
        auctionDuration,
        tokensForSale
    );
    await auction.waitForDeployment();
    const auctionAddress = await auction.getAddress();
    console.log(`Auction contract deployed at: ${auctionAddress}`);

    // Transfer tokens to the auction contract
    const tx = await token.transfer(auctionAddress, tokensForSale);
    await tx.wait();
    console.log(`${tokensForSale} tokens transferred to the auction contract.`);

    // Wait for a few confirmations before verification
    console.log("Waiting for transactions to confirm...");
    await new Promise((resolve) => setTimeout(resolve, 30000)); 

    try {
        console.log("Verifying Auction contract...");
        await run("verify:verify", {
            address: auctionAddress,
            constructorArguments: [
                tokenAddress,
                initialPrice,
                priceDecreasePerSecond,
                auctionDuration,
                tokensForSale
            ],
        });
        console.log("Auction contract verified successfully!");
    } catch (error) {
        console.error("Verification failed:", error);
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
