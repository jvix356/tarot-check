import { checkText } from './filter.js';
import { readJSON, writeJSON, listPaths } from './store.js';

export const TYPES = { review: '후기', feedback: '피드백', report: '제보', comment: '댓글' };
export const PROGRESS = ['접수', '검토 중', '반영 완료', '반영 안 함'];

export async function allPosts() {
  const paths = await listPaths('posts/');
  const out = [];
  for (const p of paths) { const x = await readJSON(p); if (x) out.push(x); }
  return out.sort((a, b) => a.createdAt < b.createdAt ? 1 : -1);
}

// 공개 화면용 목록: 게시된 글만, 닉네임만 (계정·메모·필터 정보 제외)
export function publicSafe(p) {
  return p.type !== 'report' && !checkText([p.title, p.body, p.nickname].filter(Boolean).join('\n')).blocked.length;
}

export function publicIndex(idx) {
  return { updatedAt: idx.updatedAt || null, posts: (Array.isArray(idx.posts) ? idx.posts : []).filter(publicSafe).map(p => ({ ...publicView(p), comments: (Array.isArray(p.comments) ? p.comments : []).filter(publicSafe).map(c => ({ ...publicView(c), replies: (Array.isArray(c.replies) ? c.replies : []).filter(publicSafe).map(publicView) })) })) };
}

export function publicView(p) {
  return {
    id: p.id, type: p.type, parentId: p.parentId || null, title: p.title || '', body: p.body,
    nickname: p.nickname, createdAt: p.createdAt, editedAt: p.editedAt || null,
    progress: p.type === 'feedback' || p.type === 'report' ? p.progress : null,
    reply: p.reply && !checkText(p.reply.body).blocked.length ? { body: p.reply.body, at: p.reply.at } : null,
  };
}

export async function rebuildIndex() {
  const posts = (await allPosts()).filter(p => p.status === 'published' && publicSafe(p));
  const tops = posts.filter(p => p.type !== 'comment').map(publicView);
  const comments = posts.filter(p => p.type === 'comment').map(publicView).sort((a, b) => a.createdAt < b.createdAt ? -1 : 1);
  for (const t of tops) { t.comments = comments.filter(c => c.parentId === t.id); for (const c of t.comments) c.replies = comments.filter(r => r.parentId === c.id); }
  await writeJSON('index/public.json', { updatedAt: new Date().toISOString(), posts: tops });
}
