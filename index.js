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

const to_html_table = (rows) => {
    return '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table>'
}

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
    if (!command) {
        // TODO(bowei): decide if game is in progress or we are just starting a new game
        if (!all_game_states[game_id]) {
            // TODO(bowei): allow to specify through game_id some options of the game.
            // e.g. begins with "r" -> you start off as player 2, "p031" -> play until 31 VP, etc.
            body += 'New game started! You are player 1.'
            all_game_states[game_id] = { players: { 'p1': user_id }, whose_turn: 'p1' }
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
    const current_player = ((players) => {
        if (players.p1 === user_id) { return 'p1' }
        else if (players.p2 === user_id) { return 'p2' }
        else { return 'sp' }
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
                rows.push(['Inventory',    1, 1, 1, 1, 1, 1])
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
            } else if (chr === 'O') {
                body += 'Opponent\'s inventory: <br>'
                rows.push((['Opponent']).concat(JEWELS_ROW))
                rows.push(['Inventory',    0, 0, 0, 0, 0, 0])
                rows.push(['Buildings',    0, 0, 0, 0, 0, ''])
                rows.push(['Buying power', 0, 0, 0, 0, 0, 0])
                body += to_html_table(rows)
//HIJKLMOPSV
            } else if (chr === 'P') {
                body += 'Players: <br>'
                body += 'It is currently your turn.'
            } else if (chr === 'S') {
                body += 'Stocks: <br>'
                rows.push((['']).concat(JEWELS_ROW))
                rows.push(['Stocks',  8, 3, 2, 2, 0, 0])
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
    } else if (command === 'U') {
        // special case for undo which is tricky
        body += 'Undo command not yet supported.'
    // action commands, tricky stuff
    } else if (/^([QWERT-]{2,3}|([A-C][1-4]|X[1-3])|G[A-C][0-4])$/.test(command)) {
        // TODO(bowei): check if it's our turn!
        if (game_state.whose_turn !== current_player) {
            body += 'It\'s not your turn!'
            // DONT't swap turns
        } else {
            if (/^[QWERT-]{2,3}$/.test(command)) {
                if (command.length === 2 && command[0] == command[1]) {
                    // TODO(bowei): test if the pile is full!
                    // TODO(bowei): test if your inventory is too full
                    body += `Acquired ${command}.`
                } else if (command.length === 3 && !/([^-])\1/.test(command) && !/([^-]).\1/.test(command)) {
                    // TODO(bowei): test if the piles are empty!
                    // TODO(bowei): test if your inventory is too full
                    body += `Acquired ${command}.`
                } else {
                    body += `Unable to parse ${command}. You must take at most 2 gems of the same color, or at most 3 gems of distinct colors. Use '-' to explicitly take fewer gems.`
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

