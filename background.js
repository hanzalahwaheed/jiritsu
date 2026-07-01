// Distraction LeetCode Gate — background service worker.
// Owns the gate: a declarativeNetRequest session rule that redirects any
// blocked domain -> challenge.html whenever the user is "locked". The blocked
// domain list is user-editable and read from chrome.storage.local.

import { getSettings, domainsToRegex, DEFAULTS } from "./config.js";

const REDDIT_RULE_ID = 1; // redirects blocked sites -> challenge page
const HEADER_RULE_ID = 2; // sets Referer/Origin on LeetCode submit XHRs
const UNLOCK_KEY = "unlockUntil";

function blockRule(regexFilter) {
  return {
    id: REDDIT_RULE_ID,
    priority: 1,
    action: {
      type: "redirect",
      redirect: {
        // \\0 = the whole matched URL, passed so we can return there after solving.
        regexSubstitution: chrome.runtime.getURL("challenge.html") + "?to=\\0"
      }
    },
    condition: { regexFilter, resourceTypes: ["main_frame"] }
  };
}

// Extension-page fetches can't set Referer/Origin (forbidden headers), and
// LeetCode's judge rejects submissions without them — so rewrite via DNR.
function headerRule() {
  return {
    id: HEADER_RULE_ID,
    priority: 1,
    action: {
      type: "modifyHeaders",
      requestHeaders: [
        { header: "referer", operation: "set", value: "https://leetcode.com/" },
        { header: "origin", operation: "set", value: "https://leetcode.com" }
      ]
    },
    condition: { urlFilter: "||leetcode.com/problems/", resourceTypes: ["xmlhttprequest"] }
  };
}

async function isUnlocked() {
  const { [UNLOCK_KEY]: until } = await chrome.storage.session.get(UNLOCK_KEY);
  return typeof until === "number" && Date.now() < until;
}

async function applyRules({ block }) {
  const { blockedDomains } = await getSettings();
  const regex = domainsToRegex(blockedDomains);
  const addRules = [headerRule()];
  if (block && regex) addRules.push(blockRule(regex));
  await chrome.declarativeNetRequest.updateSessionRules({
    removeRuleIds: [REDDIT_RULE_ID, HEADER_RULE_ID],
    addRules
  });
}

async function refresh() {
  await applyRules({ block: !(await isUnlocked()) });
}

chrome.runtime.onInstalled.addListener(async () => {
  // Seed defaults on first install without clobbering existing settings.
  const cur = await chrome.storage.local.get(["blockedDomains", "unlockMinutes"]);
  const seed = {};
  if (!Array.isArray(cur.blockedDomains)) seed.blockedDomains = DEFAULTS.blockedDomains;
  if (!(Number(cur.unlockMinutes) > 0)) seed.unlockMinutes = DEFAULTS.unlockMinutes;
  if (Object.keys(seed).length) await chrome.storage.local.set(seed);
  await refresh();
});

chrome.runtime.onStartup.addListener(refresh);

// Re-apply rules whenever the blocklist changes (e.g. from the options page).
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === "local" && changes.blockedDomains) refresh();
});

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "unlock") {
    (async () => {
      const { unlockMinutes } = await getSettings();
      const minutes = msg.minutes || unlockMinutes;
      const until = Date.now() + minutes * 60 * 1000;
      await chrome.storage.session.set({ [UNLOCK_KEY]: until });
      await applyRules({ block: false });
      await chrome.alarms.create("relock", { when: until });
      sendResponse({ ok: true, until });
    })();
    return true;
  }
  if (msg?.type === "status") {
    (async () => {
      const unlocked = await isUnlocked();
      const { [UNLOCK_KEY]: until } = await chrome.storage.session.get(UNLOCK_KEY);
      sendResponse({ unlocked, until: until || null });
    })();
    return true;
  }
  if (msg?.type === "lock") {
    (async () => {
      await chrome.storage.session.remove(UNLOCK_KEY);
      await applyRules({ block: true });
      sendResponse({ ok: true });
    })();
    return true;
  }
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "relock") refresh();
});
