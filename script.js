// 完全コピペで動く：捨て牌を4箇所に分割し、捨ては右に増えていくUIへ改良
// 既存の和了判定や牌描画機能は保持。副露は将来対応箇所あり。
// 主な変更点:
// - state.discards: 各プレイヤーごとの捨て牌配列に変更（state.discards[0..3]）
// - renderAll() で各プレイヤーの捨て牌エリアに追加（appendで右へ増える）
// - deal() で捨て牌をリセット
// - discardTile() が該当プレイヤーの捨て牌配列へ push するように

/* ---------------------------
   牌の表現（変更なし）
   --------------------------- */
const tileTypes = (() => {
  const suits = ['m','p','s']; // 萬子, 筒子, 索子
  const types = [];
  for (const s of suits) {
    for (let r=1; r<=9; r++) {
      types.push({code: `${r}${s}`, name: `${r}${s}`});
    }
  }
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
const codeToIndex = {};
tileTypes.forEach((t, i) => codeToIndex[t.code] = i);
function idxToCode(i) { return tileTypes[i].code; }
function idxToName(i) { return tileTypes[i].name; }

/* ---------------------------
   ゲーム状態（改良：discardsを4箇所に分割）
   --------------------------- */
const state = {
  wall: [],
  // discard per player: index 0..3
  discards: [[],[],[],[]],
  players: [[],[],[],[]], // 0:南=あなた, 1:西, 2:北, 3:東
  melds: [[],[],[],[]],
  currentPlayer: 0,
};

/* ---------------------------
   山作成・シャッフル・配牌（変更：discards初期化）
   --------------------------- */
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
function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function deal() {
  state.players = [[],[],[],[]];
  state.discards = [[],[],[],[]];
  state.melds = [[],[],[],[]];
  state.discardHistory = []; // deprecated but keep for compatibility
  state.wall = buildWall();
  shuffle(state.wall);

  for (let r=0;r<13;r++) {
    for (let p=0;p<4;p++) {
      state.players[p].push(state.wall.pop());
    }
  }
  state.players[0].push(state.wall.pop());
  state.currentPlayer = 0;
  renderAll();
}

/* ---------------------------
   UI: 牌描画（SVGを利用） - ほぼ以前と同様
   --------------------------- */
const tileTemplate = document.getElementById('tile-template');
function createTileElement(tile) {
  const tpl = tileTemplate.content.cloneNode(true);
  const tileEl = tpl.querySelector('.tile');
  const g = tileEl.querySelector('.tile-content');

  const code = tile.code;
  while (g.firstChild) g.removeChild(g.firstChild);

  if (code.match(/^[1-9][mps]$/)) {
    const num = code[0];
    const suit = code[1];
    const suitText = document.createElementNS("http://www.w3.org/2000/svg","text");
    suitText.setAttribute("x","6");
    suitText.setAttribute("y","18");
    suitText.setAttribute("font-size","10");
    suitText.setAttribute("fill","#666");
    suitText.textContent = suit === 'm' ? '萬' : suit === 'p' ? '筒' : '索';
    g.appendChild(suitText);

    const numText = document.createElementNS("http://www.w3.org/2000/svg","text");
    numText.setAttribute("x","50");
    numText.setAttribute("y","90");
    numText.setAttribute("text-anchor","middle");
    numText.setAttribute("font-size","44");
    numText.setAttribute("fill", code[0]==='5' ? '#ef4444' : '#111');
    numText.setAttribute("font-weight","600");
    numText.textContent = num;
    g.appendChild(numText);
  } else {
    const kanji = (code === 'E' ? '東' : code === 'S' ? '南' : code === 'W' ? '西' : code === 'N' ? '北' : code === 'P' ? '白' : code === 'F' ? '發' : '中');
    const kText = document.createElementNS("http://www.w3.org/2000/svg","text");
    kText.setAttribute("x","50");
    kText.setAttribute("y","78");
    kText.setAttribute("text-anchor","middle");
    kText.setAttribute("font-size","44");
    kText.setAttribute("fill", (code==='P'?'#111': code==='F'?'#0b7a3e': code==='C'?'#c91919':'#111'));
    kText.setAttribute("font-weight","700");
    kText.textContent = kanji;
    g.appendChild(kText);
  }

  tileEl._tile = tile;
  return tileEl;
}

/* ---------------------------
   レンダリング：各プレイヤーの捨て牌をそれぞれのエリアに表示（右に増える）
   --------------------------- */
function renderAll() {
  document.getElementById('wall-count').textContent = state.wall.length;
  document.querySelector('#player-north .count').textContent = state.players[2].length;
  document.querySelector('#player-east .count').textContent = state.players[3].length;
  document.querySelector('#player-west .count').textContent = state.players[1].length;

  // 各プレイヤーの捨て牌エリアをレンダリング（左から右へ追加していく）
  const ids = ['south','west','north','east']; // map player index to element id
  // mapping: player 0->south, 1->west, 2->north, 3->east
  const mapping = {
    0: 'discard-pile-south',
    1: 'discard-pile-west',
    2: 'discard-pile-north',
    3: 'discard-pile-east'
  };
  for (let p=0;p<4;p++) {
    const pileDiv = document.getElementById(mapping[p]);
    pileDiv.innerHTML = '';
    // append in natural order so new items are rightmost
    state.discards[p].forEach(t => {
      const el = createTileElement(t);
      pileDiv.appendChild(el); // append -> grows to the right
    });
  }

  // 自分の手牌（クリックで捨て）
  const myDiv = document.getElementById('player-south');
  myDiv.innerHTML = '';
  state.players[0].forEach((t, idx) => {
    const el = createTileElement(t);
    el.title = `index:${idx}`;
    el.addEventListener('click', () => {
      discardTile(0, idx);
    });
    myDiv.appendChild(el);
  });

  // 副露表示（将来対応）
  const meldsDiv = document.getElementById('melds');
  const m = state.melds[0];
  meldsDiv.textContent = '副露: ' + (m.length ? m.map(mm=>mm.join(',')).join(' | ') : 'なし');
}

/* ---------------------------
   ツモ・捨ての簡易ロジック（変更：discards配列へpush）
   --------------------------- */
function drawTileForCurrent() {
  if (state.wall.length === 0) {
    alert('山がなくなりました（流局）');
    return;
  }
  const tile = state.wall.pop();
  state.players[state.currentPlayer].push(tile);
  renderAll();

  if (state.currentPlayer !== 0) {
    setTimeout(() => {
      const p = state.currentPlayer;
      discardTile(p, state.players[p].length - 1);
    }, 300);
  }
}

function discardTile(playerIndex, handIndex) {
  const tile = state.players[playerIndex].splice(handIndex,1)[0];
  // push into that player's discard pile (so display shows who discarded)
  state.discards[playerIndex].push(tile);
  renderAll();

  state.currentPlayer = (state.currentPlayer + 1) % 4;

  if (state.currentPlayer !== 0) {
    setTimeout(() => {
      drawTileForCurrent();
    }, 300);
  }
}

/* ---------------------------
   UI イベント
   --------------------------- */
document.getElementById('draw-button').addEventListener('click', () => {
  if (state.currentPlayer !== 0) { alert('まだあなたの番ではありません。'); return; }
  drawTileForCurrent();
});
document.getElementById('new-game').addEventListener('click', () => deal());

document.getElementById('evaluate-hand').addEventListener('click', () => {
  const winMethod = document.getElementById('win-method').value; // "ron" or "tsumo"
  const roundWind = document.getElementById('round-wind').value; // E or S
  const seatWind = document.getElementById('seat-wind').value; // E,S,W,N
  const doraInput = prompt('ドラ表示牌コードをカンマ区切りで入力してください（例: 1m,5p,中）。空なら無し。', '');
  const doraIndicators = (doraInput || '').split(',').map(s=>s.trim()).filter(Boolean);
  const playerTiles = state.players[0].map(t => t.code);
  const result = evaluateHand(playerTiles, state.melds[0], winMethod === 'tsumo', null, seatWind, roundWind, doraIndicators, false);
  renderResult(result);
});

/* ---------------------------
   以下: 和了判定/役判定/点数計算ライブラリ（以前の実装をそのまま保持）
   - evaluateHand などは元の実装と互換性あり
   --------------------------- */

/* (和了判定ライブラリ: 元の実装をそのまま移植) */

function renderResult(result) {
  const yakuDiv = document.getElementById('yaku-list');
  const scoreDiv = document.getElementById('score-summary');
  yakuDiv.innerHTML = '';
  scoreDiv.innerHTML = '';

  if (!result || result.yaku.length === 0) {
    yakuDiv.textContent = '役なし（和了していない、もしくは役が付かない手牌）';
    return;
  }

  result.yaku.forEach(y => {
    const el = document.createElement('div');
    el.className = 'yaku-item';
    el.textContent = `${y.name} ${y.han>0?y.han+'翻':''}${y.isYakuman? '（役満）':''}`;
    yakuDiv.appendChild(el);
  });

  const s = result.score;
  const p = document.createElement('div');
  p.innerHTML = `<strong>合計翻数:</strong> ${result.totalHan} 翻 (${result.yaku.map(y=>y.name).join(',')})<br>
                 <strong>符:</strong> ${result.fu}<br>
                 <strong>基本点:</strong> ${result.basePoints}<br>
                 <strong>支払い:</strong> ${s.summary}`;
  scoreDiv.appendChild(p);
}

/* ---------------------------
   evaluateHand と各種判定関数（元のまま） 
   ※ ここでは冗長にならないよう関数群をそのまま貼っています（完全コピペで動作します）
   --------------------------- */

function countDora(tilesArray, doraIndicators) {
  if (!doraIndicators || doraIndicators.length === 0) return 0;
  let count = 0;
  tilesArray.forEach(t => {
    for (const d of doraIndicators) {
      if (t === d) count++;
    }
  });
  return count;
}

function isKokushi(counts) {
  const terminals = [];
  terminals.push(0); terminals.push(8);
  terminals.push(9); terminals.push(17);
  terminals.push(18); terminals.push(26);
  for (let i=27;i<=33;i++) terminals.push(i);
  let missing = terminals.some(idx => counts[idx] === 0);
  if (missing) return false;
  const duplicateExists = terminals.some(idx => counts[idx] >= 2);
  for (let i=0;i<34;i++) {
    if (!terminals.includes(i) && counts[i] > 0) return false;
  }
  return duplicateExists;
}

function isChiitoitsu(counts) {
  let pairs = 0;
  for (let i=0;i<34;i++) {
    if (counts[i] === 1 || counts[i] === 3) return false;
    if (counts[i] === 2) pairs++;
    if (counts[i] === 4) return false; // conservative
  }
  return pairs === 7;
}

function decomposeStandard(counts) {
  const res = [];
  for (let i=0;i<34;i++) {
    if (counts[i] >= 2) {
      const c2 = counts.slice();
      c2[i] -= 2;
      const groups = [];
      if (removeAllMelds(c2, groups)) {
        res.push({pair: i, groups: JSON.parse(JSON.stringify(groups))});
      }
    }
  }
  return res;
}
function removeAllMelds(counts, groups) {
  let i = counts.findIndex(x => x>0);
  if (i === -1) {
    return true;
  }
  if (counts[i] >= 3) {
    counts[i] -= 3;
    groups.push({type:'pon', tiles:[i,i,i]});
    if (removeAllMelds(counts, groups)) return true;
    groups.pop();
    counts[i] += 3;
  }
  const suit = suitOfIndex(i);
  const rank = rankOfIndex(i);
  if (suit !== null && rank <= 7) {
    const i1 = i;
    const i2 = i+1;
    const i3 = i+2;
    if (counts[i1]>0 && counts[i2]>0 && counts[i3]>0) {
      counts[i1]--; counts[i2]--; counts[i3]--;
      groups.push({type:'chi', tiles:[i1,i2,i3]});
      if (removeAllMelds(counts, groups)) return true;
      groups.pop();
      counts[i1]++; counts[i2]++; counts[i3]++;
    }
  }
  return false;
}
function suitOfIndex(i) {
  if (i >=0 && i<=8) return 'm';
  if (i>=9 && i<=17) return 'p';
  if (i>=18 && i<=26) return 's';
  return null;
}
function rankOfIndex(i) {
  if (i>=0 && i<=8) return i+1;
  if (i>=9 && i<=17) return i-9+1;
  if (i>=18 && i<=26) return i-18+1;
  return null;
}
function isYakuhaiPair(pairIdx, seatWind, roundWind) {
  if (pairIdx >= 27 && pairIdx <= 33) {
    const code = idxToCode(pairIdx);
    if (code === 'P' || code === 'F' || code === 'C') return true;
    if (code === seatWind) return true;
    if (code === roundWind) return true;
  }
  return false;
}
function isPairRyanmenWait(counts, pairIdx, groups, tilesArray, winTile) {
  if (!winTile) return false;
  try {
    const clone = tilesArray.slice();
    const wi = clone.indexOf(winTile);
    if (wi === -1) return false;
    clone.splice(wi,1);
    const counts2 = new Array(34).fill(0);
    clone.forEach(c=> counts2[codeToIndex[c]]++);
    const decs = decomposeStandard(counts2);
    for (const d of decs) {
      if (d.pair === pairIdx && d.groups.every(g=>g.type==='chi')) return true;
    }
    return false;
  } catch(e) { return false; }
}
function isTanyao(tilesArray, melds) {
  for (const t of tilesArray) {
    const code = t;
    if (code.match(/^[19][mps]$/)) return false;
    if (code.length === 1 && 'ESWNPFC'.includes(code)) return false;
  }
  if (melds && melds.length>0) {
    for (const mm of melds) {
      for (const t of mm.tiles) {
        if (t.match(/^[19][mps]$/)) return false;
        if (t.length===1 && 'ESWNPFC'.includes(t)) return false;
      }
    }
  }
  return true;
}
function seqSignature(tiles) {
  const s = suitOfIndex(tiles[0]);
  const r = rankOfIndex(tiles[0]);
  return `${s}-${r}`;
}
function detectSanshoku(groups) {
  const seqs = groups.filter(g=>g.type==='chi').map(g=>({
    s: suitOfIndex(g.tiles[0]),
    r: rankOfIndex(g.tiles[0])
  }));
  const map = {};
  seqs.forEach(s => {
    const key = s.r;
    if (!map[key]) map[key] = new Set();
    map[key].add(s.s);
  });
  for (const k in map) {
    if (map[k].size === 3) return true;
  }
  return false;
}
function detectIttsuu(groups) {
  const map = {m:new Set(), p:new Set(), s:new Set()};
  groups.filter(g=>g.type==='chi').forEach(g => {
    const s = suitOfIndex(g.tiles[0]);
    const r = rankOfIndex(g.tiles[0]);
    map[s].add(r);
  });
  for (const s of ['m','p','s']) {
    if (map[s].has(1) && map[s].has(4) && map[s].has(7)) return true;
  }
  return false;
}
function detectFlush(tilesArray) {
  const suitsPresent = new Set();
  let honorsPresent = false;
  tilesArray.forEach(c => {
    if (c.length === 1) honorsPresent = true;
    else suitsPresent.add(c[1]);
  });
  if (suitsPresent.size === 1 && !honorsPresent) return {type:'chinitsu'};
  if (suitsPresent.size === 1 && honorsPresent) return {type:'honitsu'};
  return {type:null};
}
function detectSanankou(groups, melds, tilesArray) {
  const ponCount = groups.filter(g=>g.type==='pon').length;
  const hasOpenPon = (melds && melds.some(m => m.type === 'pon' || m.type === 'kan'));
  if (!hasOpenPon && ponCount >= 3) return true;
  return false;
}
function detectSanGen(counts) {
  const dragonsIdx = [31,32,33];
  const cnts = dragonsIdx.map(i => counts[i]);
  const ponCount = cnts.filter(c => c >= 3).length;
  if (ponCount === 3) return 'dai';
  if (ponCount === 2 && cnts.some(c => c === 2)) return 'shou';
  return null;
}
function detectYakuhai(counts, seatWind, roundWind) {
  const yakuhaiTiles = [];
  if (roundWind) yakuhaiTiles.push(roundWind);
  if (seatWind) yakuhaiTiles.push(seatWind);
  yakuhaiTiles.push('P','F','C');
  let cnt = 0;
  for (const code of yakuhaiTiles) {
    const idx = codeToIndex[code];
    if (idx !== undefined && counts[idx] >= 3) cnt++;
  }
  return cnt;
}
function isChinroutou(counts) {
  for (let i=0;i<34;i++) {
    if (counts[i] === 0) continue;
    const suit = suitOfIndex(i);
    const rank = rankOfIndex(i);
    if (suit === null) return false;
    if (!(rank === 1 || rank === 9)) return false;
  }
  return true;
}
function isTsuisou(counts) {
  for (let i=0;i<34;i++) {
    if (counts[i] === 0) continue;
    if (i < 27) return false;
  }
  return true;
}
function isRyuuiisou(counts) {
  const allowed = new Set(['2s','3s','4s','6s','8s','F']);
  for (let i=0;i<34;i++) {
    if (counts[i] === 0) continue;
    if (!allowed.has(idxToCode(i))) return false;
  }
  return true;
}
function isChuren(counts) {
  for (const s of ['m','p','s']) {
    const offset = s==='m'?0:s==='p'?9:18;
    const needed = new Array(9).fill(0);
    needed[0] = 3; needed[8] = 3;
    for (let i=1;i<=7;i++) needed[i] = 1;
    let ok = true;
    for (let i=0;i<9;i++) {
      const idx = offset + i;
      if (counts[idx] < needed[i]) { ok = false; break; }
    }
    if (!ok) continue;
    const suitTotal = (new Array(9)).map((_,i)=>counts[offset+i]).reduce((a,b)=>a+b,0);
    if (suitTotal === 14) return true;
    if (suitTotal === 14 || suitTotal === 14) return true;
  }
  return false;
}

function calculateFu(counts, groups, pairIdx, isTsumo, isClosed, yakuList) {
  if (isChiitoitsu(counts)) return 25;
  let fu = 20;
  groups.forEach(g => {
    if (g.type === 'pon') {
      const tileIdx = g.tiles[0];
      const isTerminalOrHonor = (suitOfIndex(tileIdx) === null) || rankOfIndex(tileIdx) === 1 || rankOfIndex(tileIdx) === 9;
      fu += isTerminalOrHonor ? 8 : 4;
    }
  });
  if (pairIdx >= 27 && pairIdx <= 33) {
    fu += 2;
  }
  const hasPinfu = yakuList.some(y => y.name === '平和');
  if (isTsumo && !hasPinfu) fu += 2;
  fu = Math.ceil(fu / 10) * 10;
  return fu;
}

function computeBasePoints(totalHan, fu, yakuList) {
  const anyYakuman = yakuList.some(y => y.isYakuman);
  if (anyYakuman) {
    const yakumanCount = yakuList.filter(y => y.isYakuman).length;
    return 8000 * yakumanCount;
  }
  if (totalHan <= 0) return 0;
  let base = fu * Math.pow(2, totalHan + 2);
  if (totalHan >= 13) {
    base = 8000;
  } else if (totalHan >= 11) {
    base = 6000;
  } else if (totalHan >= 8) {
    base = 4000;
  } else if (totalHan >= 6) {
    base = 3000;
  } else if (totalHan === 5 || base >= 2000) {
    base = 2000;
  }
  return Math.floor(base);
}
function computeScoreSummary(basePoints, totalHan, isTsumo, isDealer) {
  const capTo100 = x => Math.ceil(x/100)*100;
  const dealerWin = isDealer || false;
  if (basePoints === 0) return {summary: '役無し'};
  if (!isTsumo) {
    const mult = dealerWin ? 6 : 4;
    const payment = capTo100(basePoints * mult);
    return {summary: `ロン: 支払 ${payment} 点（基本点 ${basePoints}, ${totalHan} 翻）`};
  } else {
    if (dealerWin) {
      const each = capTo100(basePoints * 2);
      return {summary: `ツモ: 他家各自 ${each} 点（基本点 ${basePoints}, ${totalHan} 翻, 親）`};
    } else {
      const dealerPays = capTo100(basePoints * 2);
      const otherPays = capTo100(basePoints * 1);
      return {summary: `ツモ: 親 ${dealerPays} 点、他家各自 ${otherPays} 点（基本点 ${basePoints}, ${totalHan} 翻）`};
    }
  }
}

function evaluateHand(tilesArray, melds = [], isTsumo=false, winTile=null, seatWind='S', roundWind='E', doraIndicators = [], riichiDeclared=false) {
  if (!Array.isArray(tilesArray)) return null;
  if (tilesArray.length !== 14) {
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '手牌は14枚ではありません'} };
  }
  const counts = new Array(34).fill(0);
  tilesArray.forEach(c => {
    const idx = codeToIndex[c];
    if (idx === undefined) throw new Error('unknown tile code: ' + c);
    counts[idx]++;
  });
  const doraCount = countDora(tilesArray, doraIndicators);
  const yakusFound = [];
  const isClosed = !(melds && melds.length > 0);
  if (isKokushi(counts)) {
    yakusFound.push({name:'国士無双', han:13, isYakuman:true});
  }
  if (isChiitoitsu(counts)) {
    yakusFound.push({name:'七対子', han:2, isYakuman:false});
  }
  const decomps = decomposeStandard(counts);
  if (decomps.length === 0 && !isChiitoitsu(counts) && !isKokushi(counts)) {
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '和了形ではありません'} };
  }
  if (decomps.length === 0) {
    const totalHan = yakusFound.reduce((s,y)=>s+y.han,0) + doraCount + (riichiDeclared ? 1 : 0);
    const fu = isChiitoitsu(counts) ? 25 : (yakusFound.some(y=>y.isYakuman) ? 0 : 20);
    const basePoints = computeBasePoints(totalHan, fu, yakusFound);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);
    return { yaku: yakusFound, totalHan, fu, basePoints, score };
  }
  const candidates = [];
  decomps.forEach(decomp => {
    const yakuList = [];
    const tilesFlat = tilesArray.slice();
    const pairIdx = decomp.pair;
    const groups = decomp.groups;
    const isAllSequences = groups.every(g => g.type === 'chi');
    const isAllTriplets = groups.every(g => g.type === 'pon');
    const hasTriplet = groups.some(g => g.type === 'pon');
    if (isClosed && riichiDeclared) {
      yakuList.push({name:'立直', han:1, isYakuman:false});
    }
    const pairIsYakuhai = isYakuhaiPair(pairIdx, seatWind, roundWind);
    if (isClosed && isAllSequences && !pairIsYakuhai) {
      const isRyanmen = isPairRyanmenWait(counts, pairIdx, groups, tilesArray, winTile);
      if (isRyanmen || isTsumo) {
        yakuList.push({name:'平和', han:1, isYakuman:false});
      }
    }
    if (isClosed && isTsumo) {
      yakuList.push({name:'門前清自摸', han:1, isYakuman:false});
    }
    if (isTanyao(tilesArray, melds)) {
      yakuList.push({name:'断幺九', han:1, isYakuman:false});
    }
    if (isClosed) {
      const seqs = groups.filter(g => g.type==='chi').map(g => seqSignature(g.tiles));
      const countsSeq = {};
      seqs.forEach(s => countsSeq[s] = (countsSeq[s]||0)+1);
      if (Object.values(countsSeq).some(v => v >= 2)) {
        yakuList.push({name:'一盃口', han:1, isYakuman:false});
      }
      const dups = Object.values(countsSeq).filter(v=>v>=2).length;
      if (dups >= 2) {
        yakuList.push({name:'二盃口', han:2, isYakuman:false});
      }
    }
    const sanshoku = detectSanshoku(groups);
    if (sanshoku) {
      yakuList.push({name:'三色同順', han:1, isYakuman:false});
    }
    if (detectIttsuu(groups)) {
      yakuList.push({name:'一気通貫', han:1, isYakuman:false});
    }
    const flush = detectFlush(tilesArray);
    if (flush.type === 'chinitsu') {
      yakuList.push({name:'清一色', han:6, isYakuman:false});
    } else if (flush.type === 'honitsu') {
      yakuList.push({name:'混一色', han:3, isYakuman:false});
    }
    if (isAllTriplets) {
      yakuList.push({name:'対々和', han:2, isYakuman:false});
    }
    if (detectSanankou(groups, melds, tilesArray)) {
      yakuList.push({name:'三暗刻', han:2, isYakuman:false});
    }
    const dragonYaku = detectSanGen(new Array(34).fill(0).map((_,i)=>0).map((_,i)=>0)); // placeholder, will be recalculated below
    // Recompute counts for dragon detection properly:
    const countsNow = new Array(34).fill(0);
    tilesArray.forEach(c => countsNow[codeToIndex[c]]++);
    const dragonYakuReal = detectSanGen(countsNow);
    if (dragonYakuReal === 'dai') {
      yakuList.push({name:'大三元', han:13, isYakuman:true});
    } else if (dragonYakuReal === 'shou') {
      yakuList.push({name:'小三元', han:2, isYakuman:false});
    }
    const yakuhaiCount = detectYakuhai(countsNow, seatWind, roundWind);
    if (yakuhaiCount > 0) {
      for (let i=0;i<yakuhaiCount;i++) yakuList.push({name:'役牌', han:1, isYakuman:false});
    }
    if (isChinroutou(countsNow)) {
      yakuList.push({name:'清老頭', han:13, isYakuman:true});
    }
    if (isTsuisou(countsNow)) {
      yakuList.push({name:'字一色', han:13, isYakuman:true});
    }
    if (isRyuuiisou(countsNow)) {
      yakuList.push({name:'緑一色', han:13, isYakuman:true});
    }
    if (isChuren(countsNow)) {
      yakuList.push({name:'九蓮宝燈', han:13, isYakuman:true});
    }
    if (doraCount > 0) {
      for (let i=0;i<doraCount;i++) yakuList.push({name:'ドラ', han:1, isYakuman:false});
    }
    if (riichiDeclared && isClosed) {
      yakuList.push({name:'立直', han:1, isYakuman:false});
    }
    const yakumanCount = yakuList.filter(y=>y.isYakuman).length;
    let totalHan = yakumanCount > 0 ?
                   yakumanCount * 13 :
                   yakuList.filter(y=>!y.isYakuman).reduce((s,y)=>s+y.han,0);
    const fu = calculateFu(countsNow, groups, decomp.pair, isTsumo, isClosed, yakuList);
    const basePoints = computeBasePoints(totalHan, fu, yakuList);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);
    candidates.push({yakuList, totalHan, fu, basePoints, score});
  });

  candidates.sort((a,b) => {
    if (a.basePoints !== b.basePoints) return b.basePoints - a.basePoints;
    if (a.totalHan !== b.totalHan) return b.totalHan - a.totalHan;
    return b.fu - a.fu;
  });

  const best = candidates[0];
  return {
    yaku: best.yakuList,
    totalHan: best.totalHan,
    fu: best.fu,
    basePoints: best.basePoints,
    score: best.score
  };
}

/* ---------------------------
   テスト用/デバッグ用に一部関数を window に公開
   --------------------------- */
window._mahjong = {
  evaluateHand,
  decomposeStandard,
  isChiitoitsu,
  isKokushi,
  codeToIndex,
  idxToCode,
  idxToName,
  tileTypes,
  state
};

// 初回配牌
deal();
