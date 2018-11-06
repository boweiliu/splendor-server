'use strict'
const express = require('express');
const argv = require('minimist')(process.argv);
const cookieParser = require('cookie-parser')
const uuid = require('uuid')

const port = argv.port || 3000;
const COOKIE_NAME = 'splendor-server'

const app = express()
app.use(express.json())
app.use(express.urlencoded())
app.use(cookieParser())

const INDEX_STRING = 
`
<style>
table, th, td {
    border: 1px solid black;
    border-collapse: collapse;
}
th, td {
    padding: 5px;
}
</style>

<form action="/__GAME_ID__" method="post">
  <input type="submit" value="Play">
  <input type="text" name="command" value="__COMMAND__"><br>
</form> 

__BODY__
`

const HELP_TABLE = (() => {
    let rows = []
    // reserve yn for yes/no, df for possible further card tiers
    rows.push(['Take jewels', '<code>[QqWwEeRrTt-]{2,3}</code>'])
    rows.push(['Buy cards', '<code>[A-Ca-c][1-4]|[Xx][1-3]</code>'])
    rows.push(['Reserve cards', '<code>[Gg][A-Ca-z][0-4]</code>'])
    rows.push(['[U]ndo (if possible)', 'u'])
    rows.push(['Show [h]elp', 'h'])
    rows.push(['Show [i]nventory', 'i'])
    rows.push(['Show [o]pponent inventory', 'o'])
    rows.push(['Show cards on [m]arket', 'm'])
    rows.push(['Show cards by [j]ewels provided', 'j'])
    rows.push(['[L]ist buyable cards sorted by price', 'l'])
    rows.push(['Show [s]tocks of resources', 's'])
    rows.push(['Show currently accessible [V]P sources', 'v'])
    //rows.push(['Repeat last show command [a]gain', '']) // this should be the default
    //rows.push(['Wait until your turn', 'z'])
    rows.push(['Show which [p]layer\'s turn it is', 'p']) // or this should be the default
    rows.push(['(Show commands can be combined)', ''])
    rows.push(['Send a message to your opponent', '<code>k(.*)</code>'])
    return rows
})()
const SHOW_COMMANDS_REGEX = /^(HELP|[HIJKLMOPSV]*)$/
//HIJLMOPSV
const JEWELS_ROW = ['[Q]uartz', '[W]olframite', '[E]merald', '[R]uby', '[T]urquoise', '[G]old' ]
const jewel_to_idx = (ch) => {
    if (ch === 'Q') { return 0 }
    if (ch === 'W') { return 1 }
    if (ch === 'E') { return 2 }
    if (ch === 'R') { return 3 }
    if (ch === 'T') { return 4 }
    if (ch === 'G') { return 5 }
    return null;
}

const to_html_table = (rows) => {
    return '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table>'
}

// TODO(bowei): permute the card list to be canonical. Currently the costs are in the order BWRGB and the resources by black blue green red white (that's what the card list pdf gives).
const card_list = JSON.parse('./card_table.json')

const all_game_states = {}

const main = (req, res) => {
    let game_id = req.params.game_id; // how we keep track of game state
    let body = '' // what to return
    console.log('user agent', req.get('User-Agent')) // used to detect curl
    console.log('remote ip', req.headers['x-forwarded-for'] || req.connection.remoteAddress) // not sure why we would need this
    //console.log('cookies', req.cookies)
    let user_id
    if (req.cookies[COOKIE_NAME]) {
        user_id = req.cookies[COOKIE_NAME]
    } else {
        // generate a unique identifier for this user
        user_id = uuid.v4()
        res.cookie(COOKIE_NAME, user_id, { httpOnly: true })
    }
    console.log({user_id})

    let command = (req.body && req.body.command) || ''
    if (!command || !all_game_states[game_id]) {
        // TODO(bowei): decide if game is in progress or we are just starting a new game
        if (!all_game_states[game_id]) {
            // TODO(bowei): allow to specify through game_id some options of the game.
            // e.g. begins with "r" -> you start off as player 2, "p031" -> play until 31 VP, etc.
            body += 'New game started! You are player 1. <br>'
            // INITIALIZE game state
            all_game_states[game_id] = { 
                players: { 'p1': user_id }, 
                whose_turn: 'p1',
                points: { p1: 0, p2: 0 },
                inventory: { p1: [0, 0, 0, 0, 0, 0], p2: [0, 0, 0, 0, 0, 0] },
                stocks: [ 4, 4, 4, 4, 4, 5 ]
                decks: JSON.parse(JSON.stringify(card_list)) // a : stuff, b: stuff, c : stuff, where stuff looks like [qwert, provides, points]
                market: {}
            }
            // initlai
        } else {
            // TODO(bowei): allow specifying username through /:game_id/:name endpoint!
            body += 'Game in progress. '
            let players = all_game_states[game_id].players
            if (players.p1 === user_id) {
                body += 'You are player 1.'
            } else {
                if (!players.p2) {
                    // insert player
                    players.p2 = user_id
                    body += 'Joined! '
                }
                if (players.p2 === user_id) {
                    body += 'You are player 2. '
                } else {
                    body += 'You are spectating. '
                }
            }
            body += ' <br><br>'
            command = 'H'
        }
    }
    // game state and players are guaranteed to have been created at this point
    const game_state = all_game_states[game_id]
    const [current_player, other_player] = ((players) => {
        if (players.p1 === user_id) { return ['p1', 'p2'] }
        else if (players.p2 === user_id) { return ['p2', 'p1'] }
        else { return ['sp', 'sp'] }
    })(game_state.players)

    command = command.toUpperCase();
    if (command === 'HELP') { command = 'H' }

    if (SHOW_COMMANDS_REGEX.test(command)) {
        // Build up the information messages slowly
        for (let i = 0; i < command.length; i++) {
            let chr = command[i];
            let rows = [];

            if (chr === 'H') {
                body += 'Commands: <br>'
                body += to_html_table(HELP_TABLE)
                body += 'Recommended to use shift-tab + enter to easily enter input.'
            } else if (chr === 'I') {
                body += 'Inventory: <br>'
                rows.push((['You']).concat(JEWELS_ROW))
                rows.push(['Inventory'].concat(game_state.inventory[current_player]))
                rows.push(['Buildings',    0, 2, 0, 2, 0, ''])
                rows.push(['Buying power', 1, 3, 1, 3, 1, 1])
                body += to_html_table(rows)
            } else if (chr === 'J') {
                body += 'Sorting market by jewels: <br>'
                body += 'Not yet supported.'
            } else if (chr === 'K') {
                body += 'Chat: <br>'
                body += 'Not yet supported.'
            } else if (chr === 'L') {
                body += 'Sorting market by price: <br>'
                body += 'Not yet supported.'
            } else if (chr === 'M') {
                body += 'Cards available on the market: <br>'
                rows.push((['Card ID']).concat(JEWELS_ROW.slice(0,5)).concat(['Provides'], ['VP']))
                rows.push(['X1', 1, 1, 0, 1, 2, 'Q', 0])
                rows.push(['A1', 1, 1, 0, 1, 2, 'R', 0])
                rows.push(['A2', 1, 1, 0, 1, 2, 'T', 0])
                rows.push(['B1', 0, 0, 0, 0, 6, 'E', 3])
                rows.push(['O1', 1, 1, 0, 1, 5, 'W', 1])
                body += to_html_table(rows)
                body += ' <br>X1 - X3 are your reserves, O1 - O3 are your opponent\'s.'
            } else if (chr === 'O') {
                body += 'Opponent\'s inventory: <br>'
                rows.push((['Opponent']).concat(JEWELS_ROW))
                rows.push(['Inventory'].concat(game_state.inventory[other_player]))
                rows.push(['Buildings',    0, 0, 0, 0, 0, ''])
                rows.push(['Buying power', 0, 0, 0, 0, 0, 0])
                body += to_html_table(rows)
//HIJKLMOPSV
            } else if (chr === 'P') {
                body += 'Players: <br>'
                if (!game_state.players.p2) {
                    body += 'Waiting for a second player... <br>'
                } else {
                    body += `You have ${game_state.points[current_player]} points, your opponent has ${game_state.points[other_player]}. <br>`
                    if (game_state.whose_turn === current_player) {
                        body += 'It is currently your turn. '
                    } else {
                        body += 'It is not your turn. '
                    }
                    body += `You are player ${current_player === 'p1' ? '1' : '2'}.`
                }
            } else if (chr === 'S') {
                body += 'Stocks: <br>'
                rows.push((['']).concat(JEWELS_ROW))
                rows.push(['Stocks'].concat(game_state.stocks))
                body += to_html_table(rows)
            } else if (chr === 'V') {
                body += 'Available and acquired victory points: <br>'
                rows.push((['']).concat(JEWELS_ROW.slice(0,5)).concat(['Owned by', 'VP']))
                //rows.push(['', '[Q]uartz', '[W]olframite', '[E]merald', '[R]uby', '[T]urquoise', 'Acquired by', 'VP' ])
                rows.push(['Noble 1', 3, 3, 0, 0, 3, 'No one', 3])
                rows.push(['Noble 2', 4, 0, 0, 4, 0, 'You', 3])
                rows.push(['Noble 3', 4, 0, 0, 0, 4, 'Opponent', 3])
                body += to_html_table(rows)
            }
            body += ' <br><br>'
        }
    } else if (command === '!!!X') {
        command = 'H'
        body += 'GOD MODE:  my turn again <br>'
        game_state.whose_turn = current_player
    } else if (command === 'U') {
        // special case for undo which is tricky
        body += 'Undo command not yet supported.'
    // action commands, tricky stuff
    } else if (/^([QWERT-]{2,3}|([A-C][1-4]|X[1-3])|G[A-C][0-4])$/.test(command)) {
        let did_succeed_turn = true;
        // DONT't swap turns when we fail a command
        if (game_state.whose_turn !== current_player) {
            body += 'It\'s not your turn!'
        } else if (!game_state.players.p2) {
            body += 'Needs at least 2 players!'
        } else {
            if (/^[QWERT-]{2,3}$/.test(command)) {
                if (command.length === 2 && command[0] == command[1]) {
                    let total = 0
                    for (let i = 0; i < 6; i++) { total += game_state.inventory[current_player][i] }
                    if (command.replace('-','').length + total > 10) {
                        body += "Can't take that many jewels, inventory too full."
                        did_succeed_turn = false;
                    } else {
                        if (command[0] !== '-' && game_state.stocks[jewel_to_idx(command[0])] === 4) {
                            body += `Acquired ${command}.`
                            game_state.inventory[current_player][jewel_to_idx(command[0])] += 2;
                            game_state.stocks[jewel_to_idx(command[0])] -= 2;
                        } else {
                            body += 'Cant do that, needs to have at least 4 jewels in that stock.'
                            did_succeed_turn = false;
                        }
                    }
                } else if (command.length === 3 && !/([^-])\1/.test(command) && !/([^-]).\1/.test(command)) {
                    let total = 0
                    for (let i = 0; i < 6; i++) { total += game_state.inventory[current_player][i] }
                    if (command.replace('-','').length + total > 10) {
                        body += "Can't take that many jewels, inventory too full."
                        did_succeed_turn = false;
                    } else {
                        if (command[0] !== '-' && game_state.stocks[jewel_to_idx(command[0])] === 0 ||
                            command[1] !== '-' && game_state.stocks[jewel_to_idx(command[1])] === 0 ||
                            command[2] !== '-' && game_state.stocks[jewel_to_idx(command[2])] === 0) {
                            body += 'Cant do that, insufficient stocks.'
                            did_succeed_turn = false;
                        } else {
                            body += `Acquired ${command}.`
                            // ignore '-', the array will store some undefined but we dont care
                            game_state.inventory[current_player][jewel_to_idx(command[0])] += 1;
                            game_state.stocks[jewel_to_idx(command[0])] -= 1;
                            game_state.inventory[current_player][jewel_to_idx(command[1])] += 1;
                            game_state.stocks[jewel_to_idx(command[1])] -= 1;
                            game_state.inventory[current_player][jewel_to_idx(command[2])] += 1;
                            game_state.stocks[jewel_to_idx(command[2])] -= 1;
                        }
                    }
                } else {
                    body += `Unable to parse ${command}. You must take at most 2 gems of the same color, or at most 3 gems of distinct colors. Use '-' to explicitly take fewer gems.`
                    did_succeed_turn = false;
                }
            } else if (/^([A-C][1-4]|X[1-3])$/.test(command)) {
                if (command[0] === 'X') {
                    // TODO(bowei): see if the reserve card exists!
                    // TODO(bowei): test if you have enough purchasing power
                    body += `Purchased card ${command} from own reserve.`
                } else {
                    // TODO(bowei): test if you have enough purchasing power
                    body += `Purchased card ${command}.`
                }
        
                // TODO(bowei): draw a new card
                // TODO(bowei): acquire nobles?
                // TODO(bowei): is the game over?
            } else if (/^G[A-C][0-4]$/.test(command)) {
                let card = command.slice(1);
                // TODO(bowei): test if your inventory is too full
                // TODO(bowei): test if your reserve slots are full
                body += `Reserved card ${command} to slot X1.`
                // TODO(bowei): draw a new card
            }
            // TODO(bowei): swap the turns
            if (did_succeed_turn) {
                game_state.whose_turn = other_player
            }
        }
    } else {
        body += 'Invalid command. Try [h]elp.'
        command = 'H'
    }

    let to_ret = INDEX_STRING
    to_ret = to_ret.replace('__GAME_ID__', game_id)
    to_ret = to_ret.replace('__BODY__', body)
    to_ret = to_ret.replace('__COMMAND__', command)
    return res.send(to_ret)
}

app.post('/:game_id', main)
app.post('/:game_id/:name', main)
app.get('/:game_id', main)
/*
app.get('/api/poll/:game_id', (req, res) => {
    // polls for when it's your turn
    res.send({'got': 'here'});
}) */

app.listen(port, () => console.log(`Splendor app listening on port ${port}!`))

