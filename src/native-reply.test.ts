import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nativeReply, type ReplyTarget } from './native-reply'
import { readItemReplyTarget, readReplyTarget } from './conversation'
import type { Cli } from './sources'
import type { Row } from './model'

const app = 'com.stablyai.orca'
const at = new Date('2026-11-27T07:40:31+09:00').getTime()
const target: ReplyTarget = {
  bot:'見本Bot', number:8, title:'青の確認', at,
  question:{prompt:'図形はどちらですか?', choices:[{label:'丸'}, {label:'四角'}]}
}
const placeholder = 'Reply in your own words, or pick an option'
const stamp = new Intl.DateTimeFormat('ja-JP', {dateStyle:'full', timeStyle:'long'}).format(at)

function fixture({wrongCard = false, picked = false, draft = false, ambiguous = false, stale = false, plain = false, anonymousHome = false, status = 'Needs you', readOnly = false, otherBot = false, wrongHome = false, openFailed = false, missingFocus = false, collapsedGroup = false, freeText = false, alreadyBound = false, changedIndex = false, actionSnapshots = false, footerLocale = '', falseFooter = false, windows = [{id:1,isOffscreen:false,isMinimized:false}]} = {}) {
  const presses: string[] = []
  let page = 0
  let groupExpanded = !collapsedGroup
  let onTarget = !otherBot
  let opens = 0
  let expired = false
  let snapshots = 0
  const openHome = async () => {
    opens++
    if (!wrongHome && !openFailed) onTarget = true
    return !openFailed
  }
  let reads = 0
  const tree = (...lines: string[]) => lines.map(line => {
    const match = /^( +)(.*)$/.exec(line)!
    return '\t'.repeat(match[1].length) + match[2]
  }).join('\n')
  const run: Cli = async (_, method, ...args) => {
    if (method === 'permissions') return {platform:'darwin', permissions:[{id:'accessibility',status:'granted'}]}
    if (method === 'list-windows') return {windows:windows.map(window => ({...window, app:{bundleId:app}}))}
    if (method === 'perform-secondary-action') {
      const index = args[args.indexOf('--element-index') + 1]
      assert.equal(args[args.indexOf('--action') + 1], 'AXPress')
      assert.equal(args.includes('--restore-window'), false)
      presses.push(index)
      if (changedIndex && index === '7') {
        expired = true
        throw new Error('element_not_found')
      }
      if (index === '57') groupExpanded = true
      else page++
      const action = {path:'accessibility', delivery:'background', targetWindowId:1}
      if (!actionSnapshots) return {action}
      assert.equal(args.includes('--full-tree'), true)
      const data = await run(_, 'action-snapshot')
      return {action,...data}
    }
    if (method !== 'action-snapshot') snapshots++
    const bound = alreadyBound || page === 3
    const empty = freeText && bound ? 'Reply to 見本Bot…' : placeholder
    const bot = onTarget ? '見本Bot' : 'Other Bot'
    return {snapshot:{
      app:{bundleId:app}, window:{id:1,isOffscreen:false,isMinimized:false},
      truncation:{truncated:false}, disabledElementIndexes:[51], focusedElementId:page === 3 && !missingFocus ? 50 : null,
      treeText:tree(
        ...(footerLocale ? [
          ' 60 container',
          '  61 text entry area (settable) Ask anything, @ to mention bots or files, / for commands',
          '  62 button ' + (footerLocale === 'ja' ? bot + ' をコピー' : 'Copy ' + bot),
          ...(falseFooter ? [' 63 container','  64 button Copy 見本Bot'] : [])
        ] : [" 1 button Open " + bot + "'s page"]),
        ' 2 container',
        '  3 button ホーム, 要対応 2 件',
        '  4 button セッションボード',
        ...(page === 0 ? [] : page === 1 ? [
          '  5 container',
          '   53 text 見本Bot',
          '   54 pop up button Edit bot picture',
          ...(collapsedGroup ? [
            '   58 container',
            '    57 button ' + (groupExpanded ? '(expanded)' : status + ' 2'),
            '    59 heading ' + status
          ] : []),
          ...(groupExpanded ? [
            '   55 content list ' + (['Done','Canceled'].includes(status) ? 'Closed' : status),
            '    6 button #9 青の確認 now',
            '    ' + (expired ? '70' : '7') + ' button #8 青の確認 now'
          ] : [])
        ] : [
          '  8 container' + (anonymousHome ? '' : ' ホーム'),
          '   56 button ホーム',
          '   9 container',
          '    10 container',
          '     11 container',
          '      12 heading #8 青の確認',
          '      13 pop up button ' + status,
          '     14 container',
          '      15 heading Activity',
          '      16 container',
          '       17 container 見本Bot, ' + (wrongCard ? '異なる時刻' : stamp),
          '        18 text Needs you',
          '        19 text 向きはどちらですか?',
          '        20 toggle button 縦, Value: 0',
          '        21 button Type your answer',
          '        22 text 図形はどちらですか?',
          ...(freeText ? [] : [
            '        23 ' + (plain ? 'button 丸' : 'toggle button 丸, Value: ' + (picked ? 1 : 0)),
            '        24 ' + (plain ? 'button 四角' : 'toggle button 四角, Value: 0')
          ]),
          ...(alreadyBound ? [] : ['        25 button Type your answer']),
          ...(ambiguous ? ['       26 container 見本Bot, ' + stamp] : []),
          '    27 container',
          '     28 button Replying to: ' + (bound ? target.question.prompt : '向きはどちらですか?') + '. Show question',
          ...(readOnly ? [] : ['     50 text entry area (settable) コメント ' + (draft ? 'Value: 下書き' : empty)]),
          '      52 text ' + empty,
          '     51 button (disabled) コメント'
        ])
      )
    }}
  }
  return {presses, run, openHome, opens:() => opens, snapshots:() => snapshots, current:async () => ++reads < 2 || !stale}
}

test('uses a numbered item and binds only the second question, then confirms Replying to and focus', async () => {
  const {run, current, presses, openHome} = fixture()
  assert.equal(await nativeReply(run, target, current, new AbortController().signal, openHome), true)
  assert.deepEqual(presses, ['3', '7', '25'])
})

test('opens the exact Bot Home before replying, even with no Bot rows', async () => {
  for (const [reply, status, focus] of [
    [target, 'Needs you', '25'],
    [{bot:target.bot, number:target.number, title:target.title, state:'done', snoozed:false}, 'Done', '50']
  ] as const) {
    const {run, current, presses, openHome, opens} = fixture({otherBot:true, status})
    assert.equal(await nativeReply(run, reply, current, new AbortController().signal, openHome), true)
    assert.equal(opens(), 1)
    assert.deepEqual(presses, ['3', '7', focus])
  }
})

test('reads the active Bot from the native composer footer and ignores a matching button elsewhere', async () => {
  for (const footerLocale of ['ja','en']) {
    const {run,current,openHome,presses,opens} = fixture({footerLocale,otherBot:true,falseFooter:true})
    assert.equal(await nativeReply(run,target,current,new AbortController().signal,openHome),true)
    assert.equal(opens(),1)
    assert.deepEqual(presses,['3','7','25'])
  }
})

test('expands a collapsed Planned group whose button announces the item count', async () => {
  const {run, current, presses, openHome} = fixture({otherBot:true, status:'Planned', collapsedGroup:true})
  const {bot,number,title} = target
  assert.equal(await nativeReply(run, {bot,number,title,state:'planned',snoozed:false}, current, new AbortController().signal, openHome), true)
  assert.deepEqual(presses, ['3', '57', '7', '50'])
})

test('does not touch the other Bot when its Home cannot be replaced and verified', async () => {
  for (const state of [{wrongHome:true}, {openFailed:true}]) {
    const {run, current, presses, openHome, opens} = fixture({otherBot:true, ...state})
    assert.equal(await nativeReply(run, target, current, new AbortController().signal, openHome), 'bot-home-unavailable')
    assert.equal(opens(), 1)
    assert.deepEqual(presses, [])
  }
})

test('matches an unlabeled native Home detail using its toolbar and back button', async () => {
  const {run, current, presses, openHome} = fixture({anonymousHome:true})
  assert.equal(await nativeReply(run, target, current, new AbortController().signal, openHome), true)
  assert.deepEqual(presses, ['3', '7', '25'])
})

test('never presses immediate reply buttons on a single-question card', async () => {
  const {run, current, presses, openHome} = fixture({plain:true})
  assert.equal(await nativeReply(run, target, current, new AbortController().signal, openHome), true)
  assert.deepEqual(presses, ['3', '7', '25'])
})

test('refuses replaced, ambiguous, held, drafted and mismatched native reply targets', async () => {
  for (const failure of [{wrongCard:true}, {picked:true}, {draft:true}, {ambiguous:true}, {stale:true}]) {
    const {run, current, presses, openHome} = fixture(failure)
    assert.equal(await nativeReply(run, target, current, new AbortController().signal, openHome),
      'stale' in failure ? false : 'question-unavailable')
    assert.deepEqual(presses, ['3', '7'])
  }
})

test('opens the normal composer without writing or binding a past question', async () => {
  for (const [state, status] of [['working','In progress'], ['done','Done'], ['cancelled','Canceled']] as const) {
    const {run, current, presses, openHome} = fixture({status,draft:true})
    const {bot,number,title} = target
    assert.equal(await nativeReply(run, {bot,number,title,state,snoozed:false}, current, new AbortController().signal, openHome), true)
    assert.deepEqual(presses, ['3', '7', '50'])
  }
})

test('reports a verified native item without an editable composer', async () => {
  const {run, current, presses, openHome} = fixture({status:'Done',readOnly:true})
  const {bot,number,title} = target
  assert.equal(await nativeReply(run, {bot,number,title,state:'done',snoozed:false}, current, new AbortController().signal, openHome), 'read-only')
  assert.deepEqual(presses, ['3', '7'])
})

test('does not report success if AXPress does not focus the normal reply composer', async () => {
  const {run, current, presses, openHome} = fixture({status:'Done', missingFocus:true})
  const {bot,number,title} = target
  assert.equal(await nativeReply(run, {bot,number,title,state:'done',snoozed:false}, current, new AbortController().signal, openHome), 'composer-unavailable')
  assert.deepEqual(presses, ['3', '7', '50'])
})

test('checks focus for the free-text composer before success, including an already selected question', async () => {
  const freeTarget = {...target,question:{...target.question,choices:[]}}
  for (const [alreadyBound, missingFocus, result, lastPress] of [
    [false,false,true,'25'], [true,false,true,'50'], [true,true,'composer-unavailable','50']
  ] as const) {
    const {run,current,openHome,presses} = fixture({freeText:true,alreadyBound,missingFocus})
    assert.equal(await nativeReply(run,freeTarget,current,new AbortController().signal,openHome),result)
    assert.deepEqual(presses,['3','7',lastPress])
  }
})

test('accepts a single visible window, and refuses to choose between two visible windows', async () => {
  const main = {id:1,isOffscreen:false,isMinimized:false}
  for (const hidden of [true,false]) {
    const {run,current,openHome,presses} = fixture({windows:[main,{...main,id:2,isOffscreen:hidden}]})
    assert.equal(await nativeReply(run,target,current,new AbortController().signal,openHome),hidden ? true : 'window-unavailable')
    assert.deepEqual(presses,hidden ? ['3','7','25'] : [])
  }
})

test('locates the same Item on a fresh AX snapshot after its index expires', async () => {
  const {run,current,openHome,presses} = fixture({changedIndex:true})
  assert.equal(await nativeReply(run,target,current,new AbortController().signal,openHome),true)
  assert.deepEqual(presses,['3','7','70','25'])
})

test('verifies navigation using the full AX snapshot returned with each action', async () => {
  const {run,current,openHome,presses,snapshots} = fixture({actionSnapshots:true})
  assert.equal(await nativeReply(run,target,current,new AbortController().signal,openHome),true)
  assert.deepEqual(presses,['3','7','25'])
  assert.equal(snapshots(),1)
})

test('revalidates the Bot Item identity, unanswered event and exact decision index from the CLI', async () => {
  const row = {ref:'blue',bot:'bot',source:'Bot Item'} as Row
  const eventId = 'e12'
  const other = {question:'向きはどちらですか?', replies:[{label:'縦'}]}
  const decisions = [other, {question:target.question.prompt, replies:target.question.choices}]
  const item = {
    uid:'blue', number:8, title:target.title, owner:{botId:'bot',name:target.bot}, status:'needs_you',
    question:{eventId, decisions}
  }
  const event = {
    id:eventId, kind:'commented', at, actor:{kind:'bot',botId:'bot'},
    data:{ask:{questions:decisions.map(decision => ({prompt:decision.question,options:decision.replies}))}}
  }
  const run: Cli = async (...args) => {
    assert.deepEqual(args, ['bot','item','show','blue','--after','e11'])
    return {item, events:[event]}
  }
  assert.deepEqual(await readReplyTarget(run,row,eventId,1), target)
  const needsYou = {...row,state:'input',questionId:eventId} as Row
  const read = async () => ({item, events:[event]})
  assert.equal(await readItemReplyTarget(read,needsYou), 'choose')
  assert.deepEqual(await readItemReplyTarget(read,needsYou,eventId,1), target)
  assert.equal(await readItemReplyTarget(read,{...needsYou,questionId:'e11'}), 'changed')
  const singleItem = {...item,question:{eventId,decisions:decisions.slice(1)}}
  const singleEvent = {...event,data:{ask:{questions:event.data.ask.questions.slice(1)}}}
  assert.deepEqual(await readItemReplyTarget(async () => ({item:singleItem,events:[singleEvent]}),needsYou), target)

  assert.equal(await readReplyTarget(run,row,eventId,2), undefined)
  assert.equal(await readReplyTarget(async () => ({item:{...item,status:'done'},events:[event]}),row,eventId,1), undefined)
  assert.equal(await readReplyTarget(async () => ({item:{...item,question:{...item.question,eventId:'e13'}},events:[event]}),row,eventId,1), undefined)
  assert.equal(await readReplyTarget(async () => ({item,events:[event,{data:{answers:eventId}}]}),row,eventId,1), undefined)
  await assert.rejects(readReplyTarget(async () => ({item:{...item,uid:'green'},events:[event]}),row,eventId,1), /source_mismatch/)
})
