const parts = window.location.pathname.split("/").filter(Boolean);
const roomCode = parts[parts.length - 1];

if (!roomCode || parts[0] !== "game") {
  alert("Missing room code in URL. Expected /game/XXXXXX");
}

// --- same symbol helper idea you had before ---
function cardSymbol(card) {
  const v = String(card.value);
  if (v === "skip") return "⏭";
  if (v === "reverse") return "🔄";
  if (v === "draw2") return "+2";
  if (v === "wild") return "W";
  if (v === "wild_draw4") return "+4";
  return v; // numbers "0".."9"
}

function cardCssType(card) {
  const v = String(card.value);
  if (/^\d+$/.test(v)) return "number";
  if (v === "wild" || v === "wild_draw4") return v === "wild_draw4" ? "draw4" : "wild";
  return v; // skip/reverse/draw2
}

function renderCardDiv(card, clickable, onClick) {
  const symbol = cardSymbol(card);
  const typeClass = cardCssType(card);
  const colorClass = card.color; // red/green/blue/yellow/wild

  const div = document.createElement("div");
  div.className = `uno-card ${colorClass} ${typeClass}`;
  div.innerHTML = `
    <span class="card-top-left">${symbol}</span>
    <span class="card-center"><span class="icon">${symbol}</span></span>
    <span class="card-bottom-right">${symbol}</span>
  `;

  if (clickable) {
    div.style.cursor = "pointer";
    div.addEventListener("click", onClick);
  }

  return div;
}

// DOM nodes from your existing game.ejs markup (same IDs as before)
const playerHandEl = document.getElementById("player-hand");
const discardPileEl = document.getElementById("discard-pile");
const drawPileEl = document.getElementById("draw-pile");

// Optional: if you add these IDs later, we’ll fill them.
// If they don’t exist, we just skip.
const infoGameName = document.getElementById("gameName");
const infoPlayerCount = document.getElementById("playerCount");
const infoTurn = document.getElementById("currentTurn");

let lastState = null;

async function fetchState() {
  const res = await fetch(`/api/games/${roomCode}/state`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

async function playCard(card) {
  const body = { cardId: card.id };

  // Wild needs a chosen color
  if (card.value === "wild" || card.value === "wild_draw4") {
    const choice = prompt("Choose color: red, yellow, green, blue");
    body.wildColor = choice;
  }

  const res = await fetch(`/api/games/${roomCode}/play`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    alert(await res.text());
  }
}

async function drawCard() {
  const res = await fetch(`/api/games/${roomCode}/draw`, { method: "POST" });
  if (!res.ok) {
    alert(await res.text());
  }
}

function render(state) {
  // Info bar (optional IDs)
  if (infoGameName) infoGameName.textContent = roomCode;
  if (infoPlayerCount) infoPlayerCount.textContent = `${state.players.length}`;
  if (infoTurn) {
    const username = state.currentTurnUsername ?? "";
    const p = state.players?.find(x => x.username === username);

    // default: show nickname if available, otherwise username
    let label = p?.nickname ?? username ?? "—";

    // if it's a bot like BOT_1 / BOT_2 / BOT_3, show Bot 1/2/3
    const m = /^BOT_(\d+)$/.exec(username);
    if (m) label = `Bot ${m[1]}`;

    infoTurn.textContent = label || "—";
  }

  // Discard pile (top card)
  discardPileEl.innerHTML = "";
  if (state.topCard) {
    const top = renderCardDiv(
      { id: "top", color: state.topCard.color, value: state.topCard.value },
      false
    );
    discardPileEl.appendChild(top);
  }

  // Draw pile (click to draw)
  drawPileEl.innerHTML = "";
  const drawBack = document.createElement("div");
  drawBack.className = "uno-card";
  drawBack.textContent = "Draw";
  drawBack.style.display = "flex";
  drawBack.style.alignItems = "center";
  drawBack.style.justifyContent = "center";
  drawBack.style.cursor = "pointer";
  drawBack.addEventListener("click", drawCard);
  drawPileEl.appendChild(drawBack);

  // Your hand
  playerHandEl.innerHTML = "";
  state.yourHand.forEach((card) => {
    const div = renderCardDiv(card, true, () => playCard(card));
    playerHandEl.appendChild(div);
  });

  //Turn Glow
  if (window.updateTurnGlow){
    window.updateTurnGlow(state);
  }


}

async function loop() {
  try {
    const state = await fetchState();
    lastState = state;

    if (state.status === "finished") {
      alert("Game finished!");
      return;
    }

    render(state);
    if (window.updateTurnGlow) window.updateTurnGlow(state);
  } catch (e) {
    console.error(e);
  }
}

loop();
setInterval(loop, 1000);
