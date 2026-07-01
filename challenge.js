import { randomSlug } from "./problems.js";
import { getSettings } from "./config.js";

const GRAPHQL = "https://leetcode.com/graphql";
let unlockMinutes = 20;

const els = {
  title: document.getElementById("title"),
  difficulty: document.getElementById("difficulty"),
  content: document.getElementById("content"),
  link: document.getElementById("lc-link"),
  code: document.getElementById("code"),
  submit: document.getElementById("submit"),
  skip: document.getElementById("skip"),
  reset: document.getElementById("reset"),
  result: document.getElementById("result"),
  banner: document.getElementById("banner")
};

let current = null; // { questionId, slug, title, snippet }

function param(name) {
  return new URLSearchParams(location.search).get(name);
}

function setResult(text, cls) {
  els.result.textContent = text;
  els.result.className = "result" + (cls ? " " + cls : "");
}

function showBanner(html) {
  els.banner.innerHTML = html;
  els.banner.classList.remove("hidden");
}

async function getCsrfToken() {
  const cookie = await chrome.cookies.get({
    url: "https://leetcode.com",
    name: "csrftoken"
  });
  return cookie?.value || null;
}

async function gql(query, variables) {
  const res = await fetch(GRAPHQL, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ query, variables })
  });
  if (!res.ok) throw new Error(`GraphQL ${res.status}`);
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message || "GraphQL error");
  return json.data;
}

const QUESTION_QUERY = `
  query questionData($titleSlug: String!) {
    question(titleSlug: $titleSlug) {
      questionId
      questionFrontendId
      title
      titleSlug
      difficulty
      content
      codeSnippets { langSlug code }
    }
  }`;

async function loadProblem() {
  els.submit.disabled = true;
  els.skip.disabled = true;
  setResult("", "");
  els.title.textContent = "Loading a problem…";
  els.content.innerHTML = "";
  els.difficulty.textContent = "";

  const slug = randomSlug();
  try {
    const { question: q } = await gql(QUESTION_QUERY, { titleSlug: slug });
    const py = q.codeSnippets.find((s) => s.langSlug === "python3");
    current = {
      questionId: q.questionId,
      slug: q.titleSlug,
      title: q.title,
      snippet: py ? py.code : "class Solution:\n    pass\n"
    };

    els.title.textContent = `${q.questionFrontendId}. ${q.title}`;
    els.difficulty.textContent = q.difficulty;
    els.difficulty.className = "difficulty " + q.difficulty;
    els.content.innerHTML = q.content || "<em>No description.</em>";
    els.link.href = `https://leetcode.com/problems/${q.titleSlug}/`;
    els.link.classList.remove("hidden");
    els.code.value = current.snippet;

    els.submit.disabled = false;
    els.skip.disabled = false;
  } catch (e) {
    els.title.textContent = "Couldn't load a problem";
    setResult(String(e.message || e), "bad");
    els.skip.disabled = false;
  }
}

async function poll(submissionId) {
  const url = `https://leetcode.com/submissions/detail/${submissionId}/check/`;
  for (let i = 0; i < 40; i++) {
    const res = await fetch(url, { credentials: "include" });
    const data = await res.json();
    if (data.state === "SUCCESS") return data;
    setResult(`Judging…  (${data.state?.toLowerCase() || "pending"})`, "pending");
    await new Promise((r) => setTimeout(r, 900));
  }
  throw new Error("Timed out waiting for the judge.");
}

async function submit() {
  if (!current) return;
  els.submit.disabled = true;
  els.skip.disabled = true;
  setResult("Submitting…", "pending");

  const csrf = await getCsrfToken();
  if (!csrf) {
    setResult("", "");
    showBanner(
      'You\'re not signed in to LeetCode. <a href="https://leetcode.com/accounts/login/" target="_blank" rel="noopener">Log in here</a>, then click “new problem”.'
    );
    els.submit.disabled = false;
    els.skip.disabled = false;
    return;
  }

  try {
    const res = await fetch(
      `https://leetcode.com/problems/${current.slug}/submit/`,
      {
        method: "POST",
        headers: { "content-type": "application/json", "x-csrftoken": csrf },
        credentials: "include",
        body: JSON.stringify({
          lang: "python3",
          question_id: current.questionId,
          typed_code: els.code.value
        })
      }
    );

    if (res.status === 403 || res.redirected) {
      throw new Error("LeetCode rejected the submission — try logging in again.");
    }
    if (res.status === 429) {
      throw new Error("Rate limited by LeetCode. Wait a moment and resubmit.");
    }
    const { submission_id } = await res.json();
    if (!submission_id) throw new Error("No submission id returned.");

    const result = await poll(submission_id);
    const msg = result.status_msg || "Unknown";

    if (msg === "Accepted") {
      const passed = `${result.total_correct}/${result.total_testcases}`;
      setResult(
        `✅ Accepted — ${passed} cases, ${result.status_runtime}. Unlocking for ${unlockMinutes} min…`,
        "ok"
      );
      await unlock();
    } else {
      const detail =
        result.status_msg === "Runtime Error" || result.status_msg === "Compile Error"
          ? `\n${result.full_runtime_error || result.runtime_error || result.compile_error || ""}`
          : result.total_correct != null
          ? `  (${result.total_correct}/${result.total_testcases} passed)`
          : "";
      setResult(`❌ ${msg}${detail}\n\nFix it and submit again.`, "bad");
      els.submit.disabled = false;
      els.skip.disabled = false;
    }
  } catch (e) {
    setResult(String(e.message || e), "bad");
    els.submit.disabled = false;
    els.skip.disabled = false;
  }
}

async function unlock() {
  // Background falls back to the stored unlock window when minutes is omitted.
  await chrome.runtime.sendMessage({ type: "unlock" });
  const to = param("to") || "https://www.google.com/";
  setTimeout(() => {
    location.replace(to);
  }, 900);
}

els.submit.addEventListener("click", submit);
els.skip.addEventListener("click", loadProblem);
els.reset.addEventListener("click", () => {
  if (current) els.code.value = current.snippet;
});

// Tab inserts 4 spaces instead of moving focus.
els.code.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const s = els.code.selectionStart;
    const eN = els.code.selectionEnd;
    els.code.value = els.code.value.slice(0, s) + "    " + els.code.value.slice(eN);
    els.code.selectionStart = els.code.selectionEnd = s + 4;
  }
});

getSettings().then(({ unlockMinutes: m }) => {
  unlockMinutes = m;
  const sub = document.getElementById("sub");
  if (sub) sub.textContent = `Solve this LeetCode problem in Python to unlock your blocked sites for ${m} minutes.`;
});

loadProblem();
