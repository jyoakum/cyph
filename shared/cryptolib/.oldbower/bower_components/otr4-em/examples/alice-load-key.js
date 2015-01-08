var otr = require("../index.js");
var fs = require("fs");

var print = console.error;

var user1 = new otr.User({
    keys: '~/alice.keys'
});
var account = user1.account("alice", "xmpp");
user1.accounts().forEach(function (account) {
    console.log("account:", account.name());
});
print("key fingerprint:", account.fingerprint());

var user2 = new otr.User();
var json_key = JSON.parse(fs.readFileSync("./alice-xmpp-key.json"));
account = user2.account("alice", "xmpp");
account.importKey(json_key);
print("key fingerprint:", account.fingerprint());


var user3 = new otr.User();
var strKey = "" +
    "(privkeys (account (name alice) (protocol xmpp) (private-key (dsa" +
    "(p #CFD0A1302E04F9749F78C034EF696A96582AD594178AF7C93B5EB6139F087BB1D03FCB5D152C8C7009BA835EC71B260CAE8734C7040C51176D6832AD4B12FC600D461B89BFEC18BBDD314C4D39694F32E2BBBBC992BFDD06E69805076FF1CD171CB75C86403C7006BF1AAC49CC96DEFA64978C26F0092990AFD56D91176EADB7#)" +
    "(q #A018091C52164BAB9CD51B21D4108F765C2118DF#)" +
    "(g #7A1FC4D83DAA4D48771EDDA6C8F27123D59D07A84D49A4734DB5B113033AC779CC9AD66C1D71E880D3F326F3D224D74042D6A852D7692D9D0E15646F96F7C0EE6CE63685C0D41E7C92B2A605937F05156CD8D927B9B16CC2649C7F61825E1630F1093ECA5D9238B02131638CAFBB5CC91260FF6A2802FFF7139276DC9CC3880C#)" +
    "(y #C074928BC4A5BD49E86F1D89B64B7B3852678E9C09E2DBE856A68837B068E02B1DC6627AB97BDB19230388017E7DB48350C4BADFC9A07B9749F2E1B2C32B3D21D559F5FD562C2A9125790341455CFF51962509FFAD307E1A1412A7BD4FB588B7FE833ECC533EE6C7B58396FE6B475693E1ADC963909E4C5C0890DF2A4F7B49AF#)" +
    "(x #10418E5B3CD28769589569F7CF50D4D663F84BAE#)" +
    "))))";
user3.stringToKeys(strKey);
print("key fingerprint:", user3.account("alice", "xmpp").fingerprint());
