const { n18, increaseTime, claimAndStake } = require("./helpers");
const { expect } = require("chai");

describe("StakingPlatform - Mid Pool", () => {
  let token;
  let stakingPlatform;
  let accounts;
  let addresses;

  it("Should deploy the new Token", async () => {
    const Token = await ethers.getContractFactory("Token");
    token = await Token.deploy(n18("1000000000"));
    await token.deployed();
    accounts = await ethers.getSigners();
    addresses = accounts.map((account) => account.address);
  });

  it("should distribute tokens among users", async () => {
    expect((await token.balanceOf(addresses[1])).toString()).to.equal("0");
    await token.transfer(addresses[1], n18("100000"));
    expect((await token.balanceOf(addresses[1])).toString()).to.equal(
      "100000000000000000000000"
    );

    expect((await token.balanceOf(addresses[2])).toString()).to.equal("0");
    await token.transfer(addresses[2], n18("100000"));
    expect((await token.balanceOf(addresses[2])).toString()).to.equal(
      "100000000000000000000000"
    );
  });

  it("Should deploy the new staking platform", async () => {
    const StakingPlatform = await ethers.getContractFactory(
      "StakingPlatformTester"
    );
    stakingPlatform = await StakingPlatform.deploy(
      token.address,
      12,
      365,
      270,
      n18("35000000")
    );
    await stakingPlatform.deployed();
  });

  it("Shoud increase precision", async () => {
    await stakingPlatform.setPrecision(28);
  });

  it("Should send tokens to staking platform", async () => {
    expect(await token.balanceOf(stakingPlatform.address)).to.equal(n18("0"));
    await token.transfer(stakingPlatform.address, n18("4050000"));
    expect(await token.balanceOf(stakingPlatform.address)).to.equal(
      n18("4050000")
    );
  });

  it("Should deposit to staking platform", async () => {
    const balance1 = await token.balanceOf(addresses[1]);
    await token.connect(accounts[1]).approve(stakingPlatform.address, balance1);
    await stakingPlatform.connect(accounts[1]).deposit(balance1);
    expect((await token.balanceOf(addresses[1])).toString()).to.equal("0");

    const balance2 = await token.balanceOf(addresses[2]);
    await token.connect(accounts[2]).approve(stakingPlatform.address, balance2);
    await stakingPlatform.connect(accounts[2]).deposit(balance2);
    expect((await token.balanceOf(addresses[2])).toString()).to.equal("0");
  });

  it("Should return the amount staked", async () => {
    expect(await stakingPlatform.totalDeposited()).to.equal(n18("200000"));
  });

  it("Should start Staking and ending period should last 1 year", async () => {
    expect((await stakingPlatform.startPeriod()).toString()).to.equal("0");
    await stakingPlatform.startStaking();
    expect((await stakingPlatform.startPeriod()).toString()).to.not.equal("0");
    expect(
      (
        (await stakingPlatform.endPeriod()) -
        (await stakingPlatform.startPeriod())
      ).toString()
    ).to.equal("31536000");
  });

  it("Should fail if trying to start Staking twice", async () => {
    await expect(stakingPlatform.startStaking()).to.revertedWith(
      "Staking has already started"
    );
  });

  it("Should return the amount staked", async () => {
    expect(
      (await stakingPlatform.connect(accounts[1]).amountStaked()).toString()
    ).to.equal("100000000000000000000000");
  });

  it("Should revert if exceed the max staking amount", async () => {
    await token.approve(stakingPlatform.address, n18("50000000"));
    await expect(stakingPlatform.deposit(n18("50000000"))).to.revertedWith(
      "Amount staked exceeds MaxStake"
    );
  });

  it("Should claim rewards and stake for 365 day", async () => {
    for (let i = 0; i < 365; i++) {
      await increaseTime(60 * 60 * 24);

      await claimAndStake(accounts[1], token, stakingPlatform);
    }
  }, 40000);

  it("Should withdraw residual balances", async () => {
    const balanceStakingBefore = String(
      await token.balanceOf(stakingPlatform.address)
    ).slice(0, 8);
    const balanceOwnerBefore = String(
      await token.balanceOf(addresses[0])
    ).slice(0, 8);
    expect(balanceStakingBefore).to.equal("42499152");
    expect(balanceOwnerBefore).to.equal("99575000");

    await stakingPlatform.withdrawResidualBalance();

    const balanceStakingAfter = String(
      await token.balanceOf(stakingPlatform.address)
    ).slice(0, 8);
    const balanceOwnerAfter = String(await token.balanceOf(addresses[0])).slice(
      0,
      8
    );
    expect(balanceStakingAfter).to.equal("21354005");
    expect(balanceOwnerAfter.toString()).to.equal("99978637");
  });

  it("Should fail withdraw initial deposit after withdrawResidualBalance", async () => {
    // Success enough balance
    await stakingPlatform.connect(accounts[1]).withdraw();

    // Fails not enough balance
    await expect(
      stakingPlatform.connect(accounts[2]).withdraw()
    ).to.revertedWith("ERC20: transfer amount exceeds balance");
  });

  it("Should withdraw initial deposit", async () => {
    await token.transfer(stakingPlatform.address, n18("1000000"));

    await stakingPlatform.connect(accounts[1]).withdraw();
    await stakingPlatform.connect(accounts[2]).withdraw();

    const balance1 = String(await token.balanceOf(addresses[1])).slice(0, 8);
    expect(balance1).to.equal("11362480");

    expect((await token.balanceOf(addresses[2])).toString()).to.equal(
      "112000000000000000000000"
    );
  });

  it("Should withdraw residual after tokens sent to contract", async () => {
    await stakingPlatform.withdrawResidualBalance();
  });

  it("Should fail withdraw residual if no residual balance", async () => {
    await expect(stakingPlatform.withdrawResidualBalance()).to.revertedWith(
      "No residual Balance to withdraw"
    );
  });
});
