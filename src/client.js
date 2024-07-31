let clientId;
let gameId;
let isTurn = false;
let yourSymbol;
let socket;
let board;
let game;

const connectBtn = document.getElementById('connectBtn');
const newGameBtn = document.getElementById('newGame');
const currGames = document.getElementById('currGames');
const joinGame = document.getElementById('joinGame');
const cells = document.querySelectorAll('.cell');
const gameBoard = document.getElementById('board');
const userCol = document.querySelector('.flex-col1');
const gameStatus = document.getElementById('gameStatus');

connectBtn.addEventListener('click', () => {
    socket = new WebSocket('ws://tic-tac-toe-qrbc.vercel.app');
    socket.onopen = function(event) {
        gameStatus.textContent = "Connected to WebSocket server.";
    };

    newGameBtn.addEventListener('click', () => {
        const payLoad = {
            'method': 'create',
            'clientId': clientId
        };
        socket.send(JSON.stringify(payLoad));
    });

    socket.onmessage = function(msg) {
        const data = JSON.parse(msg.data);
        switch (data.method) {
            case 'connect':
                clientId = data.clientId;
                userCol.innerHTML = `UserId: ${clientId}`;
                userCol.classList.add('joinLabel');
                break;

            case 'create':
                gameId = data.game.gameId;
                yourSymbol = data.game.players[0].symbol;
                gameStatus.textContent = `Game created. Your symbol is ${yourSymbol}`;
                cells.forEach(cell => {
                    cell.classList.remove('x', 'circle');
                });
                break;

            case 'gamesAvail':
                while (currGames.firstChild) {
                    currGames.removeChild(currGames.lastChild);
                }
                const games = data.games;
                games.forEach((game) => {
                    const li = document.createElement('li');
                    li.addEventListener('click', selectGame);
                    li.innerText = game;
                    currGames.appendChild(li);
                });
                break;

            case 'join':
                gameId = data.game.gameId;
                yourSymbol = data.game.players[1].symbol;
                gameStatus.textContent = `Joined game. Your symbol is ${yourSymbol}`;
                cells.forEach(cell => {
                    cell.classList.remove('x', 'circle');
                });
                break;

            case 'updateBoard':
                gameBoard.style.display = "grid";
                game = data.game;
                board = game.board;
                const symbolClass = yourSymbol === 'x' ? 'x' : 'circle';
                gameBoard.classList.add(symbolClass);
                let index = 0;
                cells.forEach(cell => {
                    cell.classList.remove('x', 'circle');
                    if (board[index] === 'x') {
                        cell.classList.add('x');
                    } else if (board[index] === 'o') {
                        cell.classList.add('circle');
                    } else {
                        cell.addEventListener('click', clickCell);
                    }
                    index++;
                });

                game.players.forEach((player) => {
                    if (player.clientId === clientId && player.isTurn) {
                        isTurn = true;
                        gameStatus.textContent = `Your turn (${yourSymbol})`;
                    } else if (player.clientId === clientId) {
                        gameStatus.textContent = `Waiting for opponent's turn...`;
                    }
                });
                break;

            case 'gameEnds':
                gameStatus.textContent = `Winner is ${data.winner}`;
                // window.alert(`Winner is ${data.winner}`);
                break;

            case 'draw':
                gameStatus.textContent = 'It\'s a draw';
                // alert('It\'s a draw');
                break;
        }
    };

    socket.onclose = function(event) {
        gameStatus.textContent = "Disconnected from WebSocket server.";
    };

    socket.onerror = function(err) {
        console.error("WebSocket error:", err);
        gameStatus.textContent = "WebSocket error.";
    };
});

function selectGame(event) {
    gameId = +event.target.innerText;
    joinGame.removeEventListener('click', joingm);
    joinGame.addEventListener('click', joingm, { once: true });
}

function joingm() {
    const payLoad = {
        'method': 'join',
        'clientId': clientId,
        'gameId': gameId
    };
    socket.send(JSON.stringify(payLoad));
}

function clickCell(event) {
    if (!isTurn || event.target.classList.contains('x') || event.target.classList.contains('circle')) {
        return;
    }

    const cellclass = yourSymbol === 'x' ? 'x' : 'circle';
    event.target.classList.add(cellclass);

    let index = 0;
    cells.forEach(cell => {
        if (cell.classList.contains('x')) {
            board[index] = 'x';
        }
        if (cell.classList.contains('circle')) {
            board[index] = 'o';
        }
        index++;
    });
    isTurn = false;
    gameStatus.textContent = "Waiting for opponent's turn...";
    makeMove();
}

function makeMove() {
    let index = 0;
    cells.forEach((cell) => {
        if (cell.classList.contains('x')) {
            game.board[index] = 'x';
        }
        if (cell.classList.contains('circle')) {
            game.board[index] = 'o';
        }
        index++;
    });
    cells.forEach(cell => cell.removeEventListener('click', clickCell));
    const payLoad = {
        'method': 'makeMove',
        'game': game
    };
    socket.send(JSON.stringify(payLoad));
}
