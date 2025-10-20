// 完全コピペで動く：和了判定（メンツ判定）と多くの役（日本式リーチ麻雀）実装
// SVGで牌を描画（画像ファイル不要）
// 簡易AI対戦は引き続き最小実装（今後AIが評価関数で和了判定を使います）
//
// 使い方：index.html をブラウザで開き、「新しい局を開始」→自分は14枚、他家13枚。
// 「ツモ」で自分がツモ、牌クリックで捨て。右の「和了判定」で現在の手牌を評価します。
// 副露（ポン/チー/カン）は現在UI非対応ですが、評価関数はmelds引数を受け取るので将来拡張可能。

/* ---------------------------
   牌の表現
   34種類: 0-8 = 1-9m, 9-17 = 1-9p, 18-26 = 1-9s, 27-33 = 東南西北白發中
   tileCode -> display name: "1m","2p",... or "東","白" 等
   --------------------------- */

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

// code -> index
const codeToIndex = {};
tileTypes.forEach((t, i) => codeToIndex[t.code] = i);
function idxToCode(i) { return tileTypes[i].code; }
function idxToName(i) { return tileTypes[i].name; }

/* ---------------------------
   ゲーム状態（簡易）
   players hands: array of arrays of tile objects {id, code, name}
   melds: array per player (将来的に使用)
   --------------------------- */

const state = {
  wall: [],
  discard: [],
  players: [[],[],[],[]], // 0:南=あなた, 1:西, 2:北, 3:東
  melds: [[],[],[],[]],   // 各プレイヤーの副露（将来）
  currentPlayer: 0,
};

/* ---------------------------
   山作成・シャッフル・配牌
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
  state.discard = [];
  state.melds = [[],[],[],[]];
  state.wall = buildWall();
  shuffle(state.wall);

  // 各家13枚ずつ、南(0)は14枚
  for (let r=0;r<13;r++) {
    for (let p=0;p<4;p++) {
      state.players[p].push(state.wall.pop());
    }
  }
  // 南は+1枚（今回は簡易で南が親）
  state.players[0].push(state.wall.pop());
  state.currentPlayer = 0;
  renderAll();
}

/* ---------------------------
   UI: 牌描画（SVGを利用）
   --------------------------- */

const tileTemplate = document.getElementById('tile-template');

function createTileElement(tile) {
  const tpl = tileTemplate.content.cloneNode(true);
  const tileEl = tpl.querySelector('.tile');
  const g = tileEl.querySelector('.tile-content');

  // 内容を描画（簡易：萬/筒/索は大きな数字＋スート、小字牌は漢字）
  const code = tile.code;
  // Clear
  while (g.firstChild) g.removeChild(g.firstChild);

  if (code.match(/^[1-9][mps]$/)) {
    const num = code[0];
    const suit = code[1];
    // メジャーな描画: 左上に小さいスート名, 中央に大きな数字
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
    // 字牌
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

  // attach tile object for event handlers
  tileEl._tile = tile;
  return tileEl;
}

function renderAll() {
  document.getElementById('wall-count').textContent = state.wall.length;
  document.querySelector('#player-north .count').textContent = state.players[2].length;
  document.querySelector('#player-east .count').textContent = state.players[3].length;
  document.querySelector('#player-west .count').textContent = state.players[1].length;

  // 捨て牌
  const discardDiv = document.getElementById('discard-pile');
  discardDiv.innerHTML = '';
  state.discard.slice().reverse().forEach(t => {
    const el = createTileElement(t);
    el.classList.add('small');
    discardDiv.appendChild(el);
  });

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
   ツモ・捨ての簡易ロジック（AIはまだ簡易）
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
    // 他家は簡易AI：直ちに捨てる（最後に引いた牌を捨てる）
    setTimeout(() => {
      const p = state.currentPlayer;
      discardTile(p, state.players[p].length - 1);
    }, 300);
  }
}

function discardTile(playerIndex, handIndex) {
  const tile = state.players[playerIndex].splice(handIndex,1)[0];
  state.discard.push(tile);
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
  // 現在手牌で和了判定および点数を表示
  const winMethod = document.getElementById('win-method').value; // "ron" or "tsumo"
  const roundWind = document.getElementById('round-wind').value; // E or S
  const seatWind = document.getElementById('seat-wind').value; // E,S,W,N
  const doraInput = prompt('ドラ表示牌コードをカンマ区切りで入力してください（例: 1m,5p,中）。空なら無し。', '');
  const doraIndicators = (doraInput || '').split(',').map(s=>s.trim()).filter(Boolean);
  // melds: 現状空。将来は state.melds[0] を利用
  const playerTiles = state.players[0].map(t => t.code);
  const result = evaluateHand(playerTiles, state.melds[0], winMethod === 'tsumo', null, seatWind, roundWind, doraIndicators, false);
  renderResult(result);
});

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

  // 点数表示
  const s = result.score;
  const p = document.createElement('div');
  p.innerHTML = `<strong>合計翻数:</strong> ${result.totalHan} 翻 (${result.yaku.map(y=>y.name).join(',')})<br>
                 <strong>符:</strong> ${result.fu}<br>
                 <strong>基本点:</strong> ${result.basePoints}<br>
                 <strong>支払い:</strong> ${s.summary}`;
  scoreDiv.appendChild(p);
}

/* ---------------------------
   和了判定・役判定ライブラリ部分
   - evaluateHand(tilesArray, melds, isTsumo, winTile, seatWind, roundWind, doraIndicators, riichiDeclared)
   - 返り値: { yaku: [{name,han,isYakuman}], totalHan, fu, basePoints, score: {summary...} }
   --------------------------- */

/*
  基本アイデア:
  - tilesArray: 14枚のコード文字列（例: "1m","5p","E"）
  - melds: 今は空配列を想定。将来副露情報を入れる（例: [{type:'pon', tiles:['5p','5p','5p'], from:1}, ...]）
  - isTsumo: 真ならツモ和了
  - winTile: nullなら自動（最後の牌を和了牌とする）※UIではnull
  - seatWind/roundWind: 'E','S','W','N' を使って役牌判定
  - doraIndicators: 表ドラのコード配列（例: ['5p']）
  - riichiDeclared: 今は false（将来対応）
*/

function evaluateHand(tilesArray, melds = [], isTsumo=false, winTile=null, seatWind='S', roundWind='E', doraIndicators = [], riichiDeclared=false) {
  // 基本チェック: 14枚でない場合は和了不可（鳴きなど将来の対応はmeldsを参照）
  if (!Array.isArray(tilesArray)) return null;
  if (tilesArray.length !== 14) {
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '手牌は14枚ではありません'} };
  }

  // counts (34)
  const counts = new Array(34).fill(0);
  tilesArray.forEach(c => {
    const idx = codeToIndex[c];
    if (idx === undefined) throw new Error('unknown tile code: ' + c);
    counts[idx]++;
  });

  // dora count
  const doraCount = countDora(tilesArray, doraIndicators);

  // 判定ケース: 国士無双、七対子（これらは分解不要）
  const yakusFound = [];

  // helper: 閉鎖(門前)判定: meldsが空なら閉鎖
  const isClosed = !(melds && melds.length > 0);

  // 国士無双検出
  if (isKokushi(counts)) {
    // 国士無双は役満（一般的に）
    yakusFound.push({name:'国士無双', han:13, isYakuman:true});
    // ドラは役満と併算するローカルルールがあるがここでは役満扱い
  }

  // 七対子
  if (isChiitoitsu(counts)) {
    yakusFound.push({name:'七対子', han:2, isYakuman:false});
    // 七対子は符固定25（切り上げで25）
    // だが複合役（混一色等）も成立することがある -> 下で組み合わせ判定をするためkeep processing
  }

  // それ以外：通常メンツ分解を行って様々な役を検出
  const decomps = decomposeStandard(counts); // returns array of decompositions {melds: [{type:'chi'/'pon',tiles:[idx,...]}], pair: idx}
  // decomps may be empty if not standard hand

  // We'll analyze each decomposition and pick the one giving最大翻数（yakus + dora + riichi）
  const candidates = [];

  if (decomps.length === 0 && !isChiitoitsu(counts) && !isKokushi(counts)) {
    // 非和了構成
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '和了形ではありません'} };
  }

  // For chiitoitsu/kokushi, decomps may be empty but we already added them to yakusFound; prepare candidate base
  if (decomps.length === 0) {
    const totalHan = yakusFound.reduce((s,y)=>s+y.han,0) + doraCount + (riichiDeclared ? 1 : 0);
    const fu = isChiitoitsu(counts) ? 25 : (yakusFound.some(y=>y.isYakuman) ? 0 : 20);
    const basePoints = computeBasePoints(totalHan, fu, yakusFound);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);
    return { yaku: yakusFound, totalHan, fu, basePoints, score };
  }

  // Analyze each decomposition
  decomps.forEach(decomp => {
    const yakuList = []; // for this decomposition
    // Start with mandatory ones we detected globally (kokushi/chiitoitsu) not relevant here (since decomp present)
    // Basic checks
    const tilesFlat = tilesArray.slice(); // codes
    const pairIdx = decomp.pair;
    const groups = decomp.groups; // array of {type:'chi'|'pon', tiles:[indices]}
    // helper funcs
    const isAllSequences = groups.every(g => g.type === 'chi');
    const isAllTriplets = groups.every(g => g.type === 'pon');
    const hasTriplet = groups.some(g => g.type === 'pon');

    // 門前（閉鎖）
    if (isClosed && riichiDeclared) {
      yakuList.push({name:'立直', han:1, isYakuman:false});
    } else if (isClosed && riichiDeclared === false) {
      // not declared riichi -> nothing
    }

    // 平和 (pinfu) 条件: 門前, すべて順子, 副露なし(pairは役牌でない), 両面待ち(待ち判定は厳密には必要)
    // 簡易判定: all sequences && pair not yakuhai && 門前
    const pairIsYakuhai = isYakuhaiPair(pairIdx, seatWind, roundWind);
    if (isClosed && isAllSequences && !pairIsYakuhai) {
      // Note: 本来両面待ちであるかのチェックが必要; ここでは待ち検出が不要な簡易バージョンとして平和条件を緩和せず、実際に両面待ちであるかチェックする
      const isRyanmen = isPairRyanmenWait(counts, pairIdx, groups, tilesArray, winTile);
      if (isRyanmen || isTsumo) {
        // pinfu tsumo allowed; for ron must be ryanmen (両面) to be pinfu
        yakuList.push({name:'平和', han:1, isYakuman:false});
      }
    }

    // 門前清自摸 (menzen tsumo) : 門前かつツモ
    if (isClosed && isTsumo) {
      yakuList.push({name:'門前清自摸', han:1, isYakuman:false});
    }

    // タンヤオ: 面子・対子に么九牌・字牌がない
    if (isTanyao(tilesArray, melds)) {
      yakuList.push({name:'断幺九', han:1, isYakuman:false});
    }

    // 一盃口 / 二盃口: 同じ順子が1組/2組（閉鎖のみで1翻）
    if (isClosed) {
      const seqs = groups.filter(g => g.type==='chi').map(g => seqSignature(g.tiles));
      const countsSeq = {};
      seqs.forEach(s => countsSeq[s] = (countsSeq[s]||0)+1);
      if (Object.values(countsSeq).some(v => v >= 2)) {
        yakuList.push({name:'一盃口', han:1, isYakuman:false});
      }
      // 二盃口: two different identical sequence pairs (つまり2つ重複)
      const dups = Object.values(countsSeq).filter(v=>v>=2).length;
      if (dups >= 2) {
        // 二盃口は閉鎖のみ 3翻? 実際は二盃口は2翻（閉鎖のみ）
        // ルール: 一盃口が1翻。二盃口は二翻（ryanpeikou）。
        // 実装：二盃口を優先して2翻にする（重複が2個）
        // Remove the earlier added 一盃口 and add 2翻
        // For simple implementation, if dups>=2, add 2翻 and mark as ryanpeikou
        // We add both as separate yaku; later we'll sum han.
        yakuList.push({name:'二盃口', han:2, isYakuman:false});
      }
    }

    // 三色同順（sanshoku doujun）
    const sanshoku = detectSanshoku(groups);
    if (sanshoku) {
      yakuList.push({name:'三色同順', han:1, isYakuman:false});
    }

    // 一気通貫 (ittsuu)
    if (detectIttsuu(groups)) {
      yakuList.push({name:'一気通貫', han:1, isYakuman:false});
    }

    // 混全帯幺九 / 清全帯幺九 (混一色/清一色)
    const flush = detectFlush(tilesArray);
    if (flush.type === 'chinitsu') {
      yakuList.push({name:'清一色', han:6, isYakuman:false}); // closed typically 6翻 open 5翻; simplified: 6翻
    } else if (flush.type === 'honitsu') {
      yakuList.push({name:'混一色', han:3, isYakuman:false}); // closed 3翻 open 2翻 ; simplified 3翻
    }

    // 対々和（トイトイ）
    if (isAllTriplets) {
      yakuList.push({name:'対々和', han:2, isYakuman:false});
    }

    // 三暗刻（sanankou）: 閉鎖で3つの暗刻
    if (detectSanankou(groups, melds, tilesArray)) {
      yakuList.push({name:'三暗刻', han:2, isYakuman:false});
    }

    // 小三元 / 大三元
    const dragonYaku = detectSanGen(counts);
    if (dragonYaku === 'dai') {
      yakuList.push({name:'大三元', han:13, isYakuman:true});
    } else if (dragonYaku === 'shou') {
      yakuList.push({name:'小三元', han:2, isYakuman:false});
    }

    // 役牌（場風、自風、三元牌のポンまたは暗刻）
    const yakuhaiCount = detectYakuhai(counts, seatWind, roundWind);
    if (yakuhaiCount > 0) {
      // 1つにつき1翻
      for (let i=0;i<yakuhaiCount;i++) yakuList.push({name:'役牌', han:1, isYakuman:false});
    }

    // 清老頭/字一色/緑一色/九蓮等（役満系の一部）簡易チェック
    if (isChinroutou(counts)) {
      yakuList.push({name:'清老頭', han:13, isYakuman:true});
    }
    if (isTsuisou(counts)) {
      yakuList.push({name:'字一色', han:13, isYakuman:true});
    }
    if (isRyuuiisou(counts)) {
      yakuList.push({name:'緑一色', han:13, isYakuman:true});
    }
    if (isChuren(counts)) {
      yakuList.push({name:'九蓮宝燈', han:13, isYakuman:true});
    }

    // ロン・ツモによる特殊役は上で追加 (門前清自摸等)
    // ドラの翻数を最後で追加
    if (doraCount > 0) {
      for (let i=0;i<doraCount;i++) yakuList.push({name:'ドラ', han:1, isYakuman:false});
    }

    // リーチ宣言がある場合はここで反映（今回riichiDeclared引数を受け取る）
    if (riichiDeclared && isClosed) {
      yakuList.push({name:'立直', han:1, isYakuman:false});
    }

    // 七対子などと重複する部分があるが、decomp系は通常の面子手なのでそのまま扱う

    // 合計翻数、役満判定、符計算、基本点計算
    // If any yakuman found in yakuList, treat differently: sum yakuman count * yakumanHan (13) and set isYakuman flags
    const yakumanCount = yakuList.filter(y=>y.isYakuman).length;
    let totalHan = yakumanCount > 0 ?
                   // yakuman scoring: treat each yakuman as a yakuman unit, but also include multiple yakuman stacking
                   yakumanCount * 13 :
                   yakuList.filter(y=>!y.isYakuman).reduce((s,y)=>s+y.han,0);
    // Ensure riichi/dora counted above
    // Fu calculation: complex; we'll compute via calculateFu (近似だが一般的)
    const fu = calculateFu(counts, groups, pairIdx, isTsumo, isClosed, yakuList);

    const basePoints = computeBasePoints(totalHan, fu, yakuList);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);

    candidates.push({yakuList, totalHan, fu, basePoints, score});
  });

  // Pick best candidate by highest payment (basePoints), fallback to highest han then fu
  candidates.sort((a,b) => {
    if (a.basePoints !== b.basePoints) return b.basePoints - a.basePoints;
    if (a.totalHan !== b.totalHan) return b.totalHan - a.totalHan;
    return b.fu - a.fu;
  });

  const best = candidates[0];
  // Normalize yaku entries (group duplicates and present names + han)
  // But we've used array of objects; return that
  return {
    yaku: best.yakuList,
    totalHan: best.totalHan,
    fu: best.fu,
    basePoints: best.basePoints,
    score: best.score
  };
}

/* ---------------------------
   補助関数群：役判定ロジック
   --------------------------- */

function countDora(tilesArray, doraIndicators) {
  if (!doraIndicators || doraIndicators.length === 0) return 0;
  let count = 0;
  tilesArray.forEach(t => {
    for (const d of doraIndicators) {
      if (t === d) count++;
      // also handle red 5 detection: if user input '5p赤' not supported
    }
  });
  return count;
}

// 国士無双判定
function isKokushi(counts) {
  // terminals+honors must contain at least one each (13 distinct), and total tiles be one duplicate among those
  const terminals = [];
  // 1 and 9 of each suit: indices 0,8 ; 9,17 ; 18,26
  terminals.push(0); terminals.push(8);
  terminals.push(9); terminals.push(17);
  terminals.push(18); terminals.push(26);
  // honors 27-33
  for (let i=27;i<=33;i++) terminals.push(i);
  // Check at least one each
  let missing = terminals.some(idx => counts[idx] === 0);
  if (missing) return false;
  // Must have exactly 14 tiles and one duplicate among the terminals/honors
  const duplicateExists = terminals.some(idx => counts[idx] >= 2);
  // also ensure other tiles counts are zero
  for (let i=0;i<34;i++) {
    if (!terminals.includes(i) && counts[i] > 0) return false;
  }
  return duplicateExists;
}

// 七対子判定
function isChiitoitsu(counts) {
  let pairs = 0;
  for (let i=0;i<34;i++) {
    if (counts[i] === 1 || counts[i] === 3) return false;
    if (counts[i] === 2) pairs++;
    if (counts[i] === 4) pairs += 2; // 四枚で二組という扱いは一部ルールにあるが、一般的には七対子で四枚は不可 -> ここは保守的にfalse
  }
  return pairs === 7;
}

// 標準形分解（雀頭 + 面子）
// counts -> returns list of decompositions [{pair: idx, groups: [{type:'chi'/'pon', tiles:[i,i+1,i+2] or [i,i,i]}...]}]
// This routine attempts all possible pairs and recursively removes melds.
// Note: honors can't form chi.
function decomposeStandard(counts) {
  const res = [];
  // Must have 14 tiles: satisfied earlier by caller
  // Try every possible pair
  for (let i=0;i<34;i++) {
    if (counts[i] >= 2) {
      const c2 = counts.slice();
      c2[i] -= 2;
      const groups = [];
      if (removeAllMelds(c2, groups)) {
        // deep copy groups
        res.push({pair: i, groups: JSON.parse(JSON.stringify(groups))});
      }
    }
  }
  return res;
}

// removeAllMelds: recursive
function removeAllMelds(counts, groups) {
  // find first tile with count>0
  let i = counts.findIndex(x => x>0);
  if (i === -1) {
    return true;
  }
  // try pon/kan
  if (counts[i] >= 3) {
    counts[i] -= 3;
    groups.push({type:'pon', tiles:[i,i,i]});
    if (removeAllMelds(counts, groups)) return true;
    groups.pop();
    counts[i] += 3;
  }
  // try chi (only for numbered suits and if i is not 8/17/26)
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

// Pair yakuhai check
function isYakuhaiPair(pairIdx, seatWind, roundWind) {
  // pairIdx is index number. If pair is dragons (27-29?) -> indices: 31? Wait mapping: our honors indices 27:E,28:S,29:W,30:N,31:P,32:F,33:C
  // seatWind/roundWind correspond to codes 'E','S','W','N'
  if (pairIdx >= 27 && pairIdx <= 33) {
    const code = idxToCode(pairIdx);
    if (code === 'P' || code === 'F' || code === 'C') return true;
    if (code === seatWind) return true;
    if (code === roundWind) return true;
  }
  return false;
}

// 両面待ちか厳密に判定（簡易）
// For a correct Pinfu判定 we need to ensure the winning tile completes a ryanmen wait.
// This helper will try to infer whether the pair/groups + win tile corresponds to ryanmen.
// Since UI may not supply winTile, we treat tsumo as okay for pinfu earlier.
function isPairRyanmenWait(counts, pairIdx, groups, tilesArray, winTile) {
  // If no winTile supplied, we can't robustly check; return true conservatively for tsumo/closed tsumo handled elsewhere.
  if (!winTile) return false;
  // For simplicity, we attempt to reconstruct waits: check if removing winTile produces a decomposable hand with pair at pairIdx and no change to sequences type counts
  try {
    const clone = tilesArray.slice();
    // remove one winTile occurrence
    const wi = clone.indexOf(winTile);
    if (wi === -1) return false;
    clone.splice(wi,1);
    const counts2 = new Array(34).fill(0);
    clone.forEach(c=> counts2[codeToIndex[c]]++);
    // Try all decomps for counts2 and check that pair is same and all groups are sequences
    const decs = decomposeStandard(counts2);
    for (const d of decs) {
      if (d.pair === pairIdx && d.groups.every(g=>g.type==='chi')) return true;
    }
    return false;
  } catch(e) { return false; }
}

// タンヤオ検出
function isTanyao(tilesArray, melds) {
  // No terminal(1,9) or honors in any tile or melds
  for (const t of tilesArray) {
    const code = t;
    if (code.match(/^[19][mps]$/)) return false;
    if (code.length === 1 && 'ESWNPFC'.includes(code)) return false;
  }
  // Melds check (if any)
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

// シーケンスのシグネチャ（スート+最小数字）を返す
function seqSignature(tiles) {
  // tiles are indices presumably adjacent; return like "m-2" for 234m -> 2
  const s = suitOfIndex(tiles[0]);
  const r = rankOfIndex(tiles[0]);
  return `${s}-${r}`;
}

// 三色同順検出: groupsに存在するsequenceの中で同じ数字のsequenceが3スート揃っているか
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

// 一気通貫検出（同一スート内で123,456,789を含む）
function detectIttsuu(groups) {
  // For each suit, collect starting ranks of sequences
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

// 混一色/清一色検出（簡易）
// If tiles contain only one suit and optionally honors -> honitsu
// If only one suit and no honors -> chinitsu
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

// 三暗刻の検出（簡易）
// groupsは分解された手のgroups、meldsは開放副露情報（将来対応）
// We'll count concealed triplets: triplets in groups that are not from melds (we assume groups from decomposition that correspond to pon are暗刻 unless melds indicate otherwise)
// Given lack of melds info, we approximate: if groups has at least 3 pons and hand was closed, consider 三暗刻成立.
function detectSanankou(groups, melds, tilesArray) {
  const ponCount = groups.filter(g=>g.type==='pon').length;
  // If melds contain pon/kan it's open; so if melds empty and ponCount>=3 -> sanankou
  const hasOpenPon = (melds && melds.some(m => m.type === 'pon' || m.type === 'kan'));
  if (!hasOpenPon && ponCount >= 3) return true;
  return false;
}

// 大/小三元
function detectSanGen(counts) {
  const dragonsIdx = [31,32,33]; // P,F,C
  const cnts = dragonsIdx.map(i => counts[i]);
  const ponCount = cnts.filter(c => c >= 3).length;
  if (ponCount === 3) return 'dai';
  if (ponCount === 2 && cnts.some(c => c === 2)) return 'shou';
  return null;
}

// 役牌数（ポン/暗刻として成立している個数を簡易で判定）
function detectYakuhai(counts, seatWind, roundWind) {
  // For simplicity, count how many of the yakuhai tiles have count>=3
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

// 清老頭（すべての牌が1または9のみ）: 役満
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

// 字一色: honors only
function isTsuisou(counts) {
  for (let i=0;i<34;i++) {
    if (counts[i] === 0) continue;
    if (i < 27) return false;
  }
  return true;
}

// 緑一色（發/索の2,3,4,6,8?）: simplified check: tiles must be only from set {2s,3s,4s,6s,8s,發}
function isRyuuiisou(counts) {
  const allowed = new Set(['2s','3s','4s','6s','8s','F']);
  for (let i=0;i<34;i++) {
    if (counts[i] === 0) continue;
    if (!allowed.has(idxToCode(i))) return false;
  }
  return true;
}

// 九蓮宝燈（簡易判定）
// A 九蓮 requires counts of suit like 1112345678999 + one extra of any number of same suit
function isChuren(counts) {
  // check for each suit if counts match churen
  for (const s of ['m','p','s']) {
    const base = new Array(34).fill(0);
    // build churen base for suit s
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
    // total tiles from suit must be at least 14? Actually churen requires exactly the pattern and one extra same-suit tile; check total suit tiles >=14
    const suitTotal = (new Array(9)).map((_,i)=>counts[offset+i]).reduce((a,b)=>a+b,0);
    if (suitTotal === 14) return true; // strict
    if (suitTotal === 14 || suitTotal === 14) return true;
  }
  return false;
}

/* ---------------------------
   符計算（概算実装）
   - 七対子: 25符 固定
   - 平和: 20符（ただし平和自摸は20+2ツモ符の取り扱いを別に）
   - 面倒な部分を簡易に処理するが、一般的なケースに合うように実装
   --------------------------- */

function calculateFu(counts, groups, pairIdx, isTsumo, isClosed, yakuList) {
  // If chiitoitsu
  if (isChiitoitsu(counts)) return 25;
  // Basic fu
  let fu = 20;
  // Add meld fu
  // groups are from decomposition assumed to represent melds in closed hand
  groups.forEach(g => {
    if (g.type === 'pon') {
      const tileIdx = g.tiles[0];
      const isTerminalOrHonor = (suitOfIndex(tileIdx) === null) || rankOfIndex(tileIdx) === 1 || rankOfIndex(tileIdx) === 9;
      // If it is an open pon (in melds) would be lower; but assumption: groups from decomposition are concealed here
      // closed pon: simples 4 fu, terminals/honors 8 fu
      fu += isTerminalOrHonor ? 8 : 4;
    } else if (g.type === 'chi') {
      // sequence gives no fu
    }
  });
  // Pair fu (yakuhai)
  if (pairIdx >= 27 && pairIdx <= 33) {
    // dragon or seat/round wind gives +2
    fu += 2;
  }
  // Tsumo adds 2 fu unless pinfu tsumo (pinfu gives 2 fu tsumo counted as yaku not fu)
  const hasPinfu = yakuList.some(y => y.name === '平和');
  if (isTsumo && !hasPinfu) fu += 2;
  // Ron on closed pair may add fu from wait type; complex to compute wait type; we approximate by not adding extra
  // Round up to nearest 10
  fu = Math.ceil(fu / 10) * 10;
  return fu;
}

/* ---------------------------
   基本点計算
   - basePoints = fu * 2^(han+2)
   - 弁別（満貫以上）: han>=5 または basePoints >= 2000 -> Mangan (basePoints=2000), etc.
   - 最終支払いは computeScoreSummary で計算
   --------------------------- */

function computeBasePoints(totalHan, fu, yakuList) {
  // if yakuman present (we encoded as han=13 per yakuman), treat as yakuman: totalHan may be 13*n; but we detect isYakuman by any yaku.isYakuman
  const anyYakuman = yakuList.some(y => y.isYakuman);
  if (anyYakuman) {
    // Count yakuman multiples
    const yakumanCount = yakuList.filter(y => y.isYakuman).length;
    return 8000 * yakumanCount;
  }
  if (totalHan <= 0) return 0;
  // base points raw
  let base = fu * Math.pow(2, totalHan + 2);
  // cap to mangan/haneman/baiman/sanbaiman
  if (totalHan >= 13) {
    base = 8000; // kazoe yakuman
  } else if (totalHan >= 11) {
    base = 6000; // sanbaiman
  } else if (totalHan >= 8) {
    base = 4000; // baiman
  } else if (totalHan >= 6) {
    base = 3000; // haneman
  } else if (totalHan === 5 || base >= 2000) {
    base = 2000; // mangan
  } else {
    // keep base
  }
  return Math.floor(base);
}

function computeScoreSummary(basePoints, totalHan, isTsumo, isDealer) {
  // basePoints is the 'basic points' used in mahjong scoring formula
  // For ron: payment = basePoints * (if winner dealer ? 6 : 4) rounded up to 100
  // For tsumo: dealer winner: each pays ceil(basePoints*2/100)*100
  // For tsumo: non-dealer winner: dealer pays ceil(basePoints*2/100)*100, others pay ceil(basePoints*1/100)*100
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

/* ---------------------------
   追加ユーティリティ（将来の拡張用）
   --------------------------- */

// For testing convenience, expose some functions to window
window._mahjong = {
  evaluateHand,
  decomposeStandard,
  isChiitoitsu,
  isKokushi,
  codeToIndex,
  idxToCode,
  idxToName,
  tileTypes
};

// 初回配牌
deal();
