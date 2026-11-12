const { initializeApp } = require("firebase-admin/app");

initializeApp();

const { geminiProxy } = require("./geminiProxy");
const { setUserActive, deleteUserAccount } = require("./userAdmin");
const { syncUserClaims, syncBranchClaims, resyncMyClaims } = require("./customClaims");

exports.geminiProxy = geminiProxy;
exports.setUserActive = setUserActive;
exports.deleteUserAccount = deleteUserAccount;
exports.syncUserClaims = syncUserClaims;
exports.syncBranchClaims = syncBranchClaims;
exports.resyncMyClaims = resyncMyClaims;
