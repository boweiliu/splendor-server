'use strict'
const express = require('express');
const argv = require('minimist')(process.argv);

const port = argv.port || 3000;


const app = express()
app.use(express.json())
app.use(express.urlencoded())

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
  <input type="text" name="command" value="h"><br>
</form> 

__BODY__
`

const main = (req, res) => {
    let game_id = req.params.game_id; // how we keep track of game state
    let body = '' // what to return
    //console.log('user agent', req.get('User-Agent')) // used to detect curl
    let command = (req.body && req.body.command) || ''
    if (!command) {
        // decide if game is in progress or we are just starting a new game
        body += 'Game in progress. <br><br>'
        command = 'H'
    }
    command = command.toUpperCase();

    // Quartz, Wolfram, Emerald, Ruby, Turquoise, Gold
    if (!command || command === 'HELP' || command === 'H') {
        body += 'Commands: <br>'
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
        body += '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table><br>'

        //body += '<code> [QqWwEeRrTt-]{2,3
        //body += 'Use <code>[QqWwEeRrTt-]{2,3}</code> to take jewels, <code>[A-Ca-c][1-4]|[Xx][1-3]</code> to buy cards, and <code>[Gg][A-Ca-z][0-4]</code> to reserve. <br>'
        //body += 'Use <code>?</code> to query your status, <code>??</code> to query the market, and <code>???</code> to print full game status. <br>'
        //body += 'Use <code>i</code> to query your inventory, <code>c</code> to query the market, <code>n</code> to query nobles, <code>o</code> to query opponent inventory, <code>s</code> to query stocks, <code>z</code> to query whose turn, <code>u</code> to undo (only works if fast enough). Commands can be combined. <br>'
        body += 'Recommended to use shift-tab + enter to easily enter input. <br><br>'
    } else if (command === 'H') {
        body += 'History command not yet supported. <br><br>'
    } else if (command === 'S') {
        let rows = []
        rows.push(['', 'Quartz', 'Wolframite', 'Emerald', 'Ruby', 'Turquoise', 'Gold' ])
        rows.push(['Stocks',  8, 3, 2, 2, 0, 0])
        body += '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table><br>'
    } else if (command === 'I' || command === 'O') {
        let rows = []
        rows.push([(command === 'O' ? 'Opponent' : 'You'), 'Quartz', 'Wolframite', 'Emerald', 'Ruby', 'Turquoise', 'Gold' ])
        rows.push(['Inventory',    1, 1, 1, 1, 1, 1])
        rows.push(['Buildings',    0, 2, 0, 2, 0, ''])
        rows.push(['Buying power', 1, 3, 1, 3, 1, 1])
        body += '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table><br>'
        body += 'VP so far : 10 <br><br>'
    } else if (command === 'N') {
        let rows = []
        rows.push(['', 'Quartz', 'Wolframite', 'Emerald', 'Ruby', 'Turquoise', 'Available?', 'VP' ])
        rows.push(['Noble 1', 3, 3, 0, 0, 3, 'Yes', 3])
        rows.push(['Noble 2', 4, 0, 0, 4, 0, 'No, P1', 3])
        body += '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table> <br><br>'
    } else if (command === 'C') {
        let rows = []
        rows.push(['Card ID', 'Quartz', 'Wolframite', 'Emerald', 'Ruby', 'Turquoise', 'Provides', 'VP' ])
        rows.push(['X1', 1, 1, 0, 1, 2, 'Q', 0])
        rows.push(['A1', 1, 1, 0, 1, 2, 'R', 0])
        rows.push(['A2', 1, 1, 0, 1, 2, 'T', 0])
        rows.push(['B1', 0, 0, 0, 0, 6, 'E', 3])
        rows.push(['O1', 1, 1, 0, 1, 5, 'W', 1])
        body += '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table> <br><br>'
    // ? to briefly query. Returns your current bank and mines and if any stocks are depleted.
    // ?? to query stuff. Returns your current inventory and all cards, and number of tokens left of each color, and list of cards you can buy and at what price.
    // ??? to query full status. returns each players' current banks, their mines, their reserved cards, their points, as well as all the cards each player can buy, all the cards they can't and what they would need, and all the current nobles. Also turn count and number of points needed to win.
    } else {
        // TODO(bowei): check if it's our turn!
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
            command = command.toUpperCase();
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
            command = command.toUpperCase().slice(1);
            // TODO(bowei): test if your inventory is too full
            // TODO(bowei): test if your reserve slots are full
            body += `Reserved card ${command} to slot X1.`
            // TODO(bowei): draw a new card
        } else {
            body += 'Invalid command. Try [h]elp.'
        }
    }

    let to_ret = INDEX_STRING
    to_ret = to_ret.replace('__GAME_ID__', req.params.game_id)
    to_ret = to_ret.replace('__BODY__', body)
	return res.send(to_ret)
}

app.post('/:game_id', main)
app.get('/:game_id', main)
/*
app.get('/api/poll/:game_id', (req, res) => {
    // polls for when it's your turn
    res.send({'got': 'here'});
}) */

app.listen(port, () => console.log(`Splendor app listening on port ${port}!`))

