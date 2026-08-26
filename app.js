import { createResponseStore } from "./store.js";

const config = window.POLL_CONFIG;
const questions = {
  "1": {
    title: "Which woman belongs in the mining industry?",
    prompt: "Choose one answer.",
    options: ["Mbokodo", "Egg", "Marshmallow", "Air bubble"]
  },
  "2": {
    title: "Are we still solving the same problem?",
    prompt: "Choose one answer.",
    options: ["Yes", "No"]
  },
  "3": {
    title: config.thirdQuestion,
    prompt: "Submit one word.",
    word: true
  }
};

const params = new URLSearchParams(location.search);
const questionId = questions[params.get("q")] ? params.get("q") : "1";
const question = questions[questionId];
const root = document.querySelector("#question-root");
const number = document.querySelector("#question-number");
const state = document.querySelector("#connection-state");
const responseKey = `${config.pollId}:answered:${questionId}`;

number.textContent = `Question ${questionId} of 3`;

function renderQuestion() {
  const control = question.word
    ? `<label class="word-label" for="word-answer">Your word</label>
       <input id="word-answer" class="word-input" name="answer" type="text" maxlength="${config.maxWordLength}" autocomplete="off" placeholder="Type one word" required>`
    : `<div class="choice-list">${question.options.map((option, index) => `
        <label class="choice">
          <input type="radio" name="answer" value="${option}" ${index === 0 ? "required" : ""}>
          <span><i></i>${option}</span>
        </label>`).join("")}</div>`;

  root.innerHTML = `
    <form id="response-form">
      <p class="question-prompt">${question.prompt}</p>
      <h1>${question.title}</h1>
      ${control}
      <button class="submit-button" type="submit">Submit response</button>
      <p id="form-message" class="form-message" role="status"></p>
    </form>`;

  const form = document.querySelector("#response-form");
  form.addEventListener("submit", submitResponse);

  if (localStorage.getItem(responseKey)) {
    showThanks("Your response has already been received.");
  }
}

function showThanks(message) {
  root.innerHTML = `
    <div class="thanks-state">
      <span class="thanks-check" aria-hidden="true">&#10003;</span>
      <h1>Thank you.</h1>
      <p>${message}</p>
    </div>`;
}

async function submitResponse(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button");
  const message = form.querySelector("#form-message");
  const formData = new FormData(form);
  let answer = String(formData.get("answer") || "").trim();

  if (question.word) {
    answer = answer.split(/\s+/)[0].slice(0, config.maxWordLength);
  }
  if (!answer) return;

  button.disabled = true;
  button.textContent = "Sending...";
  message.textContent = "";

  try {
    const store = await createResponseStore();
    await store.submit({ poll_id: config.pollId, question_id: questionId, answer });
    localStorage.setItem(responseKey, answer);
    showThanks("Your answer is now part of the live conversation.");
  } catch (error) {
    console.error(error);
    button.disabled = false;
    button.textContent = "Try again";
    message.textContent = "We could not send your response. Please try again.";
  }
}

try {
  const store = await createResponseStore();
  state.textContent = store.mode === "live" ? "Live" : "Demo mode";
  state.classList.add(store.mode);
} catch {
  state.textContent = "Offline";
}

renderQuestion();
