// 簡易麻雀ロジック（UIは最小限）
// - 牌種を作って4枚ずつ、合計136枚
// - シャッフルして配牌（南=あなたは14枚で開始）
// - ツモ・捨てを実装（他家は自動でツモして数を減らす簡易挙動）

// グローバル状態
const state = {
  wall: [],            // 残り山牌（配列の末尾から引く）
  discard: [],         // 捨て牌（配列）
  players: [[],[],[],[]], // 各プレイヤーの手牌（0:南=あなた, 1:西, 2:北, 3:東） 南はindex 0 として扱う
  currentPlayer: 0,    // 現在の手番（簡易：常に南→他家順）
};

// 牌の定義（34種類）
const tileTypes = (() => {
  const suits = ['m','p','s']; // 萬子, 筒子, 索子
  const types = [];
  for (const s of suits) {
    for (let r=1; r<=9; r++) {
      types.push({code: `${r}${s}`, name: `${r}${s}`});
    }
  }
  // 字牌
  const honors = [
    {code:'E', name:'東'},
    {code:'S', name:'南'},
    {code:'W', name:'西'},
    {code:'N', name:'北'},
    {code:'P', name:'白'},
    {code:'F', name:'發'},
    {code:'C', name:'中'},
  ];
  return types.concat(honors);
})();

// ユーティリティ: 山を作る（34種類x4枚）
function buildWall() {
  const wall = [];
  tileTypes.forEach((t, idx) => {
    for (let c=0;c<4;c++) {
      wall.push({
        id: `${t.code}-${c}-${Math.random().toString(36).slice(2,8)}`,
        code: t.code,
        name: t.name,
      });
    }
  });
  return wall;
}

// Fisher-Yates シャッフル
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// 配牌
function deal() {
  state.players = [[],[],[],[]];
  state.discard = [];
  state.wall = buildWall();
  shuffle(state.wall);

  // 各家に13枚ずつ、南（index 0）には14枚にして配る
  for (let round=0; round<13; round++) {
    for (let p=0; p<4; p++) {
      state.players[p].push(state.wall.pop());
    }
  }
  // 南は配牌時に+1枚（親扱いを簡易に）
  state.players[0].push(state.wall.pop());
  state.currentPlayer = 0; // 南からスタート
  renderAll();
}

// UI レンダリング
function renderAll() {
  // 山の数
  document.getElementById('wall-count').textContent = state.wall.length;

  // 他家の表示（枚数のみ）
  document.querySelector('#player-north .count').textContent = state.players[2].length;
  document.querySelector('#player-east .count').textContent = state.players[3].length;
  document.querySelector('#player-west .count').textContent = state.players[1].length;

  // 捨て牌表示
  const discardDiv = document.getElementById('discard-pile');
  discardDiv.innerHTML = '';
  state.discard.slice().reverse().forEach(t => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = t.name;
    discardDiv.appendChild(el);
  });

  // 自分の手牌表示（簡易：ソートせずそのまま。クリックで捨て）
  const myDiv = document.getElementById('player-south');
  myDiv.innerHTML = '';
  state.players[0].forEach((t, idx) => {
    const el = document.createElement('div');
    el.className = 'tile';
    el.textContent = t.name;
    el.title = `index:${idx}`;
    el.addEventListener('click', () => {
      // クリックで捨て
      discardTile(0, idx);
    });
    myDiv.appendChild(el);
  });
}

// ツモ（現在の手番のプレイヤーが山から1枚引く）
function drawTileForCurrent() {
  if (state.wall.length === 0) {
    alert('山がなくなりました（流局）');
    return;
  }
  const tile = state.wall.pop();
  state.players[state.currentPlayer].push(tile);
  renderAll();

  // 自分の手番（player 0）の場合はそのまま待つ（ユーザーが捨てる）
  if (state.currentPlayer !== 0) {
    // 他家は簡易に自動で直ちに捨てる（一番右の牌を捨てる）
    setTimeout(() => {
      // 簡易AI: 最後に引いた牌を捨てる
      const p = state.currentPlayer;
      discardTile(p, state.players[p].length - 1);
    }, 400);
  }
}

// 捨て牌処理: playerIndex の手牌の index を捨てる
function discardTile(playerIndex, handIndex) {
  const tile = state.players[playerIndex].splice(handIndex,1)[0];
  state.discard.push(tile);
  renderAll();

  // 次の手番へ
  state.currentPlayer = (state.currentPlayer + 1) % 4;

  // 次のプレイヤーが自分でなければ自動でツモする
  if (state.currentPlayer !== 0) {
    // 他家は簡易に1枚ツモして1枚即捨て（実際は考えるが簡易化）
    setTimeout(() => {
      drawTileForCurrent();
    }, 400);
  } else {
    // 自分の番に戻った
    // UIはツモボタンでツモさせる（自分が自動で引かない）
  }
  renderAll();
}

// DOM イベント
document.getElementById('draw-button').addEventListener('click', () => {
  // 自分のツモは currentPlayer が 0 のときだけ許可
  if (state.currentPlayer !== 0) {
    alert('まだあなたの番ではありません。');
    return;
  }
  drawTileForCurrent();
});

document.getElementById('new-game').addEventListener('click', () => {
  deal();
});

// 初回
deal();
