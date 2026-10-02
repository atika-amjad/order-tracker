// Chat flow reproduction test: simulates customer + agent over Socket.io.
// Run AFTER the backend is listening:
//   PORT=4013 node server.js
//   BASE_URL=http://127.0.0.1:4013 node tests/chat-repro.mjs
'use strict';

import { io } from 'socket.io-client';

const BASE = process.env.BASE_URL || 'http://127.0.0.1:4013';

const log = (...a) => console.log(...a);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function sock(label) {
  const s = io(BASE, { transports: ['websocket'] });
  s.on('connect', () => log(`[${label}] connected ${s.id}`));
  return s;
}

async function case_agentAlreadyJoined() {
  log('\n=== CASE 1: agent joins BEFORE customer requests (two-device scenario) ===');
  const agent = sock('agent');
  const customer = sock('customer');
  await wait(300);
  agent.emit('support:joinAgents');

  const agentRequests = [];
  agent.on('support:request', (r) => agentRequests.push(r));

  await wait(400);
  const roomId = 'repro-case1';
  customer.emit('support:request', { customerName: 'Case1 Customer', roomId });
  await wait(300);

  log('  agent saw request?', agentRequests.length === 1, JSON.stringify(agentRequests[0] || null));

  // Agent accepts
  let customerAccepted = false;
  customer.on('support:accepted', () => { customerAccepted = true; });
  agent.emit('support:accept', { roomId });
  await wait(300);
  log('  customer got support:accepted?', customerAccepted);

  // Now both join chat and exchange messages
  const agentMsgs = [];
  const customerMsgs = [];
  agent.on('chat:message', (m) => { if (m.roomId === roomId) agentMsgs.push(m); });
  customer.on('chat:message', (m) => { if (m.roomId === roomId) customerMsgs.push(m); });
  customer.emit('chat:join', { roomId, role: 'customer', name: 'Case1 Customer' });
  agent.emit('chat:join', { roomId, role: 'agent', name: 'Agent' });
  await wait(200);

  customer.emit('chat:message', { roomId, text: 'hello from customer' });
  await wait(300);
  log('  agent received customer msg?', agentMsgs.length === 1, JSON.stringify(agentMsgs));
  log('  customer received own msg back (echo)?', customerMsgs.length === 1, '->', JSON.stringify(customerMsgs));

  agent.emit('chat:message', { roomId, text: 'hi from agent' });
  await wait(300);
  log('  customer received agent msg?', customerMsgs.some((m) => m.text === 'hi from agent'));
  log('  agent received own msg back (echo)?', agentMsgs.filter((m) => m.text === 'hi from agent').length, 'copies');

  agent.disconnect(); customer.disconnect();
  return { requestSeen: agentRequests.length === 1, accepted: customerAccepted,
           agentGotCustomerMsg: agentMsgs.length === 1, customerEchoedOwn: customerMsgs.length === 1 };
}

async function case_customerRequestsBeforeAgentJoins() {
  log('\n=== CASE 2: customer requests FIRST, agent joins AFTER (single-browser tab-switch) ===');
  const customer = sock('customer');
  await wait(300);
  const roomId = 'repro-case2';
  customer.emit('support:request', { customerName: 'Case2 Customer', roomId });
  await wait(300);

  // Now agent opens
  const agent = sock('agent');
  await wait(300);
  const agentRequests = [];
  agent.on('support:request', (r) => agentRequests.push(r));
  agent.emit('support:joinAgents');
  await wait(500);

  log('  agent saw the PENDING request (late join)?', agentRequests.length === 1, JSON.stringify(agentRequests[0] || null));
  agent.disconnect(); customer.disconnect();
  return { lateJoinRequestSeen: agentRequests.length === 1 };
}

(async () => {
  const r1 = await case_agentAlreadyJoined();
  const r2 = await case_customerRequestsBeforeAgentJoins();
  log('\n=== SUMMARY ===');
  log('CASE1 requestSeen        :', r1.requestSeen);
  log('CASE1 accepted           :', r1.accepted);
  log('CASE1 agent<-customer    :', r1.agentGotCustomerMsg);
  log('CASE1 customer echoes own:', r1.customerEchoedOwn, '(dup bug if true)');
  log('CASE2 late-join sees req  :', r2.lateJoinRequestSeen, '(MAIN bug if false)');
  process.exit(0);
})();
