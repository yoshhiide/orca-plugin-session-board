import { display, language } from './language'
import { assert, mountWorker, test } from 'orca/testing'
import type { OrcaWorkerApi } from 'orca/worker'
import { collect, itemHistory, type Cli } from './sources'
import { createMonitor, openBoard, setupWorker } from './worker'
import { itemImage } from './item-images'
import { activityWindow, type Row, type State, type Transition } from './model'
import {mkdtemp, mkdir, rm, symlink, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

const fixedNow = () => 1000

const item: Row = {
  id:'item:bot:item-key', source:'Bot Item', title:'公開前の確認', origin:'サンプル Bot · #3',
  state:'working', ref:'item-key', at:100, cursor:'e1', workers:['ctx_sample']
}
const terminal: Row = {
  id:'terminal:["normal","pane"]', source:'Orca ターミナル', title:'通常の検証', origin:'サンプル',
  state:'working', ref:'orca_session_id:normal', at:100, pane:'pane', target:'term_sample'
}
const worker: Row = {
  id:'worker:bot:ctx_sample', source:'Bot ワーカー', title:'検証', origin:'サンプル Bot',
  state:'working', ref:'ctx_sample', at:100
}
const snapshot = (rows: Row[], ok = true) => ({
  complete:true, batches:[{ key:'agents', label:'テスト用', ok, rows, issue:ok ? undefined : '取得不可' }]
})
const noCli: Cli = async () => { throw new Error('unavailable') }

test('起動、再取得、消失と再登録をベースラインにする', async () => {
  const moves: Transition[] = []
  const monitor = createMonitor(noCli, async (_row, move) => { moves.push(move); return true }, fixedNow)
  await monitor.ingest(snapshot([item, worker, terminal]))
  assert.equal(monitor.board().rows.length, 2)
  await monitor.ingest(snapshot([{...item,state:'input'}, {...worker,state:'done'}, terminal]))
  assert.equal(moves.length, 1)
  await monitor.ingest(snapshot([], false))
  assert.equal(monitor.board().rows.every(row => row.stale), true)
  await monitor.ingest(snapshot([{...item,state:'done'}, terminal]))
  await monitor.ingest(snapshot([]))
  await monitor.ingest(snapshot([{...item,state:'failed'}]))
  assert.equal(moves.length, 1)
})

test('公式履歴から中間状態を通知し、繰り返し取得を無視する', async () => {
  const run: Cli = async (...args) => {
    assert.equal(args[4], '--after')
    assert.equal(args[5], 'e1')
    const event = { kind:'status', id:'e2', at:110, data:{from:'in_progress',to:'needs_you'} }
    return { item:{uid:'item-key',lastEventId:'e3'}, events:[
      event, event, {kind:'status', id:'e3', at:120, data:{from:'needs_you',to:'in_progress'}}
    ]}
  }
  const targets: State[] = []
  const monitor = createMonitor(run, async (_row, move) => { targets.push(move.to); return true }, fixedNow)
  await monitor.ingest(snapshot([item]))
  const next = snapshot([{...item,at:120,cursor:'e3'}])
  await monitor.ingest(next)
  await monitor.ingest(next)
  assert.deepEqual(targets, ['input','working'])
  await assert.rejects(() => itemHistory(async () => ({item:{uid:'other'},events:[]}),item), /source_mismatch/)
})

test('端末イベントは同じセッションだけを更新し、再生と古い取得を無視する', async () => {
  const states: State[] = []
  const monitor = createMonitor(noCli, async (_row, move) => { states.push(move.to); return true }, fixedNow)
  await monitor.ingest(snapshot([terminal]))
  const event = {workspaceId:null,paneKey:'pane',receivedAt:200,state:'done' as const,
    sessionId:'normal',mainAgent:{state:'done' as const,outcome:'failure' as const,stateStartedAt:195}}
  await monitor.event({...event,sessionId:'replaced'})
  await monitor.event(event)
  await monitor.event(event)
  await monitor.ingest(snapshot([terminal]))
  assert.deepEqual(states, ['failed'])
  assert.equal(monitor.board().rows[0].state, 'failed')
})

const longReason = '確認後に関係者へ案内します。'.repeat(24)
const mockCli = (change: { denyBot?: boolean; handle?: string; chatId?:string; incarnation?: string } = {}): Cli => async (...args) => {
  switch (args.slice(0, 3).join(' ')) {
    case 'bot list': return { bots:[{id:'sample-bot',name:'サンプル Bot'}],unreachable:[] }
    case 'bot item list': return { botId:'sample-bot',items:[{
      uid:'item-key',number:3,title:item.title,status:'needs_you',updatedAt:100,question:{gist:longReason},
      links:[{kind:'dispatch',ref:'ctx_sample'}],lastEventId:'e1'
    }] }
    case 'orchestration worker-list --full':
      return {workers:[{dispatchId:'ctx_sample',projection:{evidence:{lastObservedAt:100}}}]}
    case 'bot work list': return { items:[{dispatchId:'ctx_sample',state:'working'}],workspaces:[] }
    case 'bot chats --bot':
      if (change.denyBot) throw new Error('permission_denied')
      return {bot:'サンプル Bot',chats:[{id:change.chatId ?? 'bot-chat'}]}
    case 'orchestration worker-show --dispatch':
      return { dispatch:{id:'ctx_sample',assigneePaneKey:'worker-pane'},
        observation:{exactWorker:true,agentWait:null} }
    case 'agent list': return {agents:[
      {kind:'chat',hostId:'local',updatedAt:100,orcaSessionId:'orca_session_id:bot-chat',title:'Bot'},
      {kind:'chat',hostId:'local',updatedAt:100,orcaSessionId:'orca_session_id:other-chat',title:'通常'},
      {kind:'terminal',hostId:'local',updatedAt:100,orcaSessionId:'orca_session_id:worker',paneKey:'worker-pane'},
      {kind:'terminal',hostId:'local',updatedAt:100,orcaSessionId:'orca_session_id:normal',paneKey:'pane',worktreeId:'workspace',
        state:'working', title:terminal.title, workspace:terminal.origin}
    ]}
    case 'terminal list': return {terminals:[
      {handle:change.handle ?? 'term_sample',recordedPaneKey:'pane',executionHostId:'local',worktreeId:'workspace',
        connected:true,orphaned:false,incarnationId:change.incarnation ?? 'original'},
      {handle:'wrong',recordedPaneKey:'pane',executionHostId:'remote',worktreeId:'workspace',connected:true,orphaned:false},
      {handle:'standalone',recordedPaneKey:null,tabId:'qa-tab',leafId:'qa-leaf',executionHostId:'local',worktreeId:'workspace',
        connected:true,orphaned:false,lastOutputAt:100},
      {handle:'orphan',recordedPaneKey:'old',executionHostId:'local',worktreeId:'workspace',
        connected:true,orphaned:true}
    ]}
    case 'terminal switch --terminal':
      assert.ok(args[3] === 'term_sample' || args[3] === 'standalone')
      return {focus:{handle:args[3], worktreeId:'workspace', navigated:true}}
    case 'terminal show --terminal':
      return {terminal:{
        handle:args[3], executionHostId:'local', worktreeId:'workspace', connected:true, orphaned:false,
        ...(args[3] === 'standalone' ? {tabId:'qa-tab',leafId:'qa-leaf'} :
          {recordedPaneKey:'pane',incarnationId:change.incarnation ?? 'original'})
      }}
    default: throw new Error('unexpected_call')
  }
}

test('Bot所有のチャットと端末を除外し、権限エラーを空一覧にしない', async () => {
  const result = await collect(mockCli(), fixedNow)
  assert.equal(result.batches.find(batch => batch.key === 'sample-bot:items')?.rows[0].reason, longReason)
  const normal = result.batches.find(batch => batch.key === 'agents')
  assert.equal(normal?.ok, true)
  assert.deepEqual(normal?.rows.map(row => row.ref), ['orca_session_id:other-chat','orca_session_id:normal'])
  assert.deepEqual(result.batches.find(batch => batch.key === 'terminal-list')?.rows.map(row => row.ref), ['standalone'])
  assert.equal(result.batches.find(batch => batch.key === 'terminal-list')?.rows[0].pane, 'qa-tab:qa-leaf')
  assert.equal(normal?.rows[1].target, 'term_sample')
  assert.equal((await collect(mockCli({denyBot:true}), fixedNow)).batches.find(batch => batch.key === 'agents')?.ok, false)
})

test('120時間の境界で全ソースを選び、一覧の次ページを追い、古いワーカーを詳細照合しない', async () => {
  const edge = 1_700_000_000_000
  const calls: string[][] = []
  const run: Cli = async (...args) => {
    calls.push(args)
    switch (args.slice(0, 3).join(' ')) {
      case 'bot item list': return {
        botId:'sample-bot',
        items: args.includes('--cursor')
          ? [{uid:'edge',status:'cancelled',updatedAt:edge,links:[]},
            {uid:'invalid',updatedAt:'yesterday',links:[]}]
          : [{uid:'old',status:'needs_you',updatedAt:edge - 1,links:[
            {kind:'dispatch',ref:'ctx_settled',settledAt:edge}]}],
        ...(args.includes('--cursor') ? {} : {nextCursor:'older-page'})
      }
      case 'bot work list': return {items:[
        {dispatchId:'ctx_old',state:'working',startedAt:edge + 500},
        {dispatchId:'ctx_settled',state:'completed',startedAt:edge - 500},
        {dispatchId:'ctx_sample',state:'working',startedAt:edge - 500}
      ]}
      case 'orchestration worker-list --full': return args.includes('--cursor')
        ? {workers:[{dispatchId:'ctx_sample',projection:{evidence:{lastObservedAt:edge}}}]}
        : {workers:[{dispatchId:'ctx_old',projection:{evidence:{lastObservedAt:edge - 1}}}],
          page:{nextCursor:'worker-page'}}
      case 'agent list': return {agents:[
        {kind:'chat',hostId:'local',orcaSessionId:'edge-chat',updatedAt:edge, state:'completed'},
        {kind:'chat',hostId:'local',orcaSessionId:'old-chat',updatedAt:edge - 1}
      ]}
      case 'terminal list': return {truncated:true,totalCount:3,terminals:[]}
      case 'terminal list --limit': return {terminals:['old', 'edge', 'missing'].map((handle, index) =>
        ({handle,tabId:'tab',leafId:handle,worktreeId:'workspace',executionHostId:'local',connected:true,
          orphaned:false,lastOutputAt:[edge - 1, edge, null][index]}))}
      default: return mockCli()(...args)
    }
  }
  const {batches} = await collect(run, () => edge + activityWindow)
  assert.deepEqual(batches.flatMap(batch => batch.rows.map(row => row.ref)).sort(),
    ['ctx_sample','ctx_settled','edge','edge','orca_session_id:edge-chat'])
  assert.deepEqual(calls.filter(args => args[1] === 'worker-show').map(args => args[3]).sort(),
    ['ctx_sample','ctx_settled'])
  assert.equal(calls.some(args => args.includes('show') || args.includes('read')), false)
  assert.ok(calls.some(args => args.join(' ') === 'terminal list --limit 3'))
})

test('時刻が進むと取得失敗中の入力待ちと詳細も失効し、新しい実更新だけで戻る', async () => {
  const edge = 1_700_000_000_000
  let now = edge + activityWindow
  let reads = 0
  const run: Cli = async () => { reads++; throw new Error('unexpected_call') }
  const monitor = createMonitor(run, async () => true, () => now)
  const waiting = {...item, at:edge, state:'input' as const}
  const expiredTerminal = {...terminal, at:edge}
  await monitor.ingest(snapshot([waiting, expiredTerminal]))
  assert.equal(monitor.board().rows.length, 2)
  assert.equal(monitor.expiresIn(), 1)
  now++
  await monitor.ingest(snapshot([], false))
  assert.equal(monitor.board().rows.length, 0)
  assert.equal((await monitor.detail(item.id)).activity, undefined)
  assert.equal(reads, 0)
  await monitor.ingest(snapshot([expiredTerminal]))
  const event = {workspaceId:null,paneKey:'pane',receivedAt:now,state:'done' as const,sessionId:'normal'}
  await monitor.event(event)
  await monitor.event({...event,mainAgent:{state:'done',stateStartedAt:edge}})
  assert.equal(monitor.board().rows.length, 0)
  await monitor.event({...event,mainAgent:{state:'done',stateStartedAt:edge + 1}})
  await monitor.ingest(snapshot([expiredTerminal, {...waiting,at:now}]))
  assert.deepEqual(monitor.board().rows.map(row => [row.state,row.at]), [['input',now],['done',edge + 1]])
})

test('詳細は質問の差替えと回答を区別し、Botの異なるItemを読まない', async () => {
  const row: Row = {...item, bot:'sample-bot', questionId:'e1', state:'input'}
  const question = {kind:'commented', id:'e1', at:100,
    actor:{kind:'bot',botId:'sample-bot'},data:{text:'質問です'}}
  const replacement = {kind:'commented', id:'e2', at:120, actor:question.actor, data:{text:'新しい質問'}}
  const answer = {kind:'commented', id:'e3', at:130, actor:{kind:'owner'},data:{text:'確認しました',answers:'e1'}}
  const interrupted = [
    {kind:'commented',id:'e4',actor:{kind:'bot',botId:'visitor1'},data:{text:'時刻のない発言'}},
    {kind:'commented',id:'e5',at:140,actor:{kind:'bot',botId:'visitor2'},data:{text:'同名表示の別Bot'}},
    {kind:'commented',id:'e6',at:150,data:{text:'発言者情報のない記録'}}
  ]
  let mode = 'initial'
  const run: Cli = async (...args) => {
    if (args[1] === 'list') return {bots:[{id:'sample-bot'}],unreachable:[]}
    return {
      item:{uid:row.ref,number:3,title:row.title,owner:{botId:mode === 'mismatch' ? 'wrong' : row.bot,name:'架空Bot'},
        status:mode === 'answered' ? 'working' : 'needs_you',
        question:mode === 'answered' ? null : mode === 'replaced' ? {eventId:'e2',text:'新しい質問'} : {
          eventId:'e1',text:'質問です',decisions:[{question:'どちらにしますか？',replies:[{label:'案A',detail:'先に公開'}]}]
        }},
      events:mode === 'answered' ? [question,answer,...interrupted] : mode === 'replaced' ? [question,replacement] : [question]
    }
  }
  const monitor = createMonitor(run, async () => true, fixedNow)
  await monitor.ingest(snapshot([row]))
  const live = await monitor.detail(row.id)
  assert.deepEqual(live.question, {eventId:'e1',prompt:'どちらにしますか？',options:['案A — 先に公開']})
  assert.equal(live.action, 'bot-home')
  assert.deepEqual(live.activity?.entries, [{
    author:'架空Bot',speaker:{side:'agent',id:'sample-bot'},body:'質問です',at:100
  }])
  mode = 'replaced'
  const replaced = await monitor.detail(row.id)
  assert.equal(replaced.questionStatus, 'replaced')
  assert.equal(replaced.question?.eventId, 'e2')
  mode = 'answered'
  const answered = await monitor.detail(row.id)
  assert.equal(answered.questionStatus, 'answered')
  assert.equal(answered.state, 'working')
  assert.equal(answered.question, undefined)
  assert.deepEqual(answered.activity?.entries.slice(1).map(entry => [display(entry.author, 'ja'),entry.speaker?.id,entry.at]), [
    ['あなた','owner',130], ['別のBot','visitor1',undefined], ['別のBot','visitor2',140], ['発言者不明',undefined,150]
  ])
  mode = 'mismatch'
  assert.equal((await monitor.detail(row.id)).activity, undefined)
})

test('通常チャットには一致したタブの案内と実際に得た発言だけを示す', async () => {
  const row: Row = {...terminal, source:'Orca チャット',target:undefined, workspace:'workspace'}
  const place = {orcaSessionId:'normal',kind:'chat',paneKey:row.pane,worktreeId:row.workspace,
    hostId:'local',title:'既存チャット',workspace:'検証用',repo:'架空プロジェクト'}
  let readFrom = 'normal'
  const run: Cli = async (...args) => {
    if (args[1] === 'show') return {orcaSessionId:'normal',kind:'chat',places:[place]}
    return {orcaSessionId:readFrom,kind:'chat',source:'chat',limited:true,
      entries:[{kind:'message',role:'assistant',text:'確認しました'},{kind:'tool',name:'検証'}]}
  }
  const monitor = createMonitor(run, async () => true, fixedNow)
  await monitor.ingest(snapshot([row]))
  const detail = await monitor.detail(row.id)
  assert.ok(detail.navigationHint && display(detail.navigationHint, 'ja').includes('既存チャット'))
  assert.equal(detail.action, undefined)
  assert.deepEqual(detail.activity?.entries.map(entry => ({...entry, author:display(entry.author, 'ja')})), [{
    author:'エージェント',speaker:{side:'agent',id:'assistant'},body:'確認しました',at:undefined
  }])
  assert.ok(detail.activity?.issue)
  readFrom = 'orca_session_id:wrong'
  const wrong = await monitor.detail(row.id)
  assert.equal(wrong.activity?.entries.length, 0)
  assert.ok(wrong.activity?.issue && display(wrong.activity.issue, 'en').includes('source_mismatch'))
})

test('Codexの画像閲覧をまとめ、実際の発言・順序・取得済み時刻を維持する', async () => {
  const row: Row = {...terminal, source:'Orca チャット',target:undefined}
  const marker = {kind:'message', role:'assistant', text:'Viewed image\n[image]'}
  const run: Cli = async (...args) => args[1] === 'show' ?
    {orcaSessionId:'normal',kind:'chat',places:[]} : {
      orcaSessionId:'normal',kind:'chat',source:'chat',agent:'codex',limited:false,
      entries:[
        {...marker, role:'user'}, marker, marker,
        {kind:'message',role:'assistant',text:'  本文\n\n**太字**',at:1764201600000},
        marker,
        {kind:'message',role:'assistant',text:'本文の中に Viewed image\n[image] を引用'},
        {kind:'message',role:'assistant',text:'不正日時は欠損',at:9e15}
      ]
    }
  const monitor = createMonitor(run, async () => true, fixedNow)
  await monitor.ingest(snapshot([row]))
  const ends = (await monitor.detail(row.id)).activity?.entries
  assert.deepEqual(ends?.map(entry => [display(entry.author, 'ja'),entry.body,entry.at,entry.count]), [
    ['あなた','Viewed image\n[image]',undefined,undefined],
    ['画像閲覧','',undefined,2],
    ['エージェント','  本文\n\n**太字**',1764201600000,undefined],
    ['画像閲覧','',undefined,1],
    ['エージェント','本文の中に Viewed image\n[image] を引用',undefined,undefined],
    ['エージェント','不正日時は欠損',undefined,undefined]
  ])
})

test('添付画像のプレビューは確定済みストアのファイルと構造化メタデータを照合する', async () => {
  const root = await mkdtemp(join(tmpdir(),'session-board-attachment-test-'))
  try {
    const store = join(root,'agent-session-attachments')
    const upload = join(store,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee')
    await mkdir(upload, {recursive:true})
    const name = 'fixture.png'
    const path = join(upload,name)
    const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGPQjO4EAAG+AQ7QZSssAAAAAElFTkSuQmCC', 'base64')
    await writeFile(path,image)
    const meta = {path,name,bytes:image.length}
    const resolvedStore = await import('node:fs/promises').then(fs => fs.realpath(store))
    const resolvedMeta = {...meta,path:join(resolvedStore,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',name)}
    if (process.platform === 'darwin') assert.ok((await itemImage(resolvedMeta,resolvedStore))?.src.startsWith('data:image/png;base64,'))
    assert.equal(await itemImage(resolvedMeta.path,resolvedStore), undefined)
    assert.equal(await itemImage({...resolvedMeta,bytes:image.length+1},resolvedStore), undefined)
    const outside = join(root,'outside.png')
    await writeFile(outside,image)
    assert.equal(await itemImage({...meta,path:outside,name:'outside.png'},resolvedStore), undefined)
    const link = join(resolvedStore,'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee','linked.png')
    await symlink(outside,link)
    assert.equal(await itemImage({...meta,path:link,name:'linked.png'},resolvedStore), undefined)
  } finally {
    await rm(root,{recursive:true,force:true})
  }
})

test('パレットのコマンドはフォルダ版と併存しても公開版の登録パネルだけを開く', async () => {
  let publicStatus = 'running'
  const commands: string[][] = []
  const contributions = {panels:[{id:'session-board'}],commands:[{id:'open-board'}]}
  const run: Cli = async (...args) => {
    commands.push(args)
    if (args[1] === 'list') return {plugins:[
      {pluginKey:'local.session-board',status:'running',...contributions},
      {pluginKey:'yoshhiide.session-board',status:publicStatus,...contributions},
      {pluginKey:'other.session-board',status:'running',panels:[{id:'session-board'}]}
    ]}
    return {kind:'panel',pluginKey:args[2],panelId:args[4]}
  }
  assert.equal(await openBoard(run, new AbortController().signal), 'Opened Session Board.')
  assert.deepEqual(commands[1], ['plugin','open','yoshhiide.session-board','--panel','session-board'])
  publicStatus = 'idle'
  assert.ok((await openBoard(run, new AbortController().signal)).includes('Could not open'))
  assert.equal(commands.filter(command => command[1] === 'open').length, 1)
})

test('Bot Homeへは表示済みの質問が差し替わっていない同じBotだけを渡す', async () => {
  const requested: string[] = []
  let questionId = 'e1'
  let ambiguous = false
  const run: Cli = async (...args) => {
    if (args.slice(0, 3).join(' ') === 'bot item show') return {
      item:{uid:'item-key',owner:{botId:'sample-bot'},status:'needs_you',question:{eventId:questionId}},
      events:[]
    }
    if (ambiguous && args.join(' ') === 'bot list') return {
      bots:[{id:'sample-bot'},{id:'sample-bot',server:{on:'qa'}}],unreachable:[]
    }
    return mockCli()(...args)
  }
  const tested = await mountWorker({
    default: (orca: OrcaWorkerApi) => {
      setupWorker(orca, run, 0, async id => { requested.push(id); return true }, fixedNow)
    }
  })
  try {
    const board = await tested.request('board.refresh')
    const id = board.rows.find(row => row.source === 'Bot Item')!.id
    assert.equal(await tested.request('board.focus', {id, questionId:'e1'}), true)
    questionId = 'e2'
    assert.equal(await tested.request('board.focus', {id, questionId:'e1'}), false)
    ambiguous = true
    assert.equal(await tested.request('board.focus', {id, questionId:'e2'}), false)
    assert.deepEqual(requested, ['sample-bot'])
  } finally {
    await tested.deactivate()
  }
})

test('返信先の取得中に窓の確認を開始し、連打を拒否して権限エラー後に再試行できる', async () => {
  if (process.platform !== 'darwin') return
  let beginTargetRead: () => void = () => {}
  let finishPreflight: () => void = () => {}
  const targetStarted = new Promise<void>(resolve => { beginTargetRead = resolve })
  const preflightPending = new Promise<void>(resolve => { finishPreflight = resolve })
  let inventoryCalls = 0
  let snapshotCalls = 0
  let opens = 0
  const run: Cli = async (...args) => {
    switch (args.slice(0, 3).join(' ')) {
      case 'bot item list': return {botId:'sample-bot',items:[{
        uid:'item-key',number:3,title:item.title,status:'planned',updatedAt:100,links:[],lastEventId:'e1'
      }]}
      case 'bot item show':
        beginTargetRead()
        return {item:{uid:'item-key',number:3,title:item.title,status:'planned',
          owner:{botId:'sample-bot',name:'サンプル Bot'}},events:[]}
      case 'computer list-windows --app':
        inventoryCalls++
        return {windows:[]}
      case 'computer get-app-state --app':
        snapshotCalls++
        if (snapshotCalls > 1) return {}
        await preflightPending
        throw new Error('permission_denied')
      default: return mockCli()(...args)
    }
  }
  const tested = await mountWorker({
    default: (orca: OrcaWorkerApi) => {
      setupWorker(orca, run, 0, async () => { opens++; return true }, fixedNow)
    }
  })
  try {
    const board = await tested.request('board.refresh')
    const id = board.rows.find(row => row.source === 'Bot Item')!.id
    const reply = tested.request('board.reply', {id})
    await targetStarted
    assert.deepEqual([inventoryCalls,snapshotCalls],[1,1])
    assert.deepEqual(await tested.request('board.reply', {id}), {opened:false})
    finishPreflight()
    assert.deepEqual(await reply, {opened:false,reason:'accessibility-required'})
    assert.deepEqual(await tested.request('board.reply', {id}), {opened:false,reason:'window-unavailable'})
    assert.deepEqual([inventoryCalls,snapshotCalls,opens],[2,2,0])
  } finally {
    finishPreflight()
    await tested.deactivate()
  }
})

test('Hostのパネル入口から更新・詳細・端末遷移を使い、競合する端末を拒否する', async () => {
  const options: {handle?: string; incarnation?: string} = {}
  let dispose: (() => void) | undefined
  const tested = await mountWorker({
    default: (orca: OrcaWorkerApi) => { dispose = setupWorker(orca, mockCli(options), 0, undefined, fixedNow) },
    deactivate: () => dispose?.()
  })
  try {
    const initial = await tested.request('board.start')
    assert.deepEqual(initial, JSON.parse(JSON.stringify(initial)))
    const result = await tested.request('board.refresh')
    assert.deepEqual(result, JSON.parse(JSON.stringify(result)))
    assert.equal(result.rows.length, 4)
    assert.equal(tested.host.callsOf('notifications.show').length, 0)
    const event = {workspaceId:null,paneKey:'pane',receivedAt:300,state:'blocked' as const,
      sessionId:'normal',mainAgent:{state:'blocked' as const,stateStartedAt:299}}
    await tested.emit('agent.status.changed', event)
    await tested.emit('agent.status.changed', event)
    assert.equal(tested.host.callsOf('notifications.show').length, 1)
    assert.equal((await tested.request('board.detail',{id:terminal.id})).transitions[0].to, 'blocked')
    assert.equal(await tested.request('board.focus', {id:terminal.id}), true)
    assert.equal(await tested.request('board.focus', {id:'terminal-ui:standalone'}), true)
    options.incarnation = 'replaced'
    assert.equal(await tested.request('board.focus', {id:terminal.id}), false)
    options.incarnation = 'original'
    options.handle = 'reused'
    assert.equal(await tested.request('board.focus', {id:terminal.id}), false)
    assert.deepEqual(tested.refusals, [])
  } finally {
    await tested.deactivate()
  }
})

test('通知は最新のパネル言語を使い、セッション名は原文で送る', async () => {
  let dispose: (() => void) | undefined
  const tested = await mountWorker({
    default: (orca: OrcaWorkerApi) => { dispose = setupWorker(orca, mockCli(), 0, undefined, fixedNow) },
    deactivate: () => dispose?.()
  })
  try {
    const cases = [
      {locale:'ja-JP', state:'blocked', title:'ブロック中', from:'作業中'},
      {locale:'en', state:'working', title:'In progress', from:'Blocked'},
      {locale:'de-DE', state:'blocked', title:'Blocked', from:'In progress'},
      {locale:undefined, state:'working', title:'In progress', from:'Blocked'}
    ] as const
    for (const [index, {locale, state, title, from}] of cases.entries()) {
      await tested.request('board.start', locale ? {locale} : undefined)
      await tested.request('board.refresh', locale ? {locale} : undefined)
      const at = 500 + index
      await tested.emit('agent.status.changed', {workspaceId:null, paneKey:'pane', receivedAt:at, state,
        sessionId:'normal', mainAgent:{state, stateStartedAt:at}})
      assert.deepEqual(tested.host.callsOf('notifications.show').at(-1), {
        title: title + ' · ' + terminal.title, body: from + ' → ' + title + ' · ' + terminal.origin
      })
    }
    assert.equal(tested.host.callsOf('notifications.show').length, cases.length)
    assert.equal(language('ja'), 'ja')
    assert.equal(language('invalid_locale'), 'en')
  } finally {
    await tested.deactivate()
  }
})
