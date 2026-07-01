import { getSettings, normalizeDomain } from "./config.js";

const domainsEl = document.getElementById("domains");
const minutesEl = document.getElementById("minutes");
const savedEl = document.getElementById("saved");

async function load() {
  const { blockedDomains, unlockMinutes } = await getSettings();
  domainsEl.value = blockedDomains.join("\n");
  minutesEl.value = unlockMinutes;
}

async function save() {
  const blockedDomains = [
    ...new Set(domainsEl.value.split("\n").map(normalizeDomain).filter(Boolean))
  ];
  const unlockMinutes = Math.min(240, Math.max(1, Number(minutesEl.value) || 20));

  await chrome.storage.local.set({ blockedDomains, unlockMinutes });

  // Reflect the normalized list back to the user.
  domainsEl.value = blockedDomains.join("\n");
  minutesEl.value = unlockMinutes;

  savedEl.classList.add("show");
  setTimeout(() => savedEl.classList.remove("show"), 1500);
}

document.getElementById("save").addEventListener("click", save);
load();
