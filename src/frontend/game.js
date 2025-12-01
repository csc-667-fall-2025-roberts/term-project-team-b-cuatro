// -----------------------------
// Card definitions
// -----------------------------
const colors = ["red", "green", "blue", "yellow"];
const numbers = [0,1,2,3,4,5,6,7,8,9];
const actions = ["skip", "reverse", "draw2"]; // colored action cards
const wilds = ["wild", "draw4"];              // colorless wild cards

// -----------------------------
// Helper function for special card symbols
// -----------------------------
function cardSymbol(card) {
    switch(card.type) {
        case "skip": return "⏭";
        case "reverse": return "🔄";
        case "draw2": return "+2";
        case "wild": return "";   // regular wild has no symbol in center
        case "draw4": return "+4";
        default: return card.value; // number cards
    }
}

// -----------------------------
// Generate example player hand
// -----------------------------
const playerHand = document.getElementById("player-hand");

for (let i = 0; i < 7; i++) {
    let cardTypeRoll = Math.random();
    let card = {};

    if (cardTypeRoll < 0.7) {
        // 70% chance number card
        card.type = "number";
        card.color = colors[Math.floor(Math.random() * colors.length)];
        card.value = numbers[Math.floor(Math.random() * numbers.length)];
    } else if (cardTypeRoll < 0.9) {
        // 20% chance action card
        card.type = actions[Math.floor(Math.random() * actions.length)];
        card.color = colors[Math.floor(Math.random() * colors.length)];
        card.value = card.type;
    } else {
        // 10% chance wild card
        card.type = wilds[Math.floor(Math.random() * wilds.length)];
        card.color = "wild";
        card.value = card.type;
    }

    const symbol = cardSymbol(card);

    const cardDiv = document.createElement("div");
    cardDiv.className = `uno-card ${card.color} ${card.type}`;
    cardDiv.innerHTML = `
        <span class="card-top-left">${symbol}</span>
        <span class="card-center"><span class="icon">${symbol}</span></span>
        <span class="card-bottom-right">${symbol}</span>
    `;

    playerHand.appendChild(cardDiv);
}

// -----------------------------
// Discard pile setup (example card)
// -----------------------------
const discardPile = document.getElementById("discard-pile");
const discardCard = document.createElement("div");

// Example: draw4 wild card
discardCard.className = "uno-card wild draw4";
discardCard.innerHTML = `
    <span class="card-top-left">+4</span>
    <span class="card-center"><span class="icon">+4</span></span>
    <span class="card-bottom-right">+4</span>
`;
discardPile.appendChild(discardCard);

// -----------------------------
// Draw pile placeholder
// -----------------------------
const drawPile = document.getElementById("draw-pile");
drawPile.innerHTML = "Draw Pile";
