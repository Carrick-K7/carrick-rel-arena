import { describe, expect, it } from 'vitest';
import {
  dialogueDocumentTitle,
  documentTitle,
  memoryDocumentTitle,
} from './document-title.js';

describe('document titles', () => {
  it('keeps the homepage title to the product name', () => {
    expect(documentTitle()).toBe('关系修炼');
    expect(documentTitle('   ')).toBe('关系修炼');
  });

  it('adds concise context for inner pages', () => {
    expect(documentTitle('提案被否：陪对方走出会议室')).toBe(
      '提案被否：陪对方走出会议室｜关系修炼',
    );
    expect(dialogueDocumentTitle('秋雾')).toBe('与秋雾对话｜关系修炼');
    expect(documentTitle('周末有约')).toBe('周末有约｜关系修炼');
    expect(memoryDocumentTitle(1)).toBe('第1关回忆｜关系修炼');
  });
});
