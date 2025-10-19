// 簡易 役判定モジュール (yaku.js)
// ブラウザで直接利用できるように window.YakuEvaluator を公開します。
// 提供関数:
//   evaluateHand(tilesArray, options)
//     tilesArray: ['1m','3p','E',...] (14枚)
//     options: { seatWind: 0 } // 0: 東,1:南,2:西,3:北
//   戻り値: { agari: bool, yakus: [{name, han}], totalHan: number, details: {...} }

(function(global){
  const honors = ['E','S','W','N','P','F','C']; // 東 南 西 北 白 發 中

  function tileToIndex(t){
    const m = t.match(/^([1-9])([mps])$/);
    if(m){
      const num = parseInt(m[1],10);
      const suit = m[2];
      const suitBase = {'m':0,'p':9,'s':18}[suit];
      return suitBase + (num-1);
    }
    const idx = honors.indexOf(t);
    if(idx>=0) return 27 + idx;
    throw new Error('Unknown tile: ' + t);
  }

  function countTiles(tiles){
    const counts = new Array(34).fill(0);
    for(const t of tiles){
      counts[tileToIndex(t)]++;
    }
    return counts;
  }

  // 七対子判定
  function isChiitoitsu(counts){
    let pairs = 0; let total = 0;
    for(let i=0;i<34;i++){
      total += counts[i];
      if(counts[i] === 2) pairs++;
      else if(counts[i] !== 0) return false;
    }
    return total === 14 && pairs === 7;
  }

  // 再帰で面子に分解できるか判定、かつ sequence を使ったかを返す
  function canFormMelds(counts){
    let i = 0;
    for(; i<34; i++) if(counts[i]>0) break;
    if(i===34) return {ok:true, usedSequence:false};
    // triplet
    if(counts[i] >= 3){
      counts[i] -= 3;
      const res = canFormMelds(counts);
      counts[i] += 3;
      if(res.ok) return {ok:true, usedSequence: res.usedSequence};
    }
    // sequence
    if(i < 27){
      const posInSuit = i % 9;
      if(posInSuit <= 6){
        if(counts[i+1]>0 && counts[i+2]>0){
          counts[i]--; counts[i+1]--; counts[i+2]--;
          const res = canFormMelds(counts);
          counts[i]++; counts[i+1]++; counts[i+2]++;
          if(res.ok) return {ok:true, usedSequence: true};
        }
      }
    }
    return {ok:false, usedSequence:false};
  }

  // 通常和了判定：任意の対子を取って残りを 4 面子に分解できるか
  function isStandardAgari(counts){
    let total = counts.reduce((a,b)=>a+b,0);
    if(total !== 14) return {agari:false};
    for(let i=0;i<34;i++){
      if(counts[i] >= 2){
        counts[i] -= 2;
        const res = canFormMelds(counts);
        counts[i] += 2;
        if(res.ok){
          return {agari:true, usedSequence: res.usedSequence, pairIndex: i};
        }
      }
    }
    return {agari:false};
  }

  // タンヤオ判定（字牌・1/9 が含まれない）
  function isTanyao(counts){
    for(let i=0;i<34;i++){
      if(counts[i] === 0) continue;
      if(i>=27) return false;
      const pos = i % 9;
      if(pos === 0 || pos === 8) return false;
    }
    return true;
  }

  // 混一色判定（1つの suit + 字牌）
  function isHonitsu(counts){
    let suitPresent = [false,false,false];
    let honorsPresent = false;
    for(let i=0;i<34;i++){
      if(counts[i] === 0) continue;
      if(i>=27) honorsPresent = true;
      else suitPresent[Math.floor(i/9)] = true;
    }
    const suitsCount = suitPresent.filter(Boolean).length;
    return suitsCount === 1 && honorsPresent;
  }

  // 清一色判定（1つの suit のみ、字牌無し）
  function isChinitsu(counts){
    let suitPresent = [false,false,false];
    for(let i=0;i<34;i++){
      if(counts[i] === 0) continue;
      if(i>=27) return false;
      suitPresent[Math.floor(i/9)] = true;
    }
    return suitPresent.filter(Boolean).length === 1;
  }

  // 対々和判定（全て刻子）
  function isToitoi(usedSequenceFlag){
    return usedSequenceFlag === false;
  }

  // 役牌 (簡易: counts >= 3)
  function detectYakuhai(counts, seatWind){
    const yakus = [];
    const seatIdx = 27 + (seatWind || 0);
    if(counts[seatIdx] >= 3){
      yakus.push({name: '自風（役牌）', han: 1});
    }
    // dragons: P(白)=31, F(發)=32, C(中)=33
    const dragonIdx = [31,32,33];
    const dragonNames = {31:'P',32:'F',33:'C'};
    for(const di of dragonIdx){
      if(counts[di] >= 3){
        yakus.push({name: '役牌（' + dragonNames[di] + '）', han: 1});
      }
    }
    return yakus;
  }

  function evaluateHand(tiles, options){
    options = options || {};
    const seatWind = (typeof options.seatWind === 'number') ? options.seatWind : 0;
    if(!Array.isArray(tiles)) throw new Error('tiles must be array of strings');
    const counts = countTiles(tiles);
    const total = counts.reduce((a,b)=>a+b,0);
    if(total !== 14){
      return { agari:false, reason: '手牌枚数が14枚ではありません: ' + total, yakus:[], totalHan:0, details:{} };
    }

    const yakus = [];
    const details = {};

    // 七対子
    if(isChiitoitsu(counts)){
      details.isChiitoitsu = true;
      yakus.push({name:'七対子', han:2});
      const totalHan = yakus.reduce((s,y)=>s+y.han,0);
      return { agari:true, yakus, totalHan, details };
    }

    // 通常和了判定
    const countsCopy = counts.slice();
    const agariInfo = isStandardAgari(countsCopy);
    if(!agariInfo.agari){
      return { agari:false, reason:'和了形ではありません', yakus:[], totalHan:0, details:{} };
    }
    details.isChiitoitsu = false;
    details.usedSequence = agariInfo.usedSequence;

    // タンヤオ
    if(isTanyao(counts)) yakus.push({name:'タンヤオ', han:1});

    // 役牌
    const yakuhaiList = detectYakuhai(counts, seatWind);
    yakuhaiList.forEach(y=>yakus.push(y));

    // 対々和
    if(isToitoi(agariInfo.usedSequence)){
      yakus.push({name:'対々和', han:2});
    }

    // 混一色 / 清一色
    if(isChinitsu(counts)){
      yakus.push({name:'清一色', han:6});
    } else if(isHonitsu(counts)){
      yakus.push({name:'混一色', han:3});
    }

    const totalHan = yakus.reduce((s,y)=>s+y.han,0);

    return { agari:true, yakus, totalHan, details: { pairIndex: agariInfo.pairIndex, usedSequence: agariInfo.usedSequence } };
  }

  global.YakuEvaluator = {
    evaluateHand,
    tileToIndex,
    countTiles
  };
})(window);
