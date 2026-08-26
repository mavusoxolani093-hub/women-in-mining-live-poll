import { createResponseStore } from "./store.js";

const config = window.POLL_CONFIG;
const state = document.querySelector("#results-state");
const activeQuestion = document.body.dataset.resultQuestion;
const responsesById = new Map();
const options = {
  "1": ["Mbokodo", "Egg", "Marshmallow", "Air bubble"],
  "2": ["Yes", "No"]
};

function plural(count) {
  return `${count} response${count === 1 ? "" : "s"}`;
}

function escapeHtml(value) {
  const node = document.createElement("span");
  node.textContent = value;
  return node.innerHTML;
}

function questionResponses(questionId) {
  return [...responsesById.values()].filter(item => item.question_id === questionId);
}

function renderBars(questionId) {
  const responses = questionResponses(questionId);
  const counts = Object.fromEntries(options[questionId].map(option => [option, 0]));
  responses.forEach(item => {
    if (item.answer in counts) counts[item.answer] += 1;
  });

  const total = document.querySelector(`#q${questionId}-total`);
  const chart = document.querySelector(`#q${questionId}-bars`);
  if (!total || !chart) return;
  total.textContent = plural(responses.length);
  chart.innerHTML = options[questionId].map((option, index) => {
    const count = counts[option];
    const percent = responses.length ? Math.round((count / responses.length) * 100) : 0;
    return `<div class="bar-row color-${index + 1}">
      <div class="bar-label"><span>${option}</span><strong>${percent}%</strong></div>
      <div class="bar-track"><i style="width:${percent}%"></i></div>
      <small>${count}</small>
    </div>`;
  }).join("");
}

function wordHash(word) {
  return [...word].reduce((total, character) => total + character.charCodeAt(0), 0);
}

function renderWords() {
  const responses = questionResponses("3");
  const counts = new Map();
  responses.forEach(item => {
    const word = item.answer.trim();
    const key = word.toLocaleLowerCase();
    if (!key) return;
    const current = counts.get(key) || { word, count: 0 };
    current.count += 1;
    counts.set(key, current);
  });

  const total = document.querySelector("#q3-total");
  const cloud = document.querySelector("#word-cloud");
  if (!total || !cloud) return;
  total.textContent = plural(responses.length);
  if (!counts.size) {
    cloud.innerHTML = '<p class="empty-state">Words will appear here live.</p>';
    return;
  }

  const highest = Math.max(...[...counts.values()].map(item => item.count));
  cloud.innerHTML = [...counts.values()]
    .sort((a, b) => b.count - a.count || a.word.localeCompare(b.word))
    .map(item => {
      const hash = wordHash(item.word);
      const scale = 0.82 + (item.count / highest) * 0.5;
      return `<span class="word-bubble bubble-${hash % 5}" style="--scale:${scale};--delay:-${hash % 8}s">${escapeHtml(item.word)}${item.count > 1 ? `<sup>${item.count}</sup>` : ""}</span>`;
    }).join("");
}

function render() {
  if (activeQuestion === "1" || activeQuestion === "2") renderBars(activeQuestion);
  if (activeQuestion === "3") renderWords();
}

function addResponse(response) {
  if (!response?.id || responsesById.has(response.id)) return;
  responsesById.set(response.id, response);
  render();
}

async function refresh(store) {
  const responses = await store.getAll();
  responsesById.clear();
  responses.forEach(response => responsesById.set(response.id, response));
  render();
}

document.querySelector("#fullscreen-button")?.addEventListener("click", () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});

try {
  const store = await createResponseStore();
  state.textContent = store.mode === "live" ? "Live" : "Demo mode";
  state.classList.add(store.mode);
  await refresh(store);
  store.subscribe(response => response ? addResponse(response) : refresh(store));
} catch (error) {
  console.error(error);
  state.textContent = "Connection error";
  state.classList.add("error");
}

const thirdTitle = document.querySelector("#q3-title");
if (thirdTitle) thirdTitle.textContent = config.thirdQuestion;
