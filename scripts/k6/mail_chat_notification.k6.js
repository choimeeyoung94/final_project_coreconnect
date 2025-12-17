import { group, check } from 'k6';
import { Rate } from 'k6/metrics';

import { ensureLoggedIn } from './lib/session.js';
import { get, postJson, patchJson, patchEmpty, putJson, postRaw } from './lib/api.js';
import {
  EMAIL_WRITE_RATIO,
  ENABLE_EMAIL_SEND,
  CHAT_CREATE_ROOM_IF_NONE,
  NOTIFICATION_PUSH_TEST_RATIO,
} from './lib/config.js';
import { pick, randomIntBetween, randomString, safeJson, sleepJitter, buildMultipart } from './lib/util.js';

const functionalErrors = new Rate('functional_errors');

export const options = {
  scenarios: {
    mail: {
      executor: 'ramping-vus',
      exec: 'mail',
      startVUs: Number(__ENV.MAIL_START_VUS || 0),
      stages: [
        { duration: __ENV.MAIL_RAMP || '30s', target: Number(__ENV.MAIL_VUS || 5) },
        { duration: __ENV.MAIL_HOLD || '1m', target: Number(__ENV.MAIL_VUS || 5) },
        { duration: __ENV.MAIL_DOWN || '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    chat: {
      executor: 'ramping-vus',
      exec: 'chat',
      startVUs: Number(__ENV.CHAT_START_VUS || 0),
      stages: [
        { duration: __ENV.CHAT_RAMP || '30s', target: Number(__ENV.CHAT_VUS || 5) },
        { duration: __ENV.CHAT_HOLD || '1m', target: Number(__ENV.CHAT_VUS || 5) },
        { duration: __ENV.CHAT_DOWN || '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
    notification: {
      executor: 'ramping-vus',
      exec: 'notification',
      startVUs: Number(__ENV.NOTI_START_VUS || 0),
      stages: [
        { duration: __ENV.NOTI_RAMP || '30s', target: Number(__ENV.NOTI_VUS || 3) },
        { duration: __ENV.NOTI_HOLD || '1m', target: Number(__ENV.NOTI_VUS || 3) },
        { duration: __ENV.NOTI_DOWN || '15s', target: 0 },
      ],
      gracefulRampDown: '10s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.02'],
    http_req_duration: ['p(95)<1200'],
    functional_errors: ['rate<0.01'],
  },
};

function extractResponseDtoData(json) {
  // ResponseDTO.success(data, message) style
  return json?.data ?? json?.Data ?? null;
}

function extractPageContent(json) {
  const dtoData = extractResponseDtoData(json);
  const content = dtoData?.content;
  return Array.isArray(content) ? content : [];
}

export function mail() {
  const s = ensureLoggedIn();
  const userEmail = s.profile.email;

  group('mail: inbox + counts', () => {
    const inboxRes = get(`/email/inbox?userEmail=${encodeURIComponent(userEmail)}&page=0&size=10`, {
      tags: { name: 'GET /email/inbox' },
    });
    check(inboxRes, { 'mail: inbox 200': (r) => r.status === 200 });

    const countRes = get(`/email/inbox/count?userEmail=${encodeURIComponent(userEmail)}`, {
      tags: { name: 'GET /email/inbox/count' },
    });
    check(countRes, { 'mail: inbox count 200': (r) => r.status === 200 });

    const unreadRes = get(`/email/inbox/unread-count?userEmail=${encodeURIComponent(userEmail)}`, {
      tags: { name: 'GET /email/inbox/unread-count' },
    });
    check(unreadRes, { 'mail: inbox unread-count 200': (r) => r.status === 200 });

    const inboxJson = safeJson(inboxRes);
    const items = extractPageContent(inboxJson);
    const first = items[0];
    const emailId = first?.emailId ?? first?.id;

    if (emailId) {
      group('mail: detail + read + favorite', () => {
        const detailRes = get(`/email/${emailId}?userEmail=${encodeURIComponent(userEmail)}`, {
          tags: { name: 'GET /email/{id}' },
        });
        check(detailRes, { 'mail: detail 200': (r) => r.status === 200 });

        const markReadRes = patchJson(
          `/email/${emailId}/read`,
          { userEmail },
          { tags: { name: 'PATCH /email/{id}/read' } }
        );
        check(markReadRes, { 'mail: mark read 200': (r) => r.status === 200 });

        const favRes = patchJson(
          `/email/${emailId}/favorite`,
          { userEmail },
          { tags: { name: 'PATCH /email/{id}/favorite' } }
        );
        check(favRes, { 'mail: toggle favorite 200': (r) => r.status === 200 });
      });
    }
  });

  // Optional: write traffic (draft/send). Default OFF to avoid side effects.
  const doWrite = Math.random() < EMAIL_WRITE_RATIO;
  if (doWrite) {
    group('mail: optional write (draft/send)', () => {
      // Build multipart form-data with a JSON part named 'data' as the backend expects.
      const now = new Date().toISOString();

      const orgRes = get('/user/organization', { tags: { name: 'GET /user/organization' } });
      const org = safeJson(orgRes);
      const candidates = Array.isArray(org) ? org : extractResponseDtoData(org) || [];
      const recipients = (Array.isArray(candidates) ? candidates : [])
        .map((u) => u.email)
        .filter((e) => e && e !== userEmail);

      const to = recipients.length ? [pick(recipients)] : [userEmail];

      const dto = {
        emailTitle: `[k6] mail test ${now}`,
        emailContent: `k6 generated content ${randomString(8)}`,
        recipientAddress: to,
        ccAddresses: [],
        bccAddresses: [],
        emailType: 'K6_TEST',
      };

      const mp = buildMultipart([
        {
          name: 'data',
          contentType: 'application/json; charset=utf-8',
          data: JSON.stringify(dto),
        },
      ]);

      const draftRes = postRaw('/email/draft', mp.body, {
        headers: { 'Content-Type': `multipart/form-data; boundary=${mp.boundary}` },
        tags: { name: 'POST /email/draft (multipart)' },
      });

      const okDraft = check(draftRes, { 'mail: draft 200': (r) => r.status === 200 });
      if (!okDraft) functionalErrors.add(1);

      if (ENABLE_EMAIL_SEND) {
        const sendRes = postRaw('/email/send', mp.body, {
          headers: { 'Content-Type': `multipart/form-data; boundary=${mp.boundary}` },
          tags: { name: 'POST /email/send (multipart)' },
        });
        const okSend = check(sendRes, { 'mail: send 200': (r) => r.status === 200 });
        if (!okSend) functionalErrors.add(1);
      }
    });
  }

  sleepJitter();
}

function getOrCreateRoomId(myId) {
  const latestRes = get('/chat/rooms/messages/latest', { tags: { name: 'GET /chat/rooms/messages/latest' } });
  if (latestRes.status !== 200) return null;

  const latestJson = safeJson(latestRes);
  const rooms = extractResponseDtoData(latestJson);
  const list = Array.isArray(rooms) ? rooms : [];
  const first = list[0];
  const existingRoomId = first?.roomId ?? first?.id;
  if (existingRoomId) return existingRoomId;

  if (!CHAT_CREATE_ROOM_IF_NONE) return null;

  // No rooms -> create one using org chart users
  const orgRes = get('/user/organization', { tags: { name: 'GET /user/organization' } });
  const org = safeJson(orgRes);
  const users = Array.isArray(org) ? org : [];
  const other = users.find((u) => (u.userId ?? u.id) && (u.userId ?? u.id) !== myId);
  const otherId = other ? (other.userId ?? other.id) : null;

  const userIds = otherId ? [myId, otherId] : [myId];

  const createRes = postJson(
    '/chat',
    {
      roomName: `[k6] room ${randomString(6)}`,
      roomType: true,
      userIds,
    },
    { tags: { name: 'POST /chat (create room)' } }
  );

  if (createRes.status !== 201 && createRes.status !== 200) return null;
  const created = safeJson(createRes);
  const roomId = created?.id ?? created?.roomId ?? created?.data?.id ?? created?.data?.roomId;
  return roomId || null;
}

export function chat() {
  const s = ensureLoggedIn();
  const myId = s.profile.id;

  group('chat: list rooms + send message', () => {
    const roomId = getOrCreateRoomId(myId);
    if (!roomId) {
      functionalErrors.add(1);
      return;
    }

    const sendRes = postJson(
      `/chat/rooms/${roomId}/messages`,
      { roomId, content: `k6 msg ${randomString(10)}` },
      { tags: { name: 'POST /chat/rooms/{roomId}/messages' } }
    );
    check(sendRes, { 'chat: send msg 201': (r) => r.status === 201 || r.status === 200 });

    const msgsRes = get(`/chat/${roomId}/messages?page=0&size=20`, {
      tags: { name: 'GET /chat/{roomId}/messages' },
    });
    check(msgsRes, { 'chat: messages 200': (r) => r.status === 200 });

    const readRes = patchEmpty(`/chat/rooms/${roomId}/messages/read`, {
      tags: { name: 'PATCH /chat/rooms/{roomId}/messages/read' },
    });
    check(readRes, { 'chat: mark room read 200': (r) => r.status === 200 });

    const unreadRes = get('/chat/messages/unread', { tags: { name: 'GET /chat/messages/unread' } });
    check(unreadRes, { 'chat: unread 200': (r) => r.status === 200 });
  });

  sleepJitter();
}

export function notification() {
  ensureLoggedIn();

  group('notification: fetch + optional push + read', () => {
    const summaryRes = get('/chat/notifications/unread', { tags: { name: 'GET /chat/notifications/unread' } });
    check(summaryRes, { 'noti: unread summary 200': (r) => r.status === 200 });

    const allRes = get('/chat/notifications', { tags: { name: 'GET /chat/notifications' } });
    check(allRes, { 'noti: list 200': (r) => r.status === 200 });

    if (Math.random() < NOTIFICATION_PUSH_TEST_RATIO) {
      const pushRes = postJson(
        '/chat/notifications/push-test',
        { message: `k6 notification ${randomString(10)}` },
        { tags: { name: 'POST /chat/notifications/push-test' } }
      );
      check(pushRes, { 'noti: push-test 200': (r) => r.status === 200 });
    }

    const unreadAllRes = get('/chat/notifications/unread/all', {
      tags: { name: 'GET /chat/notifications/unread/all' },
    });
    check(unreadAllRes, { 'noti: unread all 200': (r) => r.status === 200 });

    const readAllRes = putJson('/chat/notifications/read-all', {}, { tags: { name: 'PUT /chat/notifications/read-all' } });
    check(readAllRes, { 'noti: read-all 200': (r) => r.status === 200 });

    // If we have unread list endpoint data, try to read one
    const unreadListRes = get('/chat/unread/list', { tags: { name: 'GET /chat/unread/list' } });
    if (unreadListRes.status === 200) {
      const body = safeJson(unreadListRes);
      const list = Array.isArray(body) ? body : body?.data;
      const n = Array.isArray(list) ? list[0] : null;
      const nid = n?.notificationId ?? n?.id;
      if (nid) {
        const oneRes = putJson(`/chat/notifications/${nid}/read`, {}, { tags: { name: 'PUT /chat/notifications/{id}/read' } });
        check(oneRes, { 'noti: read one 200': (r) => r.status === 200 });
      }
    }
  });

  sleepJitter();
}
