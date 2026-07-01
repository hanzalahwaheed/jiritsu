const stateEl = document.getElementById("state");
const lockBtn = document.getElementById("lock");

function render({ unlocked, until }) {
  if (unlocked && until) {
    const mins = Math.max(0, Math.round((until - Date.now()) / 60000));
    stateEl.textContent = `🔓 Unlocked — ~${mins} min left.`;
    lockBtn.disabled = false;
  } else {
    stateEl.textContent = "🔒 Locked — Reddit needs a solved problem.";
    lockBtn.disabled = true;
  }
}

chrome.runtime.sendMessage({ type: "status" }, render);

lockBtn.addEventListener("click", () => {
  chrome.runtime.sendMessage({ type: "lock" }, () => {
    chrome.runtime.sendMessage({ type: "status" }, render);
  });
});

document.getElementById("opts").addEventListener("click", () => {
  chrome.runtime.openOptionsPage();
});
