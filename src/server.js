const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('websocket').server;

const games = {};
const clients = {};
const CROSS_SYMBOL = 'x';
const CIRCLE_SYMBOL = 'o';
const WIN_STATES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6]
];

const httpServer = http.createServer((request, response) => {
    console.log(`Requested URL: ${request.url}`);
    let filePath = path.join(__dirname, request.url === '/' ? 'index.html' : request.url);
    const extname = path.extname(filePath);

    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
        case '.wav':
            contentType = 'audio/wav';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code === 'ENOENT') {
                fs.readFile(path.join(__dirname, '404.html'), (error, content) => {
                    response.writeHead(404, { 'Content-Type': 'text/html' });
                    response.end(content, 'utf8');
                });
            } else {
                response.writeHead(500);
                response.end('Server Error: ' + error.code);
            }
        } else {
            response.writeHead(200, { 'Content-Type': contentType });
            response.end(content, 'utf8');
        }
    });
});

const socketServer = new WebSocket({
    httpServer: httpServer
});

socketServer.on('request', request => {
    const connection = request.accept(null, request.origin);

    const clientId = Math.round(Math.random() * 1000); // Better random ID generation
    clients[clientId] = { clientId: clientId, connection: connection };
    connection.send(JSON.stringify({ method: 'connect', clientId: clientId }));

    sendAvailableGames();

    connection.on('message', message => {
        const msg = JSON.parse(message.utf8Data);
        handleClientMessage(msg, connection);
    });

    connection.on('close', () => {
        // Handle client disconnection if needed
        delete clients[clientId];
        sendAvailableGames();
    });
});

httpServer.listen(8080, () => {
    console.log('Server listening on port 8080');
});

function handleClientMessage(msg, connection) {
    switch (msg.method) {
        case 'create':
            handleCreateGame(msg);
            break;
        case 'join':
            handleJoinGame(msg);
            break;
        case 'makeMove':
            handleMakeMove(msg);
            break;
        default:
            console.log('Unknown method:', msg.method);
            break;
    }
}

function handleCreateGame(msg) {
    const player = {
        clientId: msg.clientId,
        symbol: CROSS_SYMBOL,
        isTurn: true,
        wins: 0,
        lost: 0
    };

    const gameId = Math.round(Math.random() * 1000); // Better random ID generation
    const board = Array(9).fill('');

    games[gameId] = {
        gameId: gameId,
        players: [player],
        board: board
    };

    const payLoad = {
        method: 'create',
        game: games[gameId]
    };

    clients[msg.clientId].connection.send(JSON.stringify(payLoad));
    sendAvailableGames();
}

function handleJoinGame(msg) {
    const player = {
        clientId: msg.clientId,
        symbol: CIRCLE_SYMBOL,
        isTurn: false,
        wins: 0,
        lost: 0
    };

    games[msg.gameId].players.push(player);

    const payLoad = {
        method: 'join',
        game: games[msg.gameId]
    };

    clients[msg.clientId].connection.send(JSON.stringify(payLoad));

    makeMove(games[msg.gameId]);
}

function handleMakeMove(msg) {
    const game = games[msg.game.gameId];
    game.board = msg.game.board;

    const currPlayer = game.players.find(player => player.isTurn);
    const playerSymbol = currPlayer.symbol;

    const isWinner = WIN_STATES.some(row => {
        return row.every(cell => game.board[cell] === playerSymbol);
    });

    if (isWinner) {
        const payLoad = {
            method: 'gameEnds',
            winner: playerSymbol
        };
        game.players.forEach(player => {
            clients[player.clientId].connection.send(JSON.stringify(payLoad));
        });
        return;
    }

    const isDraw = WIN_STATES.every(state => {
        return state.some(index => game.board[index] === 'x') &&
               state.some(index => game.board[index] === 'o');
    });

    if (isDraw) {
        const payLoad = {
            method: 'draw'
        };
        game.players.forEach(player => {
            clients[player.clientId].connection.send(JSON.stringify(payLoad));
        });
        return;
    }

    game.players.forEach(player => {
        player.isTurn = !player.isTurn;
    });

    makeMove(game);
}

function makeMove(game) {
    const payLoad = {
        method: 'updateBoard',
        game: game
    };

    game.players.forEach(player => {
        clients[player.clientId].connection.send(JSON.stringify(payLoad));
    });
}

function sendAvailableGames() {
    const allGames = Object.values(games)
        .filter(game => game.players.length < 2)
        .map(game => game.gameId);

    const payLoad = {
        method: 'gamesAvail',
        games: allGames
    };

    Object.values(clients).forEach(client => {
        client.connection.send(JSON.stringify(payLoad));
    });
}
