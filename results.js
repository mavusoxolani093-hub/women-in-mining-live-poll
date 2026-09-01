import { createResponseStore } from "./store.js";

const config = window.POLL_CONFIG;
const state = document.querySelector("#results-state");
const activeQuestion = document.body.dataset.resultQuestion;
const responsesById = new Map();
const wordParticles = new Map();
let wordMotionFrame = null;
let wordMotionTime = 0;
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

function bubbleMetrics(word, count) {
  const prominence = Math.min(3, Math.sqrt(Math.max(1, count)));
  const fontSize = Math.round(16 + (prominence - 1) * 12);
  const textWidth = word.length * fontSize * 0.58;
  return {
    width: Math.round(Math.min(500, Math.max(104, textWidth + 64 + (prominence - 1) * 34))),
    height: Math.round(52 + (prominence - 1) * 30),
    fontSize,
    shadow: Math.min(0.28, 0.08 + (prominence - 1) * 0.08)
  };
}

function createWordParticle(bubble, cloud, index) {
  const hash = wordHash(bubble.dataset.wordKey || "word");
  const width = bubble.offsetWidth;
  const height = bubble.offsetHeight;
  const maxX = Math.max(0, cloud.clientWidth - width);
  const maxY = Math.max(0, cloud.clientHeight - height);
  let bestPosition = { x: 0, y: 0, overlap: Number.POSITIVE_INFINITY };

  for (let attempt = 0; attempt < 24; attempt += 1) {
    const xSeed = ((hash * 37 + index * 211 + attempt * 149) % 997) / 997;
    const ySeed = ((hash * 61 + index * 137 + attempt * 227) % 991) / 991;
    const candidate = { x: maxX * xSeed, y: maxY * ySeed, overlap: 0 };

    wordParticles.forEach((other, otherBubble) => {
      const overlapX = Math.max(0, Math.min(candidate.x + width, other.x + otherBubble.offsetWidth) - Math.max(candidate.x, other.x));
      const overlapY = Math.max(0, Math.min(candidate.y + height, other.y + otherBubble.offsetHeight) - Math.max(candidate.y, other.y));
      candidate.overlap += overlapX * overlapY;
    });

    if (candidate.overlap < bestPosition.overlap) bestPosition = candidate;
    if (candidate.overlap === 0) break;
  }

  const particle = {
    x: bestPosition.x,
    y: bestPosition.y,
    vx: (hash % 2 ? 1 : -1) * (20 + hash % 11),
    vy: (hash % 3 ? 1 : -1) * (16 + hash % 9)
  };
  wordParticles.set(bubble, particle);
  return particle;
}

function resolveWordCollisions(entries, cloudWidth, cloudHeight) {
  for (let firstIndex = 0; firstIndex < entries.length; firstIndex += 1) {
    const [firstBubble, first] = entries[firstIndex];
    const firstWidth = firstBubble.offsetWidth;
    const firstHeight = firstBubble.offsetHeight;

    for (let secondIndex = firstIndex + 1; secondIndex < entries.length; secondIndex += 1) {
      const [secondBubble, second] = entries[secondIndex];
      const secondWidth = secondBubble.offsetWidth;
      const secondHeight = secondBubble.offsetHeight;
      const overlapX = Math.min(first.x + firstWidth, second.x + secondWidth) - Math.max(first.x, second.x);
      const overlapY = Math.min(first.y + firstHeight, second.y + secondHeight) - Math.max(first.y, second.y);
      if (overlapX <= 0 || overlapY <= 0) continue;

      if (overlapX < overlapY) {
        const firstIsLeft = first.x + firstWidth / 2 < second.x + secondWidth / 2;
        const shift = overlapX / 2 + 0.5;
        first.x += firstIsLeft ? -shift : shift;
        second.x += firstIsLeft ? shift : -shift;
        const movingTogether = firstIsLeft ? first.vx > second.vx : first.vx < second.vx;
        if (movingTogether) [first.vx, second.vx] = [second.vx, first.vx];
      } else {
        const firstIsAbove = first.y + firstHeight / 2 < second.y + secondHeight / 2;
        const shift = overlapY / 2 + 0.5;
        first.y += firstIsAbove ? -shift : shift;
        second.y += firstIsAbove ? shift : -shift;
        const movingTogether = firstIsAbove ? first.vy > second.vy : first.vy < second.vy;
        if (movingTogether) [first.vy, second.vy] = [second.vy, first.vy];
      }

      first.x = Math.max(0, Math.min(first.x, cloudWidth - firstWidth));
      first.y = Math.max(0, Math.min(first.y, cloudHeight - firstHeight));
      second.x = Math.max(0, Math.min(second.x, cloudWidth - secondWidth));
      second.y = Math.max(0, Math.min(second.y, cloudHeight - secondHeight));
    }
  }
}

function animateWords(timestamp) {
  const cloud = document.querySelector("#word-cloud");
  if (!cloud || !cloud.isConnected) {
    wordMotionFrame = null;
    return;
  }

  const bubbles = [...cloud.querySelectorAll(".word-bubble")];
  if (!bubbles.length) {
    wordMotionFrame = null;
    wordMotionTime = 0;
    return;
  }
  const delta = wordMotionTime ? Math.min((timestamp - wordMotionTime) / 1000, 0.04) : 0;
  wordMotionTime = timestamp;
  const cloudWidth = cloud.clientWidth;
  const cloudHeight = cloud.clientHeight;

  bubbles.forEach((bubble, index) => {
    const particle = wordParticles.get(bubble) || createWordParticle(bubble, cloud, index);
    const width = bubble.offsetWidth;
    const height = bubble.offsetHeight;
    const maxX = Math.max(0, cloudWidth - width);
    const maxY = Math.max(0, cloudHeight - height);

    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    if (particle.x <= 0 && particle.vx < 0) particle.vx *= -1;
    if (particle.x >= maxX && particle.vx > 0) particle.vx *= -1;
    if (particle.y <= 0 && particle.vy < 0) particle.vy *= -1;
    if (particle.y >= maxY && particle.vy > 0) particle.vy *= -1;
    particle.x = Math.max(0, Math.min(particle.x, maxX));
    particle.y = Math.max(0, Math.min(particle.y, maxY));
  });

  const entries = bubbles.map(bubble => [bubble, wordParticles.get(bubble)]);
  resolveWordCollisions(entries, cloudWidth, cloudHeight);
  entries.forEach(([bubble, particle]) => {
    bubble.style.transform = `translate3d(${particle.x}px, ${particle.y}px, 0)`;
    bubble.classList.add("is-positioned");
  });

  wordMotionFrame = window.requestAnimationFrame(animateWords);
}

function startWordMotion() {
  if (wordMotionFrame !== null) return;
  wordMotionTime = 0;
  wordMotionFrame = window.requestAnimationFrame(animateWords);
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
    wordParticles.clear();
    cloud.innerHTML = '<p class="empty-state">Words will appear here live.</p>';
    return;
  }

  cloud.querySelector(".empty-state")?.remove();
  const activeKeys = new Set(counts.keys());
  const bubbles = new Map(
    [...cloud.querySelectorAll(".word-bubble")].map(bubble => [bubble.dataset.wordKey, bubble])
  );

  bubbles.forEach((bubble, key) => {
    if (!activeKeys.has(key)) {
      wordParticles.delete(bubble);
      bubble.remove();
    }
  });

  counts.forEach((item, key) => {
    const hash = wordHash(item.word);
    const metrics = bubbleMetrics(item.word, item.count);
    let bubble = bubbles.get(key);

    if (!bubble) {
      bubble = document.createElement("span");
      bubble.dataset.wordKey = key;
      bubble.innerHTML = '<span class="word-bubble-label"></span><span class="word-bubble-count"></span>';
      cloud.appendChild(bubble);
    }

    bubble.className = `word-bubble bubble-${hash % 5}`;
    bubble.style.setProperty("--bubble-width", `${metrics.width}px`);
    bubble.style.setProperty("--bubble-height", `${metrics.height}px`);
    bubble.style.setProperty("--bubble-font", `${metrics.fontSize}px`);
    bubble.style.setProperty("--bubble-shadow", metrics.shadow);
    bubble.setAttribute("aria-label", `${item.word}, ${plural(item.count)}`);
    bubble.querySelector(".word-bubble-label").textContent = item.word;

    const countBadge = bubble.querySelector(".word-bubble-count");
    countBadge.textContent = item.count;
    countBadge.hidden = item.count === 1;
  });
  startWordMotion();
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

const previewMode = activeQuestion === "3"
  && ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get("preview") === "words";

if (previewMode) {
  const previewWords = [
    "Leadership", "Opportunity", "Equality", "Innovation", "Growth", "Empowerment", "Future",
    "Leadership", "Opportunity", "Leadership", "Equality", "Leadership", "Opportunity",
    "Innovation", "Leadership", "Growth", "Opportunity", "Leadership", "Equality",
    "Leadership", "Opportunity", "Leadership", "Innovation", "Leadership", "Opportunity"
  ];
  state.textContent = "Preview";
  state.classList.add("demo");
  previewWords.slice(0, 7).forEach((answer, index) => addResponse({
    id: `preview-${index}`,
    question_id: "3",
    answer
  }));
  previewWords.slice(7).forEach((answer, index) => {
    window.setTimeout(() => addResponse({
      id: `preview-${index + 7}`,
      question_id: "3",
      answer
    }), (index + 1) * 280);
  });
} else {
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
}

const thirdTitle = document.querySelector("#q3-title");
if (thirdTitle) thirdTitle.textContent = config.thirdQuestion;
