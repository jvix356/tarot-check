import crypto from 'node:crypto';
import { hmac, safeEqual } from './util.js';

export const newOwnerToken = () => crypto.randomBytes(32).toString('hex');
export const ownerHash = token => hmac('post-owner:' + token);
export function ownsPost(post, account, token) {
  if (post.authorId) return !!account && post.authorId === account.id;
  return /^[a-f0-9]{64}$/.test(String(token || '')) && !!post.ownerHash && safeEqual(post.ownerHash, ownerHash(token));
}
export function ownerView(p) {
  return { id: p.id, type: p.type, title: p.title, body: p.body.slice(0, 120), status: p.status,
    progress: p.progress, createdAt: p.createdAt, rejectReason: p.rejectReason || '',
    appeal: p.appeal ? { status: p.appeal.status, reason: p.appeal.reason, answer: p.appeal.answer || '', createdAt: p.appeal.createdAt } : null };
}
