import { test } from 'node:test';
import assert from 'node:assert/strict';
import { quoteEmailContent } from './quoteEmail';
import { quoteFixture, SAMPLE_CONFIG } from '../documents/testFixtures';

test('quote email: greeting, figures, the accept link, and a text version', () => {
  const q = quoteFixture({ overrides: { customerName: 'Michael Smith', eventName: 'Smith Gala' } });
  const { subject, html, text } = quoteEmailContent(q, 'https://ops.example.com/q/abc123', SAMPLE_CONFIG);
  assert.equal(subject, `Your quote from Harmony Production — ${q.quoteNumber} · Smith Gala`);
  for (const part of ['Hi Michael,', 'Total estimate (incl. HST)', '$17,433.64 CAD', 'Deposit to book (50%)', 'href="https://ops.example.com/q/abc123"', 'View &amp; accept your quote']) {
    assert.ok(html.includes(part), part);
  }
  assert.match(text, /View & accept your quote: https:\/\/ops\.example\.com\/q\/abc123/);
  assert.match(text, /Valid until: /);
});

test('quote email: customer text can never become markup', () => {
  const evil = '<img src=x onerror=alert(1)>';
  const q = quoteFixture({ overrides: { customerName: evil, eventName: evil } });
  const { html } = quoteEmailContent(q, 'https://ops.example.com/q/a"b', SAMPLE_CONFIG);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('href="https://ops.example.com/q/a&quot;b"'));
});
