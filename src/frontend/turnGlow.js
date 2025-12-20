(function () {
  const COLOR_MAP = {
    red: "#e74c3c",
    green: "#2ecc71",
    blue: "#3498db",
    yellow: "#f1c40f",
    wild: "#9b59b6",
  };

  function getMyUsername() {
    const main = document.querySelector("main.game-layout");
    return main?.dataset?.myUsername || "";
  }

  function getActiveCardColorFromDOM() {
    // discard pile top card is rendered into #discard-pile as a .uno-card
    const top = document.querySelector("#discard-pile .uno-card");
    if (!top) return COLOR_MAP.wild;

    const classes = Array.from(top.classList);

    // your cards use class names like: uno-card red / blue / green / yellow / wild
    if (classes.includes("red")) return COLOR_MAP.red;
    if (classes.includes("green")) return COLOR_MAP.green;
    if (classes.includes("blue")) return COLOR_MAP.blue;
    if (classes.includes("yellow")) return COLOR_MAP.yellow;
    if (classes.includes("wild")) return COLOR_MAP.wild;

    return COLOR_MAP.wild;
  }

  function clearAllActiveTurns() {
    document.querySelectorAll(".active-turn").forEach((el) => el.classList.remove("active-turn"));
  }

  function applyGlowToCurrentPlayerSlot(currentTurnUsername, statePlayers, turnColor) {
    // We have 3 opponent slots in the DOM: top/left/right
    // Figure out which opponent is whose username based on index in state.players.
    // Your EJS layout is:
    // opponents[0] -> top, opponents[1] -> left, opponents[2] -> right
    // and "you" is NOT in those slots.
    const myUsername = getMyUsername();
    const others = (statePlayers || []).filter(p => p.username && p.username !== myUsername);

    const mapping = [
      { username: others[0]?.username, selector: ".player-slot.player-top" },
      { username: others[1]?.username, selector: ".player-slot.player-left" },
      { username: others[2]?.username, selector: ".player-slot.player-right" },
    ];

    const match = mapping.find(m => m.username === currentTurnUsername);
    if (!match) return;

    const slot = document.querySelector(match.selector);
    if (!slot) return;

    slot.style.setProperty("--turn-color", turnColor);
    slot.classList.add("active-turn");
  }

  function applyGlowToYourHandIfYourTurn(currentTurnUsername, turnColor) {
    const myUsername = getMyUsername();
    const handSection = document.querySelector("section.player-hand.card");
    if (!handSection) return;

    if (currentTurnUsername && myUsername && currentTurnUsername === myUsername) {
      handSection.style.setProperty("--turn-color", turnColor);
      handSection.classList.add("active-turn");
    }
  }

  // Expose to window so game.js can call it after render(state)
  window.updateTurnGlow = function updateTurnGlow(state) {
    try {
      clearAllActiveTurns();

      const turnColor = getActiveCardColorFromDOM();
      const currentTurnUsername = state?.currentTurnUsername || "";
      const players = state?.players || [];

      // glow opponents slot (top/left/right) if it’s their turn
      applyGlowToCurrentPlayerSlot(currentTurnUsername, players, turnColor);

      // glow your hand section if it’s your turn
      applyGlowToYourHandIfYourTurn(currentTurnUsername, turnColor);
    } catch (e) {
      // If something breaks, don’t kill the whole UI loop
      console.error("updateTurnGlow failed:", e);
    }
  };
})();
