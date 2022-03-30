const Subjective = artifacts.require("Subjective");

module.exports = function (deployer) {
  deployer.deploy(Subjective);
};