import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Zap, Users, Trophy, Gamepad2, Copy, Crown, Clock3, LogIn, Plus, Radio, CheckCircle2, XCircle, ArrowRight, Sparkles } from 'lucide-react';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = url && key ? createClient(url, key) : null;

function App() {
  const [screen, setScreen] = useState('home');
  const [nickname, setNickname] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [room, setRoom] = useState(null);
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [question, setQuestion] = useState(null);
  const [selected, setSelected] = useState('');
  const [feedback, setFeedback] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [seconds, setSeconds] = useState(20);
  const [answerResult, setAnswerResult] = useState(null);

  const configured = Boolean(supabase);
  const sortedPlayers = useMemo(() => [...players].sort((a,b) => (b.score || 0) - (a.score || 0)), [players]);

  useEffect(() => {
    if (!room?.id || !supabase) return;
    const channel = supabase.channel(`room-${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` }, refreshRoom)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'game_rooms', filter: `id=eq.${room.id}` }, refreshRoom)
      .subscribe();
    refreshRoom();
    return () => { supabase.removeChannel(channel); };
  }, [room?.id]);

  useEffect(() => {
    if (screen !== 'playing' || !game?.question_started_at) return;
    const tick = () => {
      const elapsed = Math.floor((Date.now() - new Date(game.question_started_at).getTime()) / 1000);
      setSeconds(Math.max(0, 20 - elapsed));
    };
    tick();
    const timer = setInterval(tick, 250);
    return () => clearInterval(timer);
  }, [screen, game?.question_started_at]);

  async function refreshRoom() {
    if (!room?.id || !supabase) return;
    const { data: r } = await supabase.from('game_rooms').select('*').eq('id', room.id).maybeSingle();
    const { data: p } = await supabase.from('players').select('id,nickname,score,is_host,joined_at').eq('room_id', room.id).order('joined_at');
    if (r) {
      setRoom(r);
      setGame(r);
      if (r.status === 'playing') {
        const { data: q } = await supabase.rpc('get_current_question', { p_room_code: r.room_code });
        if (q && q.length) setQuestion(q[0]);
        else if (q && !Array.isArray(q)) setQuestion(q);
        setScreen('playing');
      } else if (r.status === 'finished') setScreen('finished');
      else setScreen('lobby');
    }
    if (p) setPlayers(p);
  }

  async function createRoom() {
    if (!configured) return setNotice('Add your Supabase URL and publishable key to the .env file first.');
    if (!nickname.trim()) return setNotice('Enter your nickname first.');
    setBusy(true); setNotice('');
    const { data, error } = await supabase.rpc('create_game_room', { p_nickname: nickname.trim(), p_question_count: 10, p_seconds_per_question: 20 });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    await enterRoom(result.room_id, result.room_code, result.player_id, true);
  }

  async function joinRoom() {
    if (!configured) return setNotice('Add your Supabase URL and publishable key to the .env file first.');
    if (!nickname.trim() || !roomCode.trim()) return setNotice('Enter your nickname and room code.');
    setBusy(true); setNotice('');
    const { data, error } = await supabase.rpc('join_game_room', { p_room_code: roomCode.trim().toUpperCase(), p_nickname: nickname.trim() });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    await enterRoom(result.room_id, roomCode.trim().toUpperCase(), result.player_id, false);
  }

  async function enterRoom(roomId, code, pid, host) {
    setPlayerId(pid); setIsHost(host);
    const { data: r } = await supabase.from('game_rooms').select('*').eq('id', roomId).single();
    setRoom(r); setGame(r); setRoomCode(code);
    const { data: p } = await supabase.from('players').select('id,nickname,score,is_host,joined_at').eq('room_id', roomId).order('joined_at');
    setPlayers(p || []); setScreen('lobby');
  }

  async function startGame() {
    setBusy(true);
    const { error } = await supabase.rpc('start_game', { p_room_code: room.room_code, p_player_id: playerId });
    setBusy(false);
    if (error) return setNotice(error.message);
    await refreshRoom();
  }

  async function submitAnswer(option) {
    if (selected || seconds <= 0) return;
    setSelected(option); setBusy(true);
    const { data, error } = await supabase.rpc('submit_game_answer', { p_room_code: room.room_code, p_player_id: playerId, p_question_id: question.id, p_answer: option });
    setBusy(false);
    if (error) return setNotice(error.message);
    const result = Array.isArray(data) ? data[0] : data;
    setAnswerResult(result);
    setFeedback(result.is_correct ? 'Correct! +10 points' : 'Not quite — keep going!');
    await refreshRoom();
  }

  async function nextQuestion() {
    setBusy(true);
    const { error } = await supabase.rpc('advance_game_question', { p_room_code: room.room_code, p_player_id: playerId });
    setBusy(false);
    if (error) return setNotice(error.message);
    setSelected(''); setFeedback(''); setAnswerResult(null);
    await refreshRoom();
  }

  async function copyInvite() {
    const link = `${window.location.origin}/?room=${room.room_code}`;
    await navigator.clipboard.writeText(`Join my ChatPlay Trivia game!\nRoom code: ${room.room_code}\n${link}`);
    setNotice('Invite link copied. Share it with your friends!');
  }

  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('room');
    if (code) setRoomCode(code.toUpperCase());
  }, []);

  return <div className="app-shell">
    <div className="orb orb-one"></div><div className="orb orb-two"></div>
    <header className="topbar">
      <div className="brand"><div className="brand-mark"><Zap size={21} fill="currentColor"/></div><span>CHATPLAY<span className="brand-accent"> TRIVIA</span></span></div>
      <div className="live-pill"><span className="live-dot"></span> MULTIPLAYER ARENA</div>
    </header>

    <main className="main">
      {screen === 'home' && <section className="hero">
        <div className="eyebrow"><Sparkles size={14}/> FRIENDS. FAMILY. FRIENDLY COMPETITION.</div>
        <h1>THINK FAST.<br/><span>PLAY TO WIN.</span></h1>
        <p className="hero-copy">Your crew. One room. Ten questions. Who takes the crown?</p>
        <div className="home-grid">
          <div className="panel create-panel">
            <div className="panel-icon purple"><Plus size={22}/></div>
            <h2>CREATE A ROOM</h2><p>Start a new trivia battle and invite your people.</p>
            <label>Your player name</label>
            <input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="e.g. Quiz Master" maxLength={18}/>
            <button className="primary-btn" onClick={createRoom} disabled={busy}>{busy?'CREATING...':'CREATE GAME ROOM'} <ArrowRight size={17}/></button>
          </div>
          <div className="panel join-panel">
            <div className="panel-icon cyan"><LogIn size={22}/></div>
            <h2>JOIN A ROOM</h2><p>Got an invite? Enter the code and jump in.</p>
            <label>Your player name</label>
            <input value={nickname} onChange={e=>setNickname(e.target.value)} placeholder="Your nickname" maxLength={18}/>
            <label>Room code</label>
            <input value={roomCode} onChange={e=>setRoomCode(e.target.value.toUpperCase())} placeholder="e.g. A7K9Q2" maxLength={8}/>
            <button className="secondary-btn" onClick={joinRoom} disabled={busy}>{busy?'JOINING...':'JOIN GAME'} <ArrowRight size={17}/></button>
          </div>
        </div>
        <div className="feature-strip"><div><Users size={17}/><b>UP TO 10 PLAYERS</b></div><div><Clock3 size={17}/><b>20-SECOND ROUNDS</b></div><div><Trophy size={17}/><b>LIVE LEADERBOARD</b></div></div>
      </section>}

      {screen === 'lobby' && room && <section className="game-section">
        <div className="section-heading"><span className="eyebrow">THE ARENA IS OPEN</span><h1>WAITING <span>ROOM</span></h1><p>Get your squad in. The battle begins when the host is ready.</p></div>
        <div className="room-code-card"><div><small>YOUR ROOM CODE</small><strong>{room.room_code}</strong></div><button onClick={copyInvite}><Copy size={16}/> COPY INVITE</button></div>
        <div className="panel roster-panel"><div className="roster-head"><h2><Users size={19}/> PLAYERS IN THE ROOM</h2><span>{players.length}/10</span></div>
          <div className="player-list">{players.map((p,i)=><div className="player-row" key={p.id}><div className="player-avatar">{p.nickname.slice(0,1).toUpperCase()}</div><b>{p.nickname}</b>{p.is_host&&<span className="host-tag"><Crown size={12}/> HOST</span>}<span className="ready-tag">CONNECTED</span></div>)}</div>
          {isHost ? <button className="primary-btn wide" onClick={startGame} disabled={busy || players.length<1}>{busy?'STARTING...':'START TRIVIA BATTLE'} <Zap size={17}/></button> : <div className="waiting-note"><Radio size={17}/> Waiting for the host to start the game...</div>}
        </div>
        {notice&&<div className="notice">{notice}</div>}
      </section>}

      {screen === 'playing' && room && <section className="game-section">
        <div className="game-topline"><span className="live-pill"><span className="live-dot"></span> LIVE MATCH</span><span className="round-count">ROUND {room.current_question || 1} / {room.question_count || 10}</span></div>
        <div className="timer-wrap"><div className={`timer ${seconds<=5?'urgent':''}`}><Clock3 size={17}/>{seconds}s</div><div className="timer-track"><div style={{width:`${seconds/20*100}%`}}/></div></div>
        <div className="panel question-panel">
          <span className="eyebrow">TRIVIA CHALLENGE</span>
          <h2>{question?.question_text || 'Loading question...'}</h2>
          <div className="answers">{(question?.options || []).map((opt,i)=><button key={i} className={`answer ${selected===String.fromCharCode(65+i)?'chosen':''}`} disabled={!!selected || seconds===0} onClick={()=>submitAnswer(String.fromCharCode(65+i))}><span>{String.fromCharCode(65+i)}</span>{opt}</button>)}</div>
          {feedback&&<div className={`feedback ${answerResult?.is_correct?'good':'bad'}`}>{answerResult?.is_correct?<CheckCircle2 size={18}/>:<XCircle size={18}/>} {feedback}</div>}
        </div>
        <div className="panel mini-board"><h3><Trophy size={17}/> LIVE LEADERBOARD</h3>{sortedPlayers.map((p,i)=><div className="score-row" key={p.id}><span className="rank">{i+1}</span><b>{p.nickname}</b><strong>{p.score||0} pts</strong></div>)}</div>
        {isHost && <button className="primary-btn wide" onClick={nextQuestion} disabled={busy}>{room.current_question >= room.question_count ? 'FINISH / NEXT' : 'NEXT QUESTION'} <ArrowRight size={17}/></button>}
        {notice&&<div className="notice">{notice}</div>}
      </section>}

      {screen === 'finished' && <section className="game-section finish-screen"><div className="trophy-big"><Trophy size={54}/></div><span className="eyebrow">MATCH COMPLETE</span><h1>VICTORY <span>SCREEN</span></h1><p>Here are the final standings.</p><div className="panel mini-board final-board">{sortedPlayers.map((p,i)=><div className="score-row" key={p.id}><span className="rank">{i===0?'👑':i+1}</span><b>{p.nickname}</b><strong>{p.score||0} pts</strong></div>)}</div><button className="secondary-btn" onClick={()=>{setScreen('home');setRoom(null);setPlayers([]);setQuestion(null);}}>BACK TO HOME</button></section>}
      {notice&&screen==='home'&&<div className="notice home-notice">{notice}</div>}
      {!configured&&<div className="setup-warning"><b>SETUP REQUIRED:</b> Add your Supabase credentials to <code>.env</code> before running the game.</div>}
    </main>
    <footer>CHATPLAY TRIVIA <span>•</span> BUILT FOR YOUR CREW <span>•</span> LET THE BEST BRAIN WIN</footer>
  </div>;
}

createRoot(document.getElementById('root')).render(<App/>);
