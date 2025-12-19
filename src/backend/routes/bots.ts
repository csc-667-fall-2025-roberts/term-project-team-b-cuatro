import { GameRoom, Player, UnoCard, UnoColor } from "./game";

function canPlay(card: UnoCard, top: UnoCard): boolean {
    if (card.value === "wild" || card.value === "wild_draw4") return true;
    return card.color === top.color || card.value === top.value;
}

function randomColor(): UnoColor {
    const colors: UnoColor[] = ["red", "yellow", "green", "blue"];
    return colors[Math.floor(Math.random() * colors.length)];
}

function sleep(ms: number) {
    return new Promise<void>((resolve) => setTimeout(resolve, ms));
}

export function runBotTurn(game: GameRoom) {
    const player = game.players[game.currentTurnIndex];

    // Safety check
    if (!player.username.startsWith("BOT_")) return;
    if (!player.hand || player.hand.length === 0) return;

    const top = game.discard[game.discard.length - 1];

    // Try to play a card
    const playable = player.hand.find(card => canPlay(card, top));

    if (playable) {
        // Remove card from hand
        player.hand.splice(player.hand.indexOf(playable), 1);

        // Wild handling
        if (playable.value === "wild" || playable.value === "wild_draw4") {
        playable.color = randomColor();
        }

        game.discard.push(playable);

        // Apply effects
        if (playable.value === "reverse") {
        game.direction = game.direction === 1 ? -1 : 1;
        }

        if (playable.value === "skip") {
        game.currentTurnIndex =
            (game.currentTurnIndex + game.direction + game.players.length) %
            game.players.length;
        }

        if (playable.value === "draw2") {
        game.pendingDraw += 2;
        }

        if (playable.value === "wild_draw4") {
        game.pendingDraw += 4;
        }

        // Win condition
        if (player.hand.length === 0) {
        game.status = "finished";
        return;
        }
    } else {
        // Draw one card
        const card = game.deck.pop();
        if (card) {
        player.hand.push(card);
        }
    }

    // Advance turn
    game.currentTurnIndex =
        (game.currentTurnIndex + game.direction + game.players.length) %
        game.players.length;
}

// Delay moves
export function scheduleBotTurns(game: GameRoom) {
    const anyGame = game as any;
    if (anyGame._botLoopRunning) return;
    anyGame._botLoopRunning = true;

    const loop = async () => {
        try {
        while (
            game.status === "running" &&
            game.players[game.currentTurnIndex]?.username?.startsWith("BOT_")
        ) {
            const delay = 3000;
            await sleep(delay);
            runBotTurn(game);
        }
        } finally {
        anyGame._botLoopRunning = false;
        }
    };

    void loop();
}