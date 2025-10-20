// 麻雀プロトタイプ：正確な和了判定（判定ロジック強化）と符計算改善、捨て牌をさらに小さく
// - evaluateHand に待ち判定（単騎/嵌張/辺張/両面）を組み込み、符に反映
// - 副露がある場合に開放扱いを考慮（state.melds）
// - UI: evaluate-hand ボタンで和了牌入力を促して待ち判定に使用
// - 捨て牌のサイズをさらに縮小（CSS側）
// ※ 依然として複雑な例外（多重役満の詳細ルールなど）は近似実装です。今後さらに厳密化可能。

/* ---------------------------
   牌定義
   --------------------------- */
const tileTypes = (() => {
  const suits = ['m','p','s'];
  const types = [];
  for (const s of suits) {
    for (let r=1; r<=9; r++) types.push({code: `${r}${s}`, name: `${r}${s}`});
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
tileTypes.forEach((t,i) => codeToIndex[t.code] = i);
function idxToCode(i) { return tileTypes[i].code; }
function idxToName(i) { return tileTypes[i].name; }

/* ---------------------------
   ゲーム状態
   --------------------------- */
const state = {
  wall: [],
  discards: [[],[],[],[]], // 0:南,1:西,2:北,3:東
  players: [[],[],[],[]],
  melds: [[],[],[],[]], // each meld: {type:'pon'|'chi'|'kan', tiles:['5p','5p','5p'], open:true/false}
  currentPlayer: 0,
};

/* ---------------------------
   山生成・配牌
   --------------------------- */
function buildWall() {
  const wall = [];
  tileTypes.forEach((t, idx) => {
    for (let c=0;c<4;c++) {
      wall.push({ id: `${t.code}-${c}-${Math.random().toString(36).slice(2,8)}`, code: t.code, name: t.name });
    }
  });
  return wall;
}
function shuffle(array) {
  for (let i=array.length-1;i>0;i--) {
    const j = Math.floor(Math.random()*(i+1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
function deal() {
  state.players = [[],[],[],[]];
  state.discards = [[],[],[],[]];
  state.melds = [[],[],[],[]];
  state.wall = buildWall(); shuffle(state.wall);
  for (let r=0;r<13;r++) for (let p=0;p<4;p++) state.players[p].push(state.wall.pop());
  state.players[0].push(state.wall.pop()); // South starts with 14
  state.currentPlayer = 0;
  renderAll();
}

/* ---------------------------
   SVG牌描画
   --------------------------- */
const tileTemplate = document.getElementById('tile-template');
function createTileElement(tile, opts={small:false}) {
  const tpl = tileTemplate.content.cloneNode(true);
  const tileEl = tpl.querySelector('.tile');
  const g = tileEl.querySelector('.tile-content');
  const code = tile.code;
  while (g.firstChild) g.removeChild(g.firstChild);

  if (code.match(/^[1-9][mps]$/)) {
    const num = code[0], suit = code[1];
    const suitText = document.createElementNS("http://www.w3.org/2000/svg","text");
    suitText.setAttribute("x","6"); suitText.setAttribute("y","16");
    suitText.setAttribute("font-size","9"); suitText.setAttribute("fill","#666");
    suitText.textContent = suit === 'm' ? '萬' : suit === 'p' ? '筒' : '索';
    g.appendChild(suitText);

    const numText = document.createElementNS("http://www.w3.org/2000/svg","text");
    numText.setAttribute("x","50"); numText.setAttribute("y", opts.small ? "74" : "82");
    numText.setAttribute("text-anchor","middle");
    numText.setAttribute("font-size", opts.small ? "44" : "54");
    numText.setAttribute("fill", num==='5' ? '#ef4444' : '#111');
    numText.setAttribute("font-weight","700");
    numText.textContent = num;
    g.appendChild(numText);
  } else {
    const kanji = (code === 'E' ? '東' : code === 'S' ? '南' : code === 'W' ? '西' : code === 'N' ? '北' : code === 'P' ? '白' : code === 'F' ? '發' : '中');
    const kText = document.createElementNS("http://www.w3.org/2000/svg","text");
    kText.setAttribute("x","50"); kText.setAttribute("y", opts.small ? "74" : "82");
    kText.setAttribute("text-anchor","middle");
    kText.setAttribute("font-size", opts.small ? "44" : "54");
    kText.setAttribute("fill", (code==='P'?'#111': code==='F'?'#0b7a3e': code==='C'?'#c91919':'#111'));
    kText.setAttribute("font-weight","800");
    kText.textContent = kanji;
    g.appendChild(kText);
  }

  tileEl._tile = tile;
  return tileEl;
}

/* ---------------------------
   レンダリング：各プレイヤーの捨て牌（右へ増える）/自分手牌横並び
   --------------------------- */
function renderAll() {
  document.getElementById('wall-count').textContent = state.wall.length;
  document.querySelector('#player-north .count').textContent = state.players[2].length;
  document.querySelector('#player-east .count').textContent = state.players[3].length;
  document.querySelector('#player-west .count').textContent = state.players[1].length;

  const mapping = {0:'discard-pile-south',1:'discard-pile-west',2:'discard-pile-north',3:'discard-pile-east'};
  for (let p=0;p<4;p++) {
    const pileDiv = document.getElementById(mapping[p]);
    pileDiv.innerHTML = '';
    state.discards[p].forEach(t => {
      const el = createTileElement(t, {small:true});
      pileDiv.appendChild(el); // append => right side growth
    });
  }

  const myDiv = document.getElementById('player-south');
  myDiv.innerHTML = '';
  state.players[0].forEach((t, idx) => {
    const el = createTileElement(t, {small:false});
    el.title = `index:${idx}`;
    el.addEventListener('click', () => discardTile(0, idx));
    myDiv.appendChild(el);
  });

  const meldsDiv = document.getElementById('melds');
  const m = state.melds[0];
  meldsDiv.textContent = '副露: ' + (m.length ? m.map(mm=> (mm.type + ':' + mm.tiles.join(','))).join(' | ') : 'なし');
}

/* ---------------------------
   ツモ・捨て（簡易AI）／捨ては該当プレイヤーの配列へ追加
   --------------------------- */
function drawTileForCurrent() {
  if (state.wall.length === 0) { alert('山がなくなりました（流局）'); return; }
  const tile = state.wall.pop();
  state.players[state.currentPlayer].push(tile);
  renderAll();

  if (state.currentPlayer !== 0) {
    setTimeout(()=> {
      const p = state.currentPlayer;
      discardTile(p, state.players[p].length - 1);
    }, 300);
  }
}
function discardTile(playerIndex, handIndex) {
  const tile = state.players[playerIndex].splice(handIndex,1)[0];
  state.discards[playerIndex].push(tile);
  renderAll();

  state.currentPlayer = (state.currentPlayer + 1) % 4;
  if (state.currentPlayer !== 0) setTimeout(()=> drawTileForCurrent(), 300);
}

/* ---------------------------
   UIイベント: evaluate-hand は和了牌の入力を促す（より正確な待ち判定のため）
   --------------------------- */
document.getElementById('draw-button').addEventListener('click', () => {
  if (state.currentPlayer !== 0) { alert('まだあなたの番ではありません。'); return; }
  drawTileForCurrent();
});
document.getElementById('new-game').addEventListener('click', () => deal());

document.getElementById('evaluate-hand').addEventListener('click', () => {
  const winMethod = document.getElementById('win-method').value; // ron/tsumo
  const roundWind = document.getElementById('round-wind').value;
  const seatWind = document.getElementById('seat-wind').value;
  const doraInput = prompt('ドラ表示牌コードをカンマ区切りで入力してください（例: 1m,5p,中）。空なら無し。', '');
  const doraIndicators = (doraInput || '').split(',').map(s=>s.trim()).filter(Boolean);
  const winTileInput = prompt('和了牌を入力してください（例: 5p）。分からない/未指定の場合は空のままEnter。', '');
  const winTile = (winTileInput||'').trim() || null;
  const playerTiles = state.players[0].map(t => t.code);
  const result = evaluateHand(playerTiles, state.melds[0], winMethod === 'tsumo', winTile, seatWind, roundWind, doraIndicators, false);
  renderResult(result);
});

/* ---------------------------
   結果表示
   --------------------------- */
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
   和了判定・役判定・符計算ライブラリ（強化版）
   - evaluateHand(tilesArray, melds, isTsumo, winTile, seatWind, roundWind, doraIndicators, riichi)
   - 待ち判定（winTileが指定されている場合）で単騎・嵌張・辺張を判定し符に反映（ロン時）
   --------------------------- */

function evaluateHand(tilesArray, melds = [], isTsumo=false, winTile=null, seatWind='S', roundWind='E', doraIndicators = [], riichiDeclared=false) {
  if (!Array.isArray(tilesArray)) return null;
  if (tilesArray.length !== 14) {
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '手牌は14枚ではありません'} };
  }

  // counts
  const counts = new Array(34).fill(0);
  tilesArray.forEach(c => {
    const idx = codeToIndex[c];
    if (idx === undefined) throw new Error('unknown tile code: ' + c);
    counts[idx]++;
  });

  const doraCount = countDora(tilesArray, doraIndicators);
  const yakusFound = [];

  const isClosed = !(melds && melds.length > 0);

  // 特殊和了: 国士、七対子
  if (isKokushi(counts)) yakusFound.push({name:'国士無双', han:13, isYakuman:true});
  if (isChiitoitsu(counts)) yakusFound.push({name:'七対子', han:2, isYakuman:false});

  // 通常形分解
  const decomps = decomposeStandard(counts);

  if (decomps.length === 0 && !isChiitoitsu(counts) && !isKokushi(counts)) {
    return { yaku: [], totalHan: 0, fu: 0, basePoints: 0, score: {summary: '和了形ではありません'} };
  }

  // 七対子/国士のみのケース
  if (decomps.length === 0) {
    const totalHan = yakusFound.reduce((s,y)=>s+y.han,0) + doraCount + (riichiDeclared ? 1 : 0);
    const fu = isChiitoitsu(counts) ? 25 : (yakusFound.some(y=>y.isYakuman) ? 0 : 20);
    const basePoints = computeBasePoints(totalHan, fu, yakusFound);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);
    return { yaku: yakusFound, totalHan, fu, basePoints, score };
  }

  // 複数の分解候補を評価し、最も高得点になるものを選ぶ
  const candidates = [];
  decomps.forEach(decomp => {
    const yakuList = [];
    const pairIdx = decomp.pair;
    const groups = decomp.groups; // [{type:'chi'|'pon', tiles:[idx,...]}]

    const isAllSequences = groups.every(g => g.type === 'chi');
    const isAllTriplets = groups.every(g => g.type === 'pon');

    // 役の判定（簡易だが多くの主要役を判定）
    if (isClosed && riichiDeclared) yakuList.push({name:'立直', han:1, isYakuman:false});

    const pairIsYakuhai = isYakuhaiPair(pairIdx, seatWind, roundWind);
    if (isClosed && isAllSequences && !pairIsYakuhai) {
      // 平和は両面待ちである必要がある。winTileが与えられている場合両面判定を行う。
      let isRyanmen = false;
      if (winTile) {
        isRyanmen = isPairRyanmenWait(counts, pairIdx, groups, tilesArray, winTile);
      }
      if (isRyanmen || isTsumo) yakuList.push({name:'平和', han:1, isYakuman:false});
    }

    if (isClosed && isTsumo) yakuList.push({name:'門前清自摸', han:1, isYakuman:false});
    if (isTanyao(tilesArray, melds)) yakuList.push({name:'断幺九', han:1, isYakuman:false});

    if (isClosed) {
      // 一盃口/二盃口
      const seqs = groups.filter(g=>g.type==='chi').map(g=>seqSignature(g.tiles));
      const countsSeq = {};
      seqs.forEach(s=>countsSeq[s] = (countsSeq[s]||0)+1);
      if (Object.values(countsSeq).some(v=>v>=2)) yakuList.push({name:'一盃口', han:1, isYakuman:false});
      const dups = Object.values(countsSeq).filter(v=>v>=2).length;
      if (dups >= 2) yakuList.push({name:'二盃口', han:2, isYakuman:false});
    }

    if (detectSanshoku(groups)) yakuList.push({name:'三色同順', han:1, isYakuman:false});
    if (detectIttsuu(groups)) yakuList.push({name:'一気通貫', han:1, isYakuman:false});

    const flush = detectFlush(tilesArray);
    if (flush.type === 'chinitsu') yakuList.push({name:'清一色', han:6, isYakuman:false});
    else if (flush.type === 'honitsu') yakuList.push({name:'混一色', han:3, isYakuman:false});

    if (isAllTriplets) yakuList.push({name:'対々和', han:2, isYakuman:false});
    if (detectSanankou(groups, melds, tilesArray)) yakuList.push({name:'三暗刻', han:2, isYakuman:false});

    const countsNow = new Array(34).fill(0);
    tilesArray.forEach(c=>countsNow[codeToIndex[c]]++);
    const dragonYakuReal = detectSanGen(countsNow);
    if (dragonYakuReal === 'dai') yakuList.push({name:'大三元', han:13, isYakuman:true});
    else if (dragonYakuReal === 'shou') yakuList.push({name:'小三元', han:2, isYakuman:false});

    const yakuhaiCount = detectYakuhai(countsNow, seatWind, roundWind);
    if (yakuhaiCount > 0) for (let i=0;i<yakuhaiCount;i++) yakuList.push({name:'役牌', han:1, isYakuman:false});

    if (isChinroutou(countsNow)) yakuList.push({name:'清老頭', han:13, isYakuman:true});
    if (isTsuisou(countsNow)) yakuList.push({name:'字一色', han:13, isYakuman:true});
    if (isRyuuiisou(countsNow)) yakuList.push({name:'緑一色', han:13, isYakuman:true});
    if (isChuren(countsNow)) yakuList.push({name:'九蓮宝燈', han:13, isYakuman:true});

    // ドラ
    if (doraCount > 0) for (let i=0;i<doraCount;i++) yakuList.push({name:'ドラ', han:1, isYakuman:false});
    // 立直（再確認）
    if (riichiDeclared && isClosed) yakuList.push({name:'立直', han:1, isYakuman:false});

    // 符計算（強化）
    // 待ち判定: winTile が指定されていてロン（isTsumo===false）の場合に単騎/嵌張/辺張を足す
    let waitType = 'unknown';
    if (winTile && !isTsumo) {
      waitType = detectWaitTypeForDecomp(tilesArray, decomp, winTile);
    }

    const fu = calculateFuEnhanced(countsNow, groups, decomp.pair, isTsumo, isClosed, yakuList, waitType, melds);

    // 翻数合計（役満は特別扱い）
    const yakumanCount = yakuList.filter(y=>y.isYakuman).length;
    let totalHan = yakumanCount > 0 ? yakumanCount * 13 : yakuList.filter(y=>!y.isYakuman).reduce((s,y)=>s+y.han,0);

    const basePoints = computeBasePoints(totalHan, fu, yakuList);
    const score = computeScoreSummary(basePoints, totalHan, isTsumo, false);

    candidates.push({yakuList, totalHan, fu, basePoints, score});
  });

  // 最良候補を選ぶ（基本点で比較）
  candidates.sort((a,b) => {
    if (a.basePoints !== b.basePoints) return b.basePoints - a.basePoints;
    if (a.totalHan !== b.totalHan) return b.totalHan - a.totalHan;
    return b.fu - a.fu;
  });

  const best = candidates[0];
  return { yaku: best.yakuList, totalHan: best.totalHan, fu: best.fu, basePoints: best.basePoints, score: best.score };
}

/* ---------------------------
   待ち判定ヘルパー（decompに基づいて、和了牌がどの面子を完成させたか判定）
   - 戻り値: 'tanki'|'kanchan'|'penchan'|'ryanmen'|'shampon'|'pon'|'unknown'
   - アルゴリズム:
     1) winTile を1枚減らした 13枚手で decomposeStandard を試みる
     2) decomp (14枚) と 13枚側の分解を比較し、差分となる面子を特定
     3) その面子の種類と中の位置から待ち種別を判定する
   --------------------------- */

function detectWaitTypeForDecomp(tilesArray, decomp, winTileCode) {
  if (!winTileCode) return 'unknown';
  // Make a shallow copy and remove one occurrence of winTileCode
  const clone = tilesArray.slice();
  const wi = clone.indexOf(winTileCode);
  if (wi === -1) return 'unknown';
  clone.splice(wi,1);
  // counts for 13 tiles
  const counts13 = new Array(34).fill(0);
  clone.forEach(c => counts13[codeToIndex[c]]++);

  // decompose 13-tile hand
  const dec13 = decomposeStandard(counts13);
  if (dec13.length === 0) {
    // If no decomposition for 13, we still can attempt to find the missing group by comparing with decomp
    // fallback: try to find which group in decomp contains the win tile
    return guessWaitFromGroup(decomp, winTileCode);
  }

  // For each decomposition of 13 tiles, see which group from decomp (14) is missing in 13 decomposition
  for (const d13 of dec13) {
    // compare groups arrays ignoring order
    const missingGroups = findMissingGroups(decomp.groups, d13.groups);
    const missingPair = (decomp.pair !== d13.pair);
    if (missingGroups.length > 0) {
      // pick the first missing group
      const mg = missingGroups[0];
      // determine wait type based on mg and winTileCode
      return waitTypeFromGroupAndWin(mg, winTileCode);
    } else if (missingPair) {
      // pair was completed by win tile => 単騎
      return 'tanki';
    }
  }
  // fallback:
  return guessWaitFromGroup(decomp, winTileCode);
}
function findMissingGroups(groups14, groups13) {
  // groups are arrays of {type, tiles}
  // We try to find groups in groups14 that are not present in groups13 (by comparing tiles sets)
  const used = new Array(groups13.length).fill(false);
  const missing = [];
  groups14.forEach(g14 => {
    let found = false;
    for (let i=0;i<groups13.length;i++) {
      if (used[i]) continue;
      if (groupsEqual(g14, groups13[i])) { used[i]=true; found=true; break; }
    }
    if (!found) missing.push(g14);
  });
  return missing;
}
function groupsEqual(a,b) {
  if (a.type !== b.type) return false;
  const ta = a.tiles.slice().sort((x,y)=>x-y);
  const tb = b.tiles.slice().sort((x,y)=>x-y);
  if (ta.length !== tb.length) return false;
  for (let i=0;i<ta.length;i++) if (ta[i] !== tb[i]) return false;
  return true;
}
function waitTypeFromGroupAndWin(group, winTileCode) {
  const winIdx = codeToIndex[winTileCode];
  if (!group) return 'unknown';
  if (group.type === 'pon') {
    // completing a pon is a 2-sided pon wait (shanpon) but does not give wait fu
    return 'pon';
  } else if (group.type === 'chi') {
    const tiles = group.tiles.slice().sort((a,b)=>a-b);
    const a = tiles[0], b = tiles[1], c = tiles[2];
    if (winIdx === b) return 'kanchan';
    // penchan: waiting for 3 to complete 1-2-3 (win is c with c's rank==3) OR waiting for 7 to complete 7-8-9 (win is a with a's rank==7)
    const rankA = rankOfIndex(a), rankB = rankOfIndex(b), rankC = rankOfIndex(c);
    if (winIdx === c && rankA === 1) return 'penchan'; // 1-2-3, win on 3
    if (winIdx === a && rankA === 7) return 'penchan'; // 7-8-9, win on 7
    // If win tile is one end but not penchan special-case, treat as ryanmen (open) by fallback
    // Actually proper ryanmen requires the two adjacent tiles be (x and x+1) with win at either x-1 or x+2 etc.
    return 'ryanmen';
  } else {
    return 'unknown';
  }
}
function guessWaitFromGroup(decomp, winTileCode) {
  // Fallback: find a group in decomp that contains the win tile and guess
  const winIdx = codeToIndex[winTileCode];
  for (const g of decomp.groups) {
    if (g.tiles.includes(winIdx)) return waitTypeFromGroupAndWin(g, winTileCode);
  }
  // if pair
  if (decomp.pair === winIdx) return 'tanki';
  return 'unknown';
}

/* ---------------------------
   改良版の符計算
   - ポン/カン（明暗で変化）
   - 頭（役牌）: +2
   - ツモ: +2（ピンフ自摸などは別考慮）
   - 待ち: 単騎/嵌張/辺張 -> +2（ロン時のみ）
   - 最後に10の位切り上げ。20符ロンの特殊処理: 30符にする（一般的処理）
   --------------------------- */

function calculateFuEnhanced(counts, groups, pairIdx, isTsumo, isClosed, yakuList, waitType, melds) {
  // 七対子は固定25
  if (isChiitoitsu(counts)) return 25;

  let fu = 20; // base

  // Melds: groups are from decomposition of closed hand; however some melds might be open if melds param indicates open melds.
  // We'll mark open melds by comparing tiles to state.melds entries if provided.
  const openMeldTilesSets = new Set();
  if (melds && melds.length > 0) {
    melds.forEach(m => {
      // store normalized string for set membership
      const key = m.tiles.slice().sort().join('|');
      openMeldTilesSets.add(key);
    });
  }

  groups.forEach(g => {
    if (g.type === 'pon') {
      const tIdx = g.tiles[0];
      const isTerminalOrHonor = (suitOfIndex(tIdx) === null) || rankOfIndex(tIdx) === 1 || rankOfIndex(tIdx) === 9;
      // Determine whether this pon is open or closed: if it matches any open melds -> exposed
      const key = g.tiles.slice().sort().map(i=>idxToCode(i)).join('|');
      const isOpen = openMeldTilesSets.has(key);
      if (isOpen) {
        fu += isTerminalOrHonor ? 4 : 2;
      } else {
        fu += isTerminalOrHonor ? 8 : 4;
      }
    } else if (g.type === 'chi') {
      // sequences give 0 fu
    }
  });

  // Pair (頭): if it's a yakuhai
  if (pairIdx >= 27 && pairIdx <= 33) {
    // pair is honor: dragons or seat/round wind
    fu += 2;
  } else {
    // Also if pair is seat wind or round wind: check via idx code
    // (Handled above because pairIdx 27-33 corresponds precisely to honors)
  }

  // Tsumo: +2 fu for tsumo (unless pinfu special-count? We add and later handle pinfu cases)
  const hasPinfu = yakuList.some(y => y.name === '平和');
  if (isTsumo) {
    // For pinfu tsumo, you still get the +2 tsumo fu (making total 22 -> round to 30)
    fu += 2;
  }

  // Wait-type fu: only applied on Ron (not tsumo) and only for tanki/kanchan/penchan -> +2
  if (!isTsumo && (waitType === 'tanki' || waitType === 'kanchan' || waitType === 'penchan')) {
    fu += 2;
  }

  // Edge-case: if fu computed is 20 and not tsumo -> in many rules, 20-fu ron becomes 30 (pinfu ron). We apply the conventional handling:
  fu = Math.ceil(fu / 10) * 10;
  if (!isTsumo && fu === 20) fu = 30;

  return fu;
}

/* ---------------------------
   補助：ドラカウント、国士/七対子判定、分解関数等（以前の実装をベースに） 
   --------------------------- */

function countDora(tilesArray, doraIndicators) {
  if (!doraIndicators || doraIndicators.length === 0) return 0;
  let count = 0;
  tilesArray.forEach(t => {
    for (const d of doraIndicators) if (t === d) count++;
  });
  return count;
}

function isKokushi(counts) {
  const terminals = [];
  terminals.push(0); terminals.push(8);
  terminals.push(9); terminals.push(17);
  terminals.push(18); terminals.push(26);
  for (let i=27;i<=33;i++) terminals.push(i);
  if (terminals.some(idx => counts[idx] === 0)) return false;
  if (!terminals.some(idx => counts[idx] >= 2)) return false;
  for (let i=0;i<34;i++) if (!terminals.includes(i) && counts[i] > 0) return false;
  return true;
}

function isChiitoitsu(counts) {
  let pairs = 0;
  for (let i=0;i<34;i++) {
    if (counts[i] === 1 || counts[i] === 3) return false;
    if (counts[i] === 2) pairs++;
    if (counts[i] === 4) return false;
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
  if (i === -1) return true;
  if (counts[i] >= 3) {
    counts[i] -= 3;
    groups.push({type:'pon', tiles:[i,i,i]});
    if (removeAllMelds(counts, groups)) return true;
    groups.pop(); counts[i] += 3;
  }
  const suit = suitOfIndex(i);
  const rank = rankOfIndex(i);
  if (suit !== null && rank <= 7) {
    const i1 = i, i2 = i+1, i3 = i+2;
    if (counts[i1]>0 && counts[i2]>0 && counts[i3]>0) {
      counts[i1]--; counts[i2]--; counts[i3]--;
      groups.push({type:'chi', tiles:[i1,i2,i3]});
      if (removeAllMelds(counts, groups)) return true;
      groups.pop(); counts[i1]++; counts[i2]++; counts[i3]++;
    }
  }
  return false;
}

function suitOfIndex(i) {
  if (i>=0 && i<=8) return 'm';
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
    if (t.match(/^[19][mps]$/)) return false;
    if (t.length === 1 && 'ESWNPFC'.includes(t)) return false;
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
  const seqs = groups.filter(g=>g.type==='chi').map(g=>({s: suitOfIndex(g.tiles[0]), r: rankOfIndex(g.tiles[0])}));
  const map = {};
  seqs.forEach(s => { const key = s.r; if (!map[key]) map[key] = new Set(); map[key].add(s.s); });
  for (const k in map) if (map[k].size === 3) return true;
  return false;
}

function detectIttsuu(groups) {
  const map = {m:new Set(), p:new Set(), s:new Set()};
  groups.filter(g=>g.type==='chi').forEach(g=>{ const s = suitOfIndex(g.tiles[0]); const r = rankOfIndex(g.tiles[0]); map[s].add(r); });
  for (const s of ['m','p','s']) if (map[s].has(1) && map[s].has(4) && map[s].has(7)) return true;
  return false;
}

function detectFlush(tilesArray) {
  const suitsPresent = new Set(); let honorsPresent = false;
  tilesArray.forEach(c => { if (c.length === 1) honorsPresent = true; else suitsPresent.add(c[1]); });
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
  const dragonsIdx = [31,32,33]; // P,F,C
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
    needed[0]=3; needed[8]=3;
    for (let i=1;i<=7;i++) needed[i]=1;
    let ok=true;
    for (let i=0;i<9;i++) { const idx=offset+i; if (counts[idx] < needed[i]) { ok=false; break; } }
    if (!ok) continue;
    const suitTotal = Array.from({length:9},(_,i)=>counts[offset+i]).reduce((a,b)=>a+b,0);
    if (suitTotal === 14) return true;
  }
  return false;
}

/* ---------------------------
   点数計算（ベース）: basePoints の算出、支払いサマリ
   --------------------------- */
function computeBasePoints(totalHan, fu, yakuList) {
  const anyYakuman = yakuList.some(y => y.isYakuman);
  if (anyYakuman) {
    const yakumanCount = yakuList.filter(y => y.isYakuman).length;
    return 8000 * yakumanCount;
  }
  if (totalHan <= 0) return 0;
  let base = fu * Math.pow(2, totalHan + 2);
  if (totalHan >= 13) base = 8000;
  else if (totalHan >= 11) base = 6000;
  else if (totalHan >= 8) base = 4000;
  else if (totalHan >= 6) base = 3000;
  else if (totalHan === 5 || base >= 2000) base = 2000;
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

/* ---------------------------
   ウィンドウエクスポート（デバッグ用）
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

/* 初回配牌 */
deal();
