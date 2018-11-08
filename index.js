'use strict'
const express = require('express');
const argv = require('minimist')(process.argv);
const cookieParser = require('cookie-parser')
const uuid = require('uuid')
const _ = require('lodash')

const port = argv.port || 3000;
const COOKIE_NAME = 'splendor-server'

const app = express()
app.use(express.json())
app.use(express.urlencoded())
app.use(cookieParser())

const INDEX_STRING = 
`
<style>
__MOBILE__:.navbar {
__MOBILE__:  position: fixed;
__MOBILE__:  background-color: #FFFFFF;
__MOBILE__:  top: 0;
__MOBILE__:  width: 100%;
__MOBILE__:}
__MOBILE__:.main {
__MOBILE__:  margin-top: 160px;
__MOBILE__:}
th, td {
    border: 1px solid black;
    border-collapse: collapse;
__MOBILE__:    font-size: 24px;
}
table {
__MOBILE__:    table-layout: fixed;
__MOBILE__:    width: 100%;
    border: 1px solid black;
    border-collapse: collapse;
__MOBILE__:    font-size: 24px;
}
th, td {
    padding: 5px;
}
</style>

<div class="navbar">
__MOBILE__: Enter command below: <br>
__MOBILE__:<textarea rows="5" cols="30" name="command" form="myform" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false">
__MOBILE__:</textarea> <br>
<form action="/__GAME_ID__" method="post" id="myform">
  <input type="submit" value="Play">
__DESKTOP__:<input type="text" name="command" value="__COMMAND__"><br>
</form>
</div>

__MOBILE__:<body style="font-size:16px">
__DESKTOP__:<body>
<div class="main">
__BODY__
</div>
</body>
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
    rows.push(['(Actions can also be followed by a semicolon and any number of show commands)', ''])
    rows.push(['Send a message to your opponent', '<code>k(.*)</code>'])
    return rows
})()
const SHOW_COMMANDS_REGEX = /^(HELP|[HIJKLMOPSV]*)$/
//HIJLMOPSV
const JEWELS_ROW_FULL = ['[Q]uartz', '[W]olframite', '[E]merald', '[R]uby', '[T]urquoise', '[G]old' ]
const JEWELS_ROW_ABBR = ['Q', 'W', 'E', 'R', 'T', 'G'].map(c => '   ' + c + '   ')
const jewel_to_idx = (ch) => {
    if (ch === 'Q') { return 0 }
    if (ch === 'W') { return 1 }
    if (ch === 'E') { return 2 }
    if (ch === 'R') { return 3 }
    if (ch === 'T') { return 4 }
    if (ch === 'G') { return 5 }
    return null;
}
const CARD_KEYS = ['A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4']
const MAX_VICTORY_POINTS = 15;

const to_html_table = (rows) => {
    return '<table> ' + rows.map(row => '<tr> ' + row.map(x => `<th> ${x} </th>`).join(' ') + ' </tr> ').join(' ') + ' </table>'
}

// TODO(bowei): permute the card list to be canonical. Currently the costs are in the order 01234-BWRGB and the resources by QWERT=black blue green red white (that's what the card list pdf gives).
let CARD_LIST = require('./card_table.json')
// TODO(bowei): permute the nobles to be canonical. Again costs are given in the order 01234-BWRGB
const NOBLE_LIST = require('./nobles.json')

const all_game_states = {}

const main = (req, res) => {
    let game_id = req.params.game_id; // how we keep track of game state
    let game_settings = game_id[0] === ':' ? _(game_id.slice(1).split(':')).dropRight(1).keyBy(r => r.split('=')[0]).mapValues(r => r.split('=')[1]).value() : {}
    
    let body = '' // what to return
    let user_agent = req.get('User-Agent')
    const is_mobile = (function(a){ return /(android|bb\d+|meego).+mobile|avantgo|bada\/|blackberry|blazer|compal|elaine|fennec|hiptop|iemobile|ip(hone|od)|iris|kindle|lge |maemo|midp|mmp|mobile.+firefox|netfront|opera m(ob|in)i|palm( os)?|phone|p(ixi|re)\/|plucker|pocket|psp|series(4|6)0|symbian|treo|up\.(browser|link)|vodafone|wap|windows ce|xda|xiino/i.test(a)||/1207|6310|6590|3gso|4thp|50[1-6]i|770s|802s|a wa|abac|ac(er|oo|s\-)|ai(ko|rn)|al(av|ca|co)|amoi|an(ex|ny|yw)|aptu|ar(ch|go)|as(te|us)|attw|au(di|\-m|r |s )|avan|be(ck|ll|nq)|bi(lb|rd)|bl(ac|az)|br(e|v)w|bumb|bw\-(n|u)|c55\/|capi|ccwa|cdm\-|cell|chtm|cldc|cmd\-|co(mp|nd)|craw|da(it|ll|ng)|dbte|dc\-s|devi|dica|dmob|do(c|p)o|ds(12|\-d)|el(49|ai)|em(l2|ul)|er(ic|k0)|esl8|ez([4-7]0|os|wa|ze)|fetc|fly(\-|_)|g1 u|g560|gene|gf\-5|g\-mo|go(\.w|od)|gr(ad|un)|haie|hcit|hd\-(m|p|t)|hei\-|hi(pt|ta)|hp( i|ip)|hs\-c|ht(c(\-| |_|a|g|p|s|t)|tp)|hu(aw|tc)|i\-(20|go|ma)|i230|iac( |\-|\/)|ibro|idea|ig01|ikom|im1k|inno|ipaq|iris|ja(t|v)a|jbro|jemu|jigs|kddi|keji|kgt( |\/)|klon|kpt |kwc\-|kyo(c|k)|le(no|xi)|lg( g|\/(k|l|u)|50|54|\-[a-w])|libw|lynx|m1\-w|m3ga|m50\/|ma(te|ui|xo)|mc(01|21|ca)|m\-cr|me(rc|ri)|mi(o8|oa|ts)|mmef|mo(01|02|bi|de|do|t(\-| |o|v)|zz)|mt(50|p1|v )|mwbp|mywa|n10[0-2]|n20[2-3]|n30(0|2)|n50(0|2|5)|n7(0(0|1)|10)|ne((c|m)\-|on|tf|wf|wg|wt)|nok(6|i)|nzph|o2im|op(ti|wv)|oran|owg1|p800|pan(a|d|t)|pdxg|pg(13|\-([1-8]|c))|phil|pire|pl(ay|uc)|pn\-2|po(ck|rt|se)|prox|psio|pt\-g|qa\-a|qc(07|12|21|32|60|\-[2-7]|i\-)|qtek|r380|r600|raks|rim9|ro(ve|zo)|s55\/|sa(ge|ma|mm|ms|ny|va)|sc(01|h\-|oo|p\-)|sdk\/|se(c(\-|0|1)|47|mc|nd|ri)|sgh\-|shar|sie(\-|m)|sk\-0|sl(45|id)|sm(al|ar|b3|it|t5)|so(ft|ny)|sp(01|h\-|v\-|v )|sy(01|mb)|t2(18|50)|t6(00|10|18)|ta(gt|lk)|tcl\-|tdg\-|tel(i|m)|tim\-|t\-mo|to(pl|sh)|ts(70|m\-|m3|m5)|tx\-9|up(\.b|g1|si)|utst|v400|v750|veri|vi(rg|te)|vk(40|5[0-3]|\-v)|vm40|voda|vulc|vx(52|53|60|61|70|80|81|83|85|98)|w3c(\-| )|webc|whit|wi(g |nc|nw)|wmlb|wonu|x700|yas\-|your|zeto|zte\-/i.test(a.substr(0,4)) })(user_agent)
    console.log('\nuser agent', user_agent, {is_mobile} ) // can also be used to detect curl
    const JEWELS_ROW = is_mobile ? JEWELS_ROW_ABBR : JEWELS_ROW_FULL
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
    console.log({ game_id, command, game_settings })
    command = command.trim().replace(/\r/g,'').replace(/\n/g,'').replace(/;{2,}/g,';')
    // Default entry screen, if no command was given or if game is not started yet
    if (!command || !all_game_states[game_id]) {
        if (!all_game_states[game_id]) {
            // TODO(bowei): allow to specify through game_id some options of the game.
            // e.g. begins with "r" -> you start off as player 2, "p031" -> play until 31 VP, etc.
            body += 'New game started! You are player 1. <br>'
            // INITIALIZE game state
            all_game_states[game_id] = { 
                players: { p1: user_id }, 
                whose_turn: 'p1',
                points: { p1: 0, p2: 0 },
                inventory: { p1: [0, 0, 0, 0, 0, 0], p2: [0, 0, 0, 0, 0, 0] },
                stocks: [ 4, 4, 4, 4, 4, 5 ],
                decks: JSON.parse(JSON.stringify(CARD_LIST)), // a : stuff, b: stuff, c : stuff, where stuff looks like [qwert, provides, points]
                market: {},
                nobles: _.map(_.sampleSize(NOBLE_LIST, 3), r => r.concat([''])), // only the available ones this game. 5th col is who it belongs to
                reserves: { p1: [], p2: [] },
                purchased: { p1: [], p2: [] },
                production: { p1: Array(5).fill(0), p2: Array(5).fill(0) }
            }
            // initlize market
            let decks = all_game_states[game_id].decks
            let market = all_game_states[game_id].market
            decks.A = _.shuffle(decks.A)
            decks.B = _.shuffle(decks.B)
            decks.C = _.shuffle(decks.C)
            for (let i = 1; i <= 4; i++) {
                market['A' + i.toString()] = decks.A.pop()
                market['B' + i.toString()] = decks.B.pop()
                market['C' + i.toString()] = decks.C.pop()
            }
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
    let original_command = command;

    if (/^([QWERT-]{2,3}|([A-C][1-4]|X[1-3])|G[A-C][0-4])(;(HELP|[HIJKLMOPSV]*))?$/.test(command)) {
        command = command.split(';')[0]
        let did_succeed_turn = true;
        // DONT't swap turns when we fail a command
        if (game_state.whose_turn !== current_player) {
            body += 'It\'s not your turn!'
        } else if (!game_state.players.p2 && ~~game_settings.n > 1) {
            body += 'Needs at least 2 players!'
        } else {
            if (/^[QWERT-]{2,3}(;|$)/.test(command)) {
                if (command.length === 2 && command[0] == command[1]) {
                    if (command.replace('-','').length + _.sum(game_state.inventory[current_player]) > 10) {
                        body += "Can't take that many jewels, inventory too full."
                        did_succeed_turn = false;
                    } else {
                        if (command[0] !== '-' && game_state.stocks[jewel_to_idx(command[0])] === 4) {
                            body += `Acquired ${command}.`
                            game_state.inventory[current_player][jewel_to_idx(command[0])] += 2;
                            game_state.stocks[jewel_to_idx(command[0])] -= 2;
                        } else {
                            body += 'Can\'t do that, needs to have at least 4 jewels in that stock.'
                            did_succeed_turn = false;
                        }
                    }
                } else if (command.length === 3 && !/([^-])\1/.test(command) && !/([^-]).\1/.test(command)) {
                    if (command.replace('-','').length + _.sum(game_state.inventory[current_player]) > 10) {
                        body += "Can't take that many jewels, inventory too full."
                        did_succeed_turn = false;
                    } else {
                        if (command[0] !== '-' && game_state.stocks[jewel_to_idx(command[0])] === 0 ||
                            command[1] !== '-' && game_state.stocks[jewel_to_idx(command[1])] === 0 ||
                            command[2] !== '-' && game_state.stocks[jewel_to_idx(command[2])] === 0) {
                            body += 'Can\'t do that, insufficient stocks.'
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
            } else if (/^([A-C][1-4]|X[1-3])(;|$)/.test(command)) {
                if (command[0] === 'X') {
                    if (game_state.reserves[current_player].length < command[1]) {
                        body += 'That reserve card doesn\'t exist!'
                        did_succeed_turn = false;
                    }
                }
                let cost = (command[0] === 'X') ? game_state.reserves[current_player][~~command[1]-1] : game_state.market[command]
                let how_much_we_are_short = Array(5)
                for (let i = 0 ; i < 5; i++) {
                    let cost_counting_production = Math.max(0, cost[i] - game_state.production[current_player][i])
                    how_much_we_are_short[i] = Math.max(0, cost_counting_production - game_state.inventory[current_player][i])
                }
                if (_.sum(how_much_we_are_short) > game_state.inventory[current_player][5]) {
                    body += 'Can\'t buy, not enough to pay!'
                    did_succeed_turn = false;
                } else {
                    // purchase
                    body += `Purchased card ${command}.`
                    // put tokens back
                    game_state.purchased[current_player].push(cost)
                    for (let i = 0; i < 5; i++) {
                        let cost_counting_production = Math.max(0, cost[i] - game_state.production[current_player][i])
                        let new_inventory_value = Math.max(0, game_state.inventory[current_player][i] - cost_counting_production)
                        let actual_cost = game_state.inventory[current_player][i] - new_inventory_value
                        game_state.stocks[i] += actual_cost
                        game_state.inventory[current_player][i] -= actual_cost
                    }
                    game_state.inventory[current_player][5] -= _.sum(how_much_we_are_short)
                    game_state.stocks[5] += _.sum(how_much_we_are_short)
                    // draw a new card only if was from market
                    if (command[0] !== 'X') {
                        game_state.market[command] = game_state.decks[command[0]].pop()
                    } else { // otherwise remove it from reserves
                        game_state.reserves[current_player].splice(command[1]-1,1)
                    }
                    // increase our production
                    game_state.production[current_player][jewel_to_idx(cost[5])] += 1
                    // add points
                    game_state.points[current_player] += cost[6]
                    // acquire nobles
                    game_state.nobles.filter(n => n[5] === '').forEach(n => {
                        if (_.sum(n.map((required, i) => game_state.production[current_player][i] >= required)) === 5) {
                            n[5] = current_player
                            game_state.points[current_player] += 3
                        }
                    })
                    if (game_state.points[current_player] >= MAX_VICTORY_POINTS) {
                        body += `Player ${current_player[1]} wins!`
                        game_state.whose_turn = 'gg'
                    }
                }
            } else if (/^G[A-C][0-4](;|$)/.test(command)) {
                let card = command.slice(1);
                if (_.sum(game_state.inventory[current_player]) >= 10) {
                    body += 'Can\'t reserve, inventory too full.'
                    did_succeed_turn = false
                } else if (game_state.reserves[current_player].length === 3) {
                    body += 'Can\'t reserve, already have 3 reserves.'
                    did_succeed_turn = false
                } else {
                    body += `Reserved card ${card} to slot X${game_state.reserves[current_player].length + 1}.`
                    if (card[0] === '0') {
                        game_state.reserves[current_player].push(game_state.decks[card[0]].pop())
                    } else {
                        game_state.reserves[current_player].push(game_state.market[card])
                        game_state.market[card] = game_state.decks[card[0]].pop()
                    }
                    game_state.inventory[current_player][5] += 1
                    game_state.stocks[5] -= 1
                }
            }
            if (did_succeed_turn && ~~game_settings.n > 1) {
                game_state.whose_turn = other_player
            }
        }
    } else if (!SHOW_COMMANDS_REGEX.test(command)) {
        body += 'Invalid command before the semicolon.'
    }

    command = original_command.split(';').pop()
    body += ' <br> '
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
                rows.push(['Building production'].concat(game_state.production[current_player]))
                rows.push(['Buying power'].concat(Array(6).fill(0).map((r, i) => game_state.inventory[current_player][i] + ~~game_state.production[current_player][i])))
                body += to_html_table(rows)
                body += `<br>You have a total of ${_.sum(game_state.inventory[current_player])} jewels, ${game_state.purchased[current_player].length} buildings, and ${game_state.reserves[current_player].length} reserved cards.`
            } else if (chr === 'J') {
                body += 'Sorting market by jewels: <br>'
                rows = rows.concat(CARD_KEYS.map(k => [k].concat(game_state.market[k])))
                rows = rows.concat(game_state.reserves[current_player].map((r, i) => ['X' + (i+1).toString()].concat(r)))
                rows = rows.concat(game_state.reserves[other_player].map((r, i) => ['O' + (i+1).toString()].concat(r)))
                rows = _.sortBy(rows, r => jewel_to_idx(r[6]) * 10 + r[0])
                rows.unshift((['Card ID']).concat(JEWELS_ROW.slice(0,5)).concat(['Gem'], ['VP']))
                body += to_html_table(rows)
            } else if (chr === 'K') {
                body += 'Chat: <br>'
                body += 'Not yet supported.'
            } else if (chr === 'L') {
                body += 'Sorting market by effective price: <br>'
                rows = rows.concat(CARD_KEYS.map(k => [k].concat(game_state.market[k])))
                rows = rows.concat(game_state.reserves[current_player].map((r, i) => ['X' + (i+1).toString()].concat(r)))
                rows = _.map(rows, r => {
                    let out_of_pocket_cost = Array(5).fill(0)
                    let how_many_gems_short = Array(5).fill(0)
                    for (let i = 0; i < 5; i++) {
                        out_of_pocket_cost[i] = Math.max(0, r[i+1] - game_state.production[current_player][i])
                        how_many_gems_short[i] = Math.max(0, out_of_pocket_cost[i] - game_state.inventory[current_player][i])
                    }
                    return r.concat([_.sum(out_of_pocket_cost), Math.max(0, _.sum(how_many_gems_short) - game_state.inventory[current_player][5] ) ])
                })
                rows = _.map(rows, r => {
                    let out_of_pocket_cost = Array(5).fill(0)
                    let how_many_gems_short = Array(5).fill(0)
                    for (let i = 0; i < 5; i++) {
                        out_of_pocket_cost[i] = Math.max(0, r[i+1] - game_state.production[other_player][i])
                        how_many_gems_short[i] = Math.max(0, out_of_pocket_cost[i] - game_state.inventory[other_player][i])
                    }
                    return r.concat([_.sum(out_of_pocket_cost), Math.max(0, _.sum(how_many_gems_short) - game_state.inventory[other_player][5] ) ])
                })
                rows = _.sortBy(rows, ['8', '9']) // oop cost, then current cost
                rows.unshift((['Card ID']).concat(JEWELS_ROW.slice(0,5)).concat(['Gem', 'VP', is_mobile ? 'Cost' : 'Out of pocket cost', is_mobile ? 'Short?' : 'How many gems short', is_mobile ? 'Opp. cost' : 'Enemy\'s OOPC', is_mobile ? 'Opp. short' : 'Enemy\'s HMGS']))
                body += to_html_table(rows)
            } else if (chr === 'M') {
                body += 'Cards available on the market: <br>'
                rows.push((['Card ID']).concat(JEWELS_ROW.slice(0,5)).concat(['Gem'], ['VP']))
                rows = rows.concat(CARD_KEYS.map(k => [k].concat(game_state.market[k])))
                rows = rows.concat(game_state.reserves[current_player].map((r, i) => ['X' + (i+1).toString()].concat(r)))
                rows = rows.concat(game_state.reserves[other_player].map((r, i) => ['O' + (i+1).toString()].concat(r)))
                body += to_html_table(rows)
                body += ' <br>X1 - X3 are your reserves, O1 - O3 are your opponent\'s.'
            } else if (chr === 'O') {
                body += 'Opponent\'s inventory: <br>'
                rows.push((['Opponent']).concat(JEWELS_ROW))
                rows.push(['Inventory'].concat(game_state.inventory[other_player]))
                rows.push(['Building production'].concat(game_state.production[other_player]))
                rows.push(['Buying power'].concat(Array(6).fill(0).map((r, i) => game_state.inventory[other_player][i] + ~~game_state.production[other_player][i])))
                body += to_html_table(rows)
                body += `<br>Opponent has a total of ${_.sum(game_state.inventory[other_player])} jewels, ${game_state.purchased[other_player].length} buildings, and ${game_state.reserves[other_player].length} reserved cards.`
            } else if (chr === 'P') {
                body += 'Players: <br>'
                if (!game_state.players.p2) {
                    body += 'Waiting for a second player...'
                } else {
                    body += `<br> You have ${game_state.points[current_player]} points, your opponent has ${game_state.points[other_player]}. <br>`
                    // TODO(bowei): make player 2 have an extra turn here if player 1 just "won"!
                    if (game_state.whose_turn === 'gg') {
                        body += 'The game is over!'
                    } else if (game_state.whose_turn === current_player) {
                        body += 'It is currently your turn. '
                    } else {
                        body += 'It is not your turn. '
                    }
                    body += `You are player ${current_player === 'p1' ? '1' : (current_player === 'p2' ? '2' : 'spectator')}.`
                }
            } else if (chr === 'S') {
                body += 'Stocks: <br>'
                rows.push((['']).concat(JEWELS_ROW))
                rows.push(['Stocks'].concat(game_state.stocks))
                body += to_html_table(rows)
            } else if (chr === 'V') {
                body += 'Available and acquired victory points: <br>'
                rows.push((['']).concat(JEWELS_ROW.slice(0,5)).concat(['Owned by', 'VP']))
                // TODO(bowei): filter owned nobles to the bottom
                rows = rows.concat(game_state.nobles.map((r,i) => [(is_mobile ? 'N' : 'Noble ') + (i+1).toString()].concat(r).concat([3])))
                let to_concat = CARD_KEYS.map(k => [k].concat(game_state.market[k]))
                to_concat = to_concat.concat(game_state.reserves[current_player].map((r, i) => ['X' + (i+1).toString()].concat(r)))
                to_concat = _(to_concat).filter(r => r[7] > 0).map(r => {
                    r[6] = ''
                    return r
                }).sortBy('7').reverse().value()
                //rows = rows.concat(to_concat) // TODO(bowei): reenable cards in "V" slot, otherwise only nobles show up
                // TODO(bowei): also add owned buildings with point values
                body += to_html_table(rows)
            }
            body += ' <br><br>'
        }
    } else if (command === 'U') {
        // special case for undo which is tricky
        body += 'Undo command not yet supported.'
    // action commands, tricky stuff
    } else if (original_command.indexOf(';') === -1) {
        // do nothing
    } else {
        body += 'Invalid command. Try [h]elp.'
        command = 'H'
    }

    let to_ret = INDEX_STRING
    to_ret = to_ret.replace('__GAME_ID__', game_id)
    to_ret = to_ret.replace('__BODY__', body)
    to_ret = to_ret.replace(/__COMMAND__/g, command)
    to_ret = to_ret.replace('__FONT_SIZE__', is_mobile ? 32 : 16 )
    if (is_mobile) {
        to_ret = to_ret.split('\n').filter(l => !/^__DESKTOP__:/.test(l)).map(l => l.replace('__MOBILE__:','')).join('\n')
    } else {
        to_ret = to_ret.split('\n').filter(l => !/^__MOBILE__:/.test(l)).map(l => l.replace('__DESKTOP__:','')).join('\n')
    }
    return res.send(to_ret)
}

app.get('/favicon.ico', (req, res) => res.sendStatus(404))
app.post('/:game_id', main)
app.post('/:game_id/:name', main)
app.get('/:game_id', main)
/*
app.get('/api/poll/:game_id', (req, res) => {
    // polls for when it's your turn
    res.send({'got': 'here'});
}) */

app.listen(port, () => console.log(`Splendor app listening on port ${port}!`))

