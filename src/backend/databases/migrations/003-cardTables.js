//handeling all my enums: card color, card number, card status, state
exports.shorthands = {
    id: {
        type: 'serial',
        primaryKey: true,
  },
    timestamp_now: {
        type: 'timestamptz',
        notNull: true,
        default: 'now()',
  },
};//end of shorthands

exports.up = (pgm) =>{
    //------------------------------------------------------------------------------
    pgm.createTable('card',{
        id: 'id',
        color: { type: 'card_color',  notNull: true },
        number: { type: 'card_num', notNull: true },
    });//end of card
    //------------------------------------------------------------------------------
    pgm.createTable('deck',{
        id: 'id',
        card_id: { type: 'integer', notNull: true, references: '"card"', onDelete: 'CASCADE'},
        game_id: {type: 'integer', notNull: true, references: '"games"', onDelete: 'CASCADE'},
        player_id: { type: 'integer', references: '"users"', onDelete: 'SET NULL'},
        card_status: { type: 'card_status', notNull: true },
        position: { type: 'integer' },
        created_at: 'timestamp_now'
    });//end of deck
    //------------------------------------------------------------------------------
    //TODO: create index's for better time complexity.

};
exports.down = (pgm) =>{
    pgm.dropTable('deck');
    pgm.dropTable('card');
};