'use strict';

import './popup.css';

// tell background script that popup is open
chrome.runtime.sendMessage({ msg: "popup" });

// get selected wallet, if it's undefined go to choose-pw view
chrome.runtime.sendMessage({ msg: "get-selected-wallet" },
  function(response) {
  if (response.data.wallet === undefined) {
    // no wallet exists yet, go to choose-pw view
    hide_views();
    choose_pw_view.classList.remove("hidden");
  } else {
    // wallet exists so we check if we are logged in
    chrome.runtime.sendMessage({ msg: "is-unlocked" },
      function(response) {
        if (response.data.status) {
          // background script is unlocked so we go to wallet view
          hide_views();
          wallet_view.classList.remove("hidden");
        } else {
          // background script is not unlocked so we go to login-view
          hide_views();
          wallet_selection.classList.add("invisible");
          login_view.classList.remove("hidden");
        }
      });
  }
});

// views
const view_parent = document.getElementById("view-parent");
const choose_pw_view = document.getElementById("choose-pw-view");
const add_new_view = document.getElementById("add-new-view");
const add_mnemo_view = document.getElementById("add-mnemo-view");
const add_pk_view = document.getElementById("add-pk-view");
const create_new_view = document.getElementById("create-new-view");
const login_view = document.getElementById("login-view");
const wallet_view = document.getElementById("wallet-view");
const send_view = document.getElementById("send-view");
const settings_view = document.getElementById("settings-view");

// text
const mnemonic_text = document.getElementById("mnemonic-text");
const selected_wallet_text = document.getElementById("selected-wallet");

// inputs
const choose_pw_view_input = document.getElementById("choose-pw-view-input");
const login_view_input = document.getElementById("login-view-input");
const add_mnemo_view_input = document.getElementById("add-mnemo-view-input");
const add_pk_view_input = document.getElementById("add-pk-view-input");

// buttons
const add_new_btn = document.getElementById("add-new-btn");
const choose_pw_view_submit_btn = document.getElementById("choose-pw-view-submit-btn");
const add_new_view_mnemo_btn = document.getElementById("add-new-view-mnemo-btn");
const add_new_view_pk_btn = document.getElementById("add-new-view-pk-btn");
const add_new_view_new_btn = document.getElementById("add-new-view-new-btn");
const add_mnemo_view_submit_btn = document.getElementById("add-mnemo-view-submit-btn");
const add_pk_view_submit_btn = document.getElementById("add-pk-view-submit-btn");
const create_new_view_submit_btn = document.getElementById("create-new-view-submit-btn");
const login_view_unlock_btn = document.getElementById("login-view-unlock-btn");

//other
const wallet_selection = document.getElementById("wallet-selection");
const wallet_list = document.getElementById("wallet-list");

//
// event listeners and ui logic
//

// hide every view
function hide_views() {
  for (const child of view_parent.children) {
    child.classList.add("hidden");
  }
}

// wallet selection
document.addEventListener("click", function(e){
  // clicked on entry in wallet selection
  if(e.target.classList.contains("wallet-list-entry")){
    chrome.runtime.sendMessage({
      msg: "select-wallet",
      data: {
        wallet: e.target.id
      }
    });
    selected_wallet_text.textContent = e.target.textContent;
  // clicked on add new in wallet selection
  } else if (e.target.id === "add-new-btn") {
    hide_views();
    add_new_view.classList.remove("hidden");
  }
})

// choose-pw view
choose_pw_view_submit_btn.addEventListener("click", function(){
  let pw = choose_pw_view_input.value;
  chrome.runtime.sendMessage({
    msg: "set-password",
    data: {
      password: pw
    }
  });
  chrome.runtime.sendMessage({ msg: "create-new" },
    function(response) {
      mnemonic_text.textContent = response.data.mnemonic;
    });

  hide_views();
  create_new_view.classList.remove("hidden")
});

// add-new view
add_new_view_mnemo_btn.addEventListener("click", function(){
  hide_views();
  add_mnemo_view.classList.remove("hidden")
});

add_new_view_pk_btn.addEventListener("click", function(){
  hide_views();
  add_pk_view.classList.remove("hidden")
});

add_new_view_new_btn.addEventListener("click", function(){
  chrome.runtime.sendMessage({ msg: "create-new" },
    function(response) {
      mnemonic_text.textContent = response.data.mnemonic;
    });

  hide_views();
  create_new_view.classList.remove("hidden")
});

// add-mnemo view
add_mnemo_view_submit_btn.addEventListener("click", function(){
  let mn = add_mnemo_view_input.value;

  chrome.runtime.sendMessage({
    msg: "import-mnemo",
    data: {
      mnemo: mn
    }
  });

  hide_views();
  wallet_view.classList.remove("hidden")
});

// add-pk view
add_pk_view_submit_btn.addEventListener("click", function(){
  let pk = add_pk_view_input.value;

  chrome.runtime.sendMessage({
    msg: "import-pk",
    data: {
      pk: pk
    }
  });

  hide_views();
  wallet_view.classList.remove("hidden")
});

// create-new view
create_new_view_submit_btn.addEventListener("click", function(){
  hide_views();
  wallet_view.classList.remove("hidden")
});

// login view
login_view_unlock_btn.addEventListener("click", function(){
  // unlock background script
  let pw = login_view_input.value;
  chrome.runtime.sendMessage({
      msg: "unlock",
      data: {
        password: pw
      }
      },
    function(response) {
      if (response.msg === "unlock-success") {
        hide_views();
        wallet_selection.classList.remove("invisible");
        wallet_view.classList.remove("hidden");
      }
    });
});

//
// nativeMessaging
//

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.msg === 'update-wallet-list') {
    let selected_wallet = request.data.selected;
    let wallets = request.data.wallets;
    let html = "";

    console.log(wallets);

    // create html element for every wallet address and append it
    for (const wallet of wallets) {
      // turn address string into fffff...fffff
      let addr_short = wallet.substring(0, 5) + "..." + wallet.substring(43, 48);
      html += '<h1 id="' + wallet + '" class="wallet-list-entry p-1 text-sm hover:bg-neutral-900 hover:text-neutral-300">' + addr_short + '</h1>';
    }
    // add button
    html += '<h1 id="add-new-btn" class="p-1 text-sm hover:bg-neutral-900 hover:text-neutral-300">Add new</h1>';

    // update list and selected wallet
    wallet_list.innerHTML = html;
    selected_wallet_text.textContent = selected_wallet.substring(0, 5) + "..." + selected_wallet.substring(43, 48);
  }
});
