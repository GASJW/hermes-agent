/**
 * Unit tests for WhatsApp-native bridge payload helpers.
 *
 * These tests avoid importing bridge.js because that file starts an HTTP
 * server and Baileys socket at module load. Keep the helper module pure.
 */

import { strict as assert } from 'node:assert';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  generateMessageIDV2,
  generateWAMessageFromContent,
  getAggregateVotesInPollMessage,
} from '@whiskeysockets/baileys';

import {
  buildPollPayload,
  buildButtonsSendPayload,
  buildNativeFlowRelayNodes,
  buildTextSendPayload,
  createBoundedMessageStore,
  resolveOutboundWhatsAppId,
  appendMediaFailureNote,
  extractBridgeEvent,
  inboundReadReceiptKeys,
  mediaPayloadForFile,
  pollCreationMessageFromPayload,
  pollUpdateForAggregation,
} from './bridge_helpers.js';

// -- inbound read receipts ------------------------------------------------
{
  const groupKey = {
    id: 'incoming-group-1',
    remoteJid: '120363001234567890@g.us',
    participant: '15550001111@s.whatsapp.net',
    fromMe: false,
  };

  assert.deepEqual(inboundReadReceiptKeys({ key: groupKey, enabled: false }), []);
  assert.deepEqual(
    inboundReadReceiptKeys({ key: { ...groupKey, fromMe: true }, enabled: true }),
    [],
  );
  const receiptKeys = inboundReadReceiptKeys({ key: groupKey, enabled: true });
  assert.equal(receiptKeys.length, 1);
  assert.equal(receiptKeys[0], groupKey);
  assert.equal(receiptKeys[0].participant, groupKey.participant);
  console.log('  ✓ inbound read receipts preserve the original group message key');
}

// -- approval buttons ------------------------------------------------------
{
  const { content, options } = buildButtonsSendPayload(
    '⚠️ Pantheon precisa da sua decisão',
    {
      buttons: [
        { id: 'APPROVE opaque-token-1', text: '✅ Aprovar' },
        { id: 'DENY opaque-token-1', text: '❌ Negar' },
      ],
    },
  );

  assert.equal(
    content.interactiveMessage.body.text,
    '⚠️ Pantheon precisa da sua decisão',
  );
  assert.deepEqual(
    content.interactiveMessage.nativeFlowMessage.buttons,
    [
      {
        name: 'quick_reply',
        buttonParamsJson: '{"display_text":"✅ Aprovar","id":"APPROVE opaque-token-1"}',
      },
      {
        name: 'quick_reply',
        buttonParamsJson: '{"display_text":"❌ Negar","id":"DENY opaque-token-1"}',
      },
    ],
  );
  assert.equal(
    JSON.parse(content.interactiveMessage.nativeFlowMessage.buttons[0].buttonParamsJson)
      .display_text.includes('opaque'),
    false,
  );
  assert.equal(content.messageContextInfo.deviceListMetadataVersion, 2);
  assert.equal(content.interactiveMessage.nativeFlowMessage.messageVersion, 1);
  assert.equal(content.interactiveMessage.nativeFlowMessage.messageParamsJson, '{}');
  assert.deepEqual(options, {});
  console.log('  ✓ approval buttons keep the nonce out of visible labels');

  const generated = generateWAMessageFromContent(
    '15551234567@s.whatsapp.net',
    content,
    {
      userJid: '15550001111@s.whatsapp.net',
      messageId: generateMessageIDV2('15550001111@s.whatsapp.net'),
    },
  );
  assert.equal(generated.key.remoteJid, '15551234567@s.whatsapp.net');
  assert.equal(generated.message.interactiveMessage.nativeFlowMessage.buttons.length, 2);
  assert.equal(
    generated.message.interactiveMessage.body.text,
    '⚠️ Pantheon precisa da sua decisão',
  );
  console.log('  ✓ installed Baileys serializes the native approval payload');
}

{
  const privateNodes = buildNativeFlowRelayNodes('15551234567@s.whatsapp.net', { nowSeconds: 1788200000 });
  assert.deepEqual(privateNodes.map(node => node.tag), ['bot', 'biz']);
  assert.equal(privateNodes[0].attrs.biz_bot, '1');
  assert.equal(privateNodes[1].attrs.actual_actors, '2');
  assert.deepEqual(privateNodes[1].content[0], {
    tag: 'interactive',
    attrs: { type: 'native_flow', v: '1' },
    content: [{ tag: 'native_flow', attrs: { v: '9', name: 'mixed' } }],
  });

  const groupNodes = buildNativeFlowRelayNodes('120363001234567890@g.us', { nowSeconds: 1788200000 });
  assert.deepEqual(groupNodes.map(node => node.tag), ['biz']);
  console.log('  ✓ native-flow relay includes the bounded WhatsApp biz nodes');
}

// -- outbound LID routing -------------------------------------------------
{
  const lidToPhone = {
    '111776557490280': '5514998672306',
  };

  assert.equal(
    resolveOutboundWhatsAppId('111776557490280@lid', lidToPhone),
    '5514998672306@s.whatsapp.net',
  );
  assert.equal(
    resolveOutboundWhatsAppId('111776557490280:7@lid', lidToPhone),
    '5514998672306@s.whatsapp.net',
  );
  assert.equal(
    resolveOutboundWhatsAppId('5514998672306@s.whatsapp.net', lidToPhone),
    '5514998672306@s.whatsapp.net',
  );
  assert.equal(
    resolveOutboundWhatsAppId('120363001234567890@g.us', lidToPhone),
    '120363001234567890@g.us',
  );
  assert.equal(
    resolveOutboundWhatsAppId('999999999999999@lid', lidToPhone),
    '999999999999999@lid',
  );
  console.log('  ✓ outbound mapped LIDs resolve to phone JIDs without changing groups or unknown IDs');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'button-response-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        buttonsResponseMessage: {
          selectedButtonId: 'APPROVE opaque-token-1',
          selectedDisplayText: '✅ Aprovar',
          contextInfo: { stanzaId: 'approval-message-1' },
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
  });

  assert.equal(event.body, 'APPROVE opaque-token-1');
  assert.equal(event.nativeType, 'buttonsResponseMessage');
  assert.deepEqual(event.nativeMetadata.approvalButton, {
    decision: 'APPROVE',
    displayText: '✅ Aprovar',
    responseType: 'buttonsResponseMessage',
    valid: true,
  });
  assert.equal(event.quotedMessageId, 'approval-message-1');
  console.log('  ✓ button responses normalize into the canonical approval command');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'button-response-tampered', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        buttonsResponseMessage: {
          selectedButtonId: 'APPROVE token with invalid spacing',
          selectedDisplayText: '✅ Aprovar',
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
  });

  assert.equal(event.body, '');
  assert.equal(event.nativeType, 'buttonsResponseMessage');
  assert.equal(event.nativeMetadata.approvalButton.valid, false);
  assert.equal(event.nativeMetadata.approvalButton.decision, '');
  console.log('  ✓ malformed approval button payloads fail closed');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'interactive-response-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'quick_reply',
            paramsJson: JSON.stringify({ display_text: '✅ Aprovar', id: 'APPROVE opaque-token-1' }),
            version: 3,
          },
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
  });

  assert.equal(event.body, 'APPROVE opaque-token-1');
  assert.equal(event.nativeType, 'interactiveResponseMessage');
  assert.deepEqual(event.nativeMetadata.approvalButton, {
    decision: 'APPROVE',
    displayText: '✅ Aprovar',
    responseType: 'interactiveResponseMessage',
    valid: true,
  });
  console.log('  ✓ native-flow quick replies normalize into the canonical approval command');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'interactive-response-tampered', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'quick_reply',
            paramsJson: '{"display_text":"✅ Aprovar",',
            version: 3,
          },
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
  });

  assert.equal(event.body, '');
  assert.equal(event.nativeType, 'interactiveResponseMessage');
  assert.equal(event.nativeMetadata.approvalButton.valid, false);
  assert.equal(event.nativeMetadata.approvalButton.decision, '');
  console.log('  ✓ malformed native-flow responses fail closed');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'interactive-response-wrong-kind', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        interactiveResponseMessage: {
          nativeFlowResponseMessage: {
            name: 'cta_url',
            paramsJson: JSON.stringify({ id: 'APPROVE opaque-token-1' }),
          },
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
  });

  assert.equal(event.body, '');
  assert.equal(event.nativeMetadata.approvalButton.valid, false);
  console.log('  ✓ non-quick-reply native actions cannot become approval commands');
}

// -- quoted outbound text -------------------------------------------------
{
  const store = createBoundedMessageStore(2);
  store.remember({
    key: {
      id: 'inbound-1',
      remoteJid: '15551234567@s.whatsapp.net',
      participant: '15550001111@s.whatsapp.net',
      fromMe: false,
    },
    message: { conversation: 'original text' },
  });

  const { content, options } = buildTextSendPayload('reply text', {
    chatId: '15551234567@s.whatsapp.net',
    replyTo: 'inbound-1',
    messageStore: store,
  });

  assert.deepEqual(content, { text: 'reply text' });
  assert.equal(options.quoted.key.id, 'inbound-1');
  assert.equal(options.quoted.message.conversation, 'original text');
  console.log('  ✓ text replies include Baileys quoted message when resolvable');
}

{
  const store = createBoundedMessageStore(2);
  const { content, options } = buildTextSendPayload('plain text', {
    chatId: '15551234567@s.whatsapp.net',
    replyTo: 'missing-id',
    messageStore: store,
  });

  assert.deepEqual(content, { text: 'plain text' });
  assert.deepEqual(options, {});
  console.log('  ✓ unresolved replyTo falls back to plain text');
}

// -- inbound quote/media/native metadata --------------------------------
{
  const event = await extractBridgeEvent({
    msg: {
      key: {
        id: 'incoming-1',
        remoteJid: '15551234567@s.whatsapp.net',
        participant: '15550001111@s.whatsapp.net',
        fromMe: false,
      },
      pushName: 'Tester',
      messageTimestamp: 123,
      message: {
        extendedTextMessage: {
          text: 'approved',
          contextInfo: {
            stanzaId: 'outbound-1',
            participant: '15559998888@s.whatsapp.net',
            remoteJid: '15551234567@s.whatsapp.net',
            quotedMessage: { conversation: 'approve deploy?' },
          },
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15550001111@s.whatsapp.net',
    senderNumber: '15550001111',
    botIds: ['15559998888@s.whatsapp.net'],
    downloadMedia: async () => Buffer.from(''),
  });

  assert.equal(event.quotedMessageId, 'outbound-1');
  assert.equal(event.quotedParticipant, '15559998888@s.whatsapp.net');
  assert.equal(event.quotedRemoteJid, '15551234567@s.whatsapp.net');
  assert.equal(event.quotedText, 'approve deploy?');
  assert.deepEqual(event.readReceiptKey, {
    id: 'incoming-1',
    remoteJid: '15551234567@s.whatsapp.net',
    participant: '15550001111@s.whatsapp.net',
    fromMe: false,
  });
  assert.equal(event.hasQuotedMessage, true);
  assert.equal(event.body, 'approved');
  console.log('  ✓ inbound quoted metadata includes quoted text');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'doc-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        documentMessage: {
          caption: 'see attached',
          fileName: 'report.pdf',
          mimetype: 'application/pdf',
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15550001111@s.whatsapp.net',
    senderNumber: '15550001111',
    downloadMedia: async () => Buffer.from('pdf'),
    writeMediaFile: async () => '/tmp/report.pdf',
  });

  assert.equal(event.hasMedia, true);
  assert.equal(event.mediaType, 'document');
  assert.equal(event.mime, 'application/pdf');
  assert.equal(event.fileName, 'report.pdf');
  assert.equal(event.nativeType, 'documentMessage');
  assert.deepEqual(event.mediaUrls, ['/tmp/report.pdf']);
  console.log('  ✓ inbound document metadata preserves MIME and filename');
}

{
  const cacheDir = mkdtempSync(path.join(tmpdir(), 'hermes-wa-doc-'));
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'doc-2', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        documentMessage: {
          caption: 'see attached',
          fileName: 'report',
          mimetype: 'application/pdf',
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15550001111@s.whatsapp.net',
    senderNumber: '15550001111',
    downloadMedia: async () => Buffer.from('pdf'),
    cacheDirs: { document: cacheDir },
  });

  assert.equal(event.mediaUrls.length, 1);
  assert.ok(event.mediaUrls[0].endsWith('_report.pdf'), event.mediaUrls[0]);
  console.log('  ✓ MIME extension is preserved when document filename has none');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'loc-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        locationMessage: {
          name: 'HQ',
          degreesLatitude: 41.015,
          degreesLongitude: 28.979,
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15550001111@s.whatsapp.net',
    senderNumber: '15550001111',
  });

  assert.equal(event.mediaType, 'location');
  assert.equal(event.body, '[Location: HQ 41.015,28.979]');
  assert.deepEqual(event.nativeMetadata.location, {
    name: 'HQ',
    address: '',
    latitude: 41.015,
    longitude: 28.979,
    isLive: false,
  });
  console.log('  ✓ native location messages get text fallback and metadata');
}

{
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'poll-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: {
        pollCreationMessage: {
          name: 'Approve deploy?',
          options: [{ optionName: 'Approve' }, { optionName: 'Deny' }],
          selectableOptionsCount: 1,
        },
      },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15550001111@s.whatsapp.net',
    senderNumber: '15550001111',
  });

  assert.equal(event.mediaType, 'poll');
  assert.equal(event.body, '[Poll: Approve deploy? Options: Approve, Deny]');
  assert.deepEqual(event.nativeMetadata.poll.options, ['Approve', 'Deny']);
  console.log('  ✓ poll creation messages get text fallback and metadata');
}

// -- outbound media/poll helpers -----------------------------------------
{
  const payload = mediaPayloadForFile({
    buffer: Buffer.from('gif89a'),
    filePath: '/tmp/loop.gif',
    mediaType: 'image',
    caption: 'loop',
  });

  assert.ok(payload.image, 'pure helper fallback keeps raw GIF as image bytes');
  assert.equal(payload.gifPlayback, undefined);
  assert.equal(payload.mimetype, 'image/gif');
  assert.equal(payload.caption, 'loop');
  console.log('  ✓ local GIF helper fallback stays truthful; live bridge converts to gifPlayback when possible');
}

{
  const payload = buildPollPayload({
    question: 'Proceed?',
    options: ['Approve', 'Deny'],
    selectableCount: 1,
  });

  assert.equal(payload.poll.name, 'Proceed?');
  assert.deepEqual(payload.poll.values, ['Approve', 'Deny']);
  assert.equal(payload.poll.selectableCount, 1);
  assert.equal(Buffer.isBuffer(payload.poll.messageSecret), true);
  assert.equal(payload.poll.messageSecret.length, 32);
  assert.deepEqual(pollCreationMessageFromPayload(payload), {
    messageContextInfo: {
      messageSecret: payload.poll.messageSecret,
    },
    pollCreationMessageV3: {
      name: 'Proceed?',
      options: [{ optionName: 'Approve' }, { optionName: 'Deny' }],
      selectableOptionsCount: 1,
    },
  });
  console.log('  ✓ poll payload primitive carries a cacheable vote secret');
}

{
  const pollCreation = {
    key: {
      id: 'poll-creation',
      remoteJid: '15551234567@s.whatsapp.net',
      fromMe: true,
    },
    message: {
      messageContextInfo: {
        messageSecret: Buffer.from('0123456789abcdef0123456789abcdef'),
      },
      pollCreationMessageV3: {
        name: 'Proceed?',
        options: [{ optionName: 'Approve' }, { optionName: 'Deny' }],
        selectableOptionsCount: 1,
      },
    },
  };
  const voteKey = {
    id: 'vote-message',
    remoteJid: '15551234567@s.whatsapp.net',
    participant: '15550001111@s.whatsapp.net',
    fromMe: false,
  };
  const encryptedVote = {
    encPayload: Buffer.from('payload'),
    encIv: Buffer.from('iv'),
  };

  const attempts = [];
  const pollUpdate = pollUpdateForAggregation({
    pollUpdateMessage: {
      pollCreationMessageKey: pollCreation.key,
      vote: encryptedVote,
      senderTimestampMs: 123,
    },
    pollUpdateMessageKey: voteKey,
    pollCreation,
    decryptPollVote: (vote, ctx) => {
      attempts.push({ pollCreatorJid: ctx.pollCreatorJid, voterJid: ctx.voterJid });
      assert.equal(vote, encryptedVote);
      assert.equal(ctx.pollMsgId, 'poll-creation');
      assert.equal(ctx.pollEncKey, pollCreation.message.messageContextInfo.messageSecret);
      if (ctx.pollCreatorJid !== 'creator-lid@lid') {
        throw new Error('wrong creator jid');
      }
      assert.equal(ctx.voterJid, '15550001111@s.whatsapp.net');
      return {
        selectedOptions: [createHash('sha256').update(Buffer.from('Approve')).digest()],
      };
    },
    getKeyAuthor: (key, meId = 'me') => (key?.fromMe ? meId : key?.participant || key?.remoteJid || ''),
    meId: 'classic-me@s.whatsapp.net',
    pollCreatorJids: ['classic-me@s.whatsapp.net', 'creator-lid@lid'],
  });

  assert.deepEqual(attempts.map(item => item.pollCreatorJid), ['classic-me@s.whatsapp.net', 'creator-lid@lid']);

  assert.equal(pollUpdate.pollUpdateMessageKey.id, 'vote-message');
  assert.equal(pollUpdate.senderTimestampMs, 123);
  const aggregation = getAggregateVotesInPollMessage({
    message: pollCreation.message,
    pollUpdates: [pollUpdate],
  });
  assert.deepEqual(
    aggregation.map(option => ({ name: option.name, voters: option.voters })),
    [
      { name: 'Approve', voters: ['15550001111@s.whatsapp.net'] },
      { name: 'Deny', voters: [] },
    ],
  );
  console.log('  ✓ encrypted poll upserts are wrapped into Baileys aggregation shape');
}

// -- media download failure containment (port of nanoclaw#2895) -----------
{
  assert.equal(appendMediaFailureNote('hello', []), 'hello');
  assert.equal(
    appendMediaFailureNote('check this out', ['image']),
    'check this out\n[image could not be downloaded]',
  );
  // Regression guard: an uncaptioned failed image must still produce a
  // non-empty body, or the empty-message guard drops the whole message.
  assert.equal(appendMediaFailureNote('', ['image']), '[image could not be downloaded]');
  assert.equal(
    appendMediaFailureNote('', ['image', 'document']),
    '[image could not be downloaded] [document could not be downloaded]',
  );
  console.log('  ✓ appendMediaFailureNote formats failure notes');
}

{
  // A throwing downloadMedia (expired CDN URL) must not reject out of
  // extractBridgeEvent — before this guard the whole upsert batch died and
  // the message was silently dropped.
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'img-fail-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: { imageMessage: { caption: '', mimetype: 'image/jpeg' } },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
    downloadMedia: async () => { throw new Error('Failed to fetch stream from https://mmg.whatsapp.net/x'); },
    cacheDirs: { image: mkdtempSync(path.join(tmpdir(), 'wa-media-')) },
  });
  assert.equal(event.hasMedia, true);
  assert.equal(event.mediaUrls.length, 0);
  assert.equal(event.body, '[image could not be downloaded]');
  console.log('  ✓ failed media download is contained and surfaced in body');
}

{
  // Captioned message keeps the caption and appends the failure note.
  const event = await extractBridgeEvent({
    msg: {
      key: { id: 'doc-fail-1', remoteJid: '15551234567@s.whatsapp.net', fromMe: false },
      messageTimestamp: 123,
      message: { documentMessage: { caption: 'see attached', fileName: 'q.pdf', mimetype: 'application/pdf' } },
    },
    chatId: '15551234567@s.whatsapp.net',
    senderId: '15551234567@s.whatsapp.net',
    senderNumber: '15551234567',
    downloadMedia: async () => { throw new Error('boom'); },
    cacheDirs: { document: mkdtempSync(path.join(tmpdir(), 'wa-media-')) },
  });
  assert.equal(event.body, 'see attached\n[document could not be downloaded]');
  assert.equal(event.mediaUrls.length, 0);
  console.log('  ✓ captioned failed download keeps caption and appends note');
}

console.log('\n✅ All WhatsApp native bridge helper tests passed.');
