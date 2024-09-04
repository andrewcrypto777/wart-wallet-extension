'use strict';

const elliptic = require('elliptic');
const crypto = require('crypto-browserify');
const ec = new elliptic.ec('secp256k1');
import * as bip39 from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english';

// variables
let password = "";
let selected_wallet = "";
let wallets = {};
let current_pk;
let unlocked = false;

console.log("background.js executed");

// load wallet data from local storage
get_selected_wallet();
get_wallets();

// nativeMessaging interface

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  // TODO switch
  switch (request.msg) {
    case "popup":
      get_wallets();
      update_wallet_list();
      if (unlocked) {
        // fetch price data
      }
      break;
    case "is-unlocked":
      sendResponse({
        msg: "is-unlocked",
        data: {
          status: unlocked
        }
      });
      break;
    case "set-password":
      password = request.data.password;
      break;
    case "import-mnemo":
      import_mnemo(request.data.mnemo);
      break;
    case "import-pk":
      import_pk(request.data.pk);
      break;
    case "create-new":
      let mnemo = create_new();
      sendResponse({
        msg: "new-wallet",
        data: {
          mnemonic: mnemo
        }
      });
      break;
    case "get-selected-wallet":
      sendResponse({
        msg: "selected-wallet",
        data: {
          wallet: selected_wallet
        }
      });
      break;
    case "get-wallet-data":
      sendResponse({
        msg: "wallet-data",
        data: {
          x: 1
        }
      });
      break;
    case "unlock":
      let pw = request.data.password;

      let pk = decrypt_pk(wallets[selected_wallet][0], pw, wallets[selected_wallet][1])

      if (!pk) {
        sendResponse({
          msg: "invalid-password"
        });
        return;
      }

      current_pk = pk;
      password = pw;

      sendResponse({
        msg: "unlock-success"
      });
      break;
  }
});

function update_wallet_list() {
  chrome.runtime.sendMessage({
    msg: "update-wallet-list",
    data: {
      selected: selected_wallet,
      wallets: Object.keys(wallets)
    }
  });
}

// LocalStorage stuff

function save_wallet(address, pk_enc, salt) {
  chrome.storage.local.get(["wallets"]).then((result) => {
    let w = result.wallets
    //
    if (result.wallets === undefined) {
      w = {}
    }

    w[address] = [pk_enc, salt];
    wallets = w;
    update_wallet_list();

    chrome.storage.local.set({ "wallets": w }).then(() => {
      console.log("saved wallets");
    });
  });
}

function get_wallets() {
  chrome.storage.local.get(["wallets"]).then((result) => {
    wallets = result.wallets;
  });
}

function set_selected_wallet(wallet) {
  chrome.storage.local.set({ "selected-wallet": wallet }).then(() => {
    selected_wallet = wallet;
    console.log("saved wallets");
  });
}

function get_selected_wallet() {
  chrome.storage.local.get(["selected-wallet"]).then((result) => {
    console.log(result["selected-wallet"]);
    selected_wallet = result["selected-wallet"];
  });
}

// wallet functions

function import_mnemo(mnemo) {
  // validate mnemonic
  if (!bip39.validateMnemonic(mnemo, wordlist)) {
    // return error
  }
  console.log("a")
  let seed = bip39.mnemonicToSeedSync(mnemo);
  console.log(Buffer.from(seed).toString('hex'));
  let pk = pk_from_seed(seed);
  console.log(pk);
  let address = address_from_pk(pk);
  console.log(address);
  let [pk_enc, salt] = encrypt_pk(pk, password)
  console.log("b")

  set_selected_wallet(address);

  save_wallet(address, pk_enc, salt);
}

function import_pk(pk) {
  let address = address_from_pk(pk);
  let [pk_enc, salt] = encrypt_pk(password)

  set_selected_wallet(address);

  save_wallet(address, pk_enc, salt);
}

function create_new() {
  let mnemo = bip39.generateMnemonic(wordlist);
  import_mnemo(mnemo);
  return mnemo;
}

// cryptography stuff

function encrypt_pk (pk, pw) {
  try {
    let iv = crypto.randomBytes(16);
    let key = crypto.createHash('sha256').update(pw).digest('base64').substr(0, 32);
    let cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(pk);
    encrypted = Buffer.concat([encrypted, cipher.final()])
    return [encrypted.toString('hex'), iv.toString('hex')];
  } catch (error) {
    console.log(error)
  }
}

function decrypt_pk (pk_enc, pw, salt) {
  try {
    let iv = Buffer.from(salt, 'hex');
    let key = crypto.createHash('sha256').update(pw).digest('base64').substr(0, 32);
    let decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

    pk_enc = Buffer.from(pk_enc, 'hex');
    let decrypted = decipher.update(pk_enc);
    let decryptedText = Buffer.concat([decrypted, decipher.final()]);
    return decryptedText.toString();
  } catch (error) {
    console.log(error)
    return false;
  }
}

// source: https://github.com/warthog-network/docs/blob/master/Developers/Integrations/wallet-integration.md

function pk_from_seed(seed) {
  // generate private key
  var pk = ec.genKeyPair({
    entropy: seed
  });

  // alternatively read private key
  // var pkhex= '966a71a98bb5d13e9116c0dffa3f1a7877e45c6f563897b96cfd5c59bf0803e0'
  // var pk =  ec.keyFromPrivate(pkhex);

  // convert private key to hex
  let pkhex = pk.getPrivate().toString("hex")
  while (pkhex.length < 64) {
    pkhex = "0" + pkhex;
  }

  console.log(pkhex);

  return pkhex;
}

function address_from_pk(pkhex) {
  var pk =  ec.keyFromPrivate(pkhex);
  // derive public key
  var pubKey = pk.getPublic().encodeCompressed("hex");

  console.log(pubKey);

  // convert public key to raw addresss
  var sha = crypto.createHash('sha256').update(Buffer.from(pubKey,"hex")).digest()
  var addrRaw = crypto.createHash('ripemd160').update(sha).digest()

  // generate address by appending checksum
  var checksum = crypto.createHash('sha256').update(addrRaw).digest().slice(0,4)
  var addr = Buffer.concat([addrRaw , checksum]).toString("hex")

  return addr;
}

function send_tx (a) {
  //////////////////////////////
  // Generate a signed transaction
  //////////////////////////////
  var request = require('sync-request');
  var baseurl = 'http://localhost:3000'

  // get pinHash and pinHeight from warthog node
  var head = JSON.parse(request('GET', baseurl + '/chain/head').body.toString())
  var pinHeight = head.data.pinHeight
  var pinHash = head.data.pinHash


  // send parameters
  var nonceId = 0 // 32 bit number, unique per pinHash and pinHeight
  var toAddr = '0000000000000000000000000000000000000000de47c9b2' // burn destination address
  var amountE8 = 100000000 // 1 WART, this must be an integer, coin amount * 10E8


  // round fee from WART amount
  var rawFee = "0.00009999" // this needs to be rounded, WARNING: NO SCIENTIFIC NOTATION
  var result = request('GET',baseurl + '/tools/encode16bit/from_string/'+rawFee).body.toString()
  var encode16bit_result = JSON.parse(result)
  var feeE8 = encode16bit_result["data"]["roundedE8"] // 9992


  // alternative: round fee from E8 amount
  var rawFeeE8 = "9999" // this needs to be rounded
  result = request('GET',baseurl + '/tools/encode16bit/from_e8/'+rawFeeE8).body.toString()
  encode16bit_result = JSON.parse(result)
  feeE8 = encode16bit_result["data"]["roundedE8"] // 9992


  // generate bytes to sign
  var buf1 = Buffer.from(pinHash,"hex")
  var buf2 = Buffer.allocUnsafe(19)
  buf2.writeUInt32BE(pinHeight,0)
  buf2.writeUInt32BE(nonceId,4)
  buf2.writeUInt8(0,8)
  buf2.writeUInt8(0,9)
  buf2.writeUInt8(0,10)
  buf2.writeBigUInt64BE(BigInt(feeE8),11)
  var buf3 = Buffer.from(toAddr.slice(0,40),"hex")
  var buf4 = Buffer.allocUnsafe(8)
  buf4.writeBigUInt64BE(BigInt(amountE8),0)
  var toSign = Buffer.concat([buf1, buf2, buf3, buf4])


  // sign with recovery id
  const secp256k1 = require("secp256k1");
  var signHash = crypto.createHash('sha256').update(toSign).digest()
  var signed = secp256k1.ecdsaSign(signHash, Buffer.from(pkhex,"hex"));
  var signatureWithoutRecid = signed.signature
  var recid = signed.recid


  // normalize to lower s
  if (!secp256k1.signatureNormalize(signatureWithoutRecid))
    recid = recid ^ 1
  var recidBuffer = Buffer.allocUnsafe(1)
  recidBuffer.writeUint8(recid)


  // form full signature
  var signature65 = Buffer.concat([signatureWithoutRecid, recidBuffer])

  // post transaction request to warthog node
  var postdata = {
    "pinHeight": pinHeight,
    "nonceId": nonceId,
    "toAddr": toAddr,
    "amountE8": amountE8,
    "feeE8": feeE8,
    "signature65": signature65.toString("hex")
  }

  var res = request('POST', baseurl+'/transaction/add', { json: postdata }).body.toString()
  console.log("send result: ", res)
}
