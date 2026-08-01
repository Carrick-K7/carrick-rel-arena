export const PRODUCT_TITLE = '关系修炼';

export function documentTitle(label?: string | null): string {
  const page = label?.trim();
  return page ? `${page}｜${PRODUCT_TITLE}` : PRODUCT_TITLE;
}

export function dialogueDocumentTitle(characterName: string): string {
  return documentTitle(`与${characterName}对话`);
}

export function memoryDocumentTitle(scenarioNumber?: number): string {
  return documentTitle(
    scenarioNumber ? `第${scenarioNumber}关回忆` : '章节回忆',
  );
}
