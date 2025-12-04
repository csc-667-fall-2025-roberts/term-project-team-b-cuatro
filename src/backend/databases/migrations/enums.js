//handeling all my enums: card color, card number, card status, state
exports.shorthands = {};

exports.up = (pgm) =>{
    pgm.createType('card_color', ['red', 'blue', 'green', 'yellow', 'wild']);
    pgm.createType('card_num', ['0', '1', '2', '3', '4','5', '6', '7', '8', '9',
    'skip','reverse','draw2','wild','wild_draw4'  ]);

    pgm.createType('card_status', ['in_deck', 'in_hand', 'discarded']);
    pgm.createType('game_state', ['waiting', 'running', 'end']); //Not as necesary 
}

exports.down = (pgm) =>{
    pgm.dropType('game_state');
    pgm.dropType('card_status');
    pgm.dropType('card_num');
    pgm.dropType('card_color');
}